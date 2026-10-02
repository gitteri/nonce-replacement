//! Functional Requirement 7 — Transaction Parsability
//! (`../../../requirements/nonce-replacement-spec.md`): a policy engine must
//! be able to read what it is approving. The payload is a standard v1
//! Solana message, but it sits two layers down: Submit data holds the
//! authorization message, whose one instruction is Execute, whose data
//! holds the execution message. Both layers decode with stock types; there
//! is no custom wire format.

mod common;

use std::collections::HashSet;

use solana_address::Address;
use solana_instruction::{AccountMeta, Instruction};
use solana_message::{v1, VersionedMessage};
use solana_system_interface::instruction::transfer;
use spl_ed25519_signer_interface::instruction::Instruction as SignerInstruction;
use spl_message_executor_interface::instruction::Instruction as ExecutorInstruction;

use common::{presign, programmatic_signer, INITIAL_NONCE};

fn decompile(message: &v1::Message) -> Vec<Instruction> {
    message
        .instructions
        .iter()
        .map(|compiled| Instruction {
            program_id: message.account_keys[usize::from(compiled.program_id_index)],
            accounts: compiled
                .accounts
                .iter()
                .map(|&index| {
                    let index = usize::from(index);
                    AccountMeta {
                        pubkey: message.account_keys[index],
                        is_signer: message.is_signer(index),
                        is_writable: message.is_maybe_writable_with_reserved_addresses(
                            index,
                            None::<&HashSet<Address>>,
                        ),
                    }
                })
                .collect(),
            data: compiled.data.clone(),
        })
        .collect()
}

#[test]
fn the_payload_decodes_back_to_the_original_instructions() {
    let cold = common::cold_key(70);
    let pda = programmatic_signer(&cold);
    let nonce = Address::new_unique();
    let payload = vec![
        transfer(&pda, &Address::new_unique(), 1_000_000),
        transfer(&pda, &Address::new_unique(), 2_000_000),
    ];
    let withdraw = presign(&cold, &nonce, INITIAL_NONCE, &payload);

    // Layer 1: Submit data -> authorization message.
    let SignerInstruction::Submit {
        message: VersionedMessage::V1(authorization),
        ..
    } = SignerInstruction::try_from_bytes(&withdraw.submit.data).unwrap()
    else {
        panic!("Submit carries a v1 authorization message");
    };
    let [execute] = decompile(&authorization).try_into().unwrap();
    assert_eq!(execute.program_id, spl_message_executor_interface::id());

    // Layer 2: Execute data -> execution message.
    let ExecutorInstruction::Execute(VersionedMessage::V1(execution)) =
        ExecutorInstruction::try_from_bytes(&execute.data).unwrap()
    else {
        panic!("Execute carries a v1 execution message");
    };
    assert_eq!(execution.lifetime_specifier, INITIAL_NONCE);
    assert_eq!(decompile(&execution), payload);
}
