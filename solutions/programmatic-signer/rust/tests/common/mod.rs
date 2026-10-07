//! Shared mollusk-svm helpers. The three programs run from ELFs dumped from
//! the canonical devnet deployment (`fixtures/`, relative to this crate's
//! root, which is the working directory `cargo test` uses).

#![allow(dead_code)]

use std::collections::HashMap;

use mollusk_svm::{Mollusk, MolluskContext};
use solana_account::Account;
use solana_address::Address;
use solana_hash::Hash;
use solana_instruction::Instruction;
use solana_keypair::Keypair;
use solana_message::{v1, VersionedMessage};
use solana_signer::Signer;
use spl_ed25519_signer_client::{signing::sign_and_submit, ProgrammaticSigner};
use spl_message_executor_client::instruction::execute;
use spl_message_executor_interface::instruction::derive_transition_commitment;
use spl_nonce_interface::state::Nonce;

pub type Context = MolluskContext<HashMap<Address, Account>>;

/// Starting value for every nonce account in this crate. Real accounts seed
/// it from `SlotHashes` at `Initialize`; tests write state directly.
pub const INITIAL_NONCE: Hash = Hash::new_from_array([0xab; 32]);

pub const SYSTEM_PROGRAM_ID: Address = solana_system_interface::program::ID;

/// A distinct, deterministic cold key per test identity.
pub fn cold_key(marker: u8) -> Keypair {
    Keypair::new_from_array([marker; 32])
}

/// The address that owns funds for `cold_key` and that Submit promotes to
/// signer: `["programmatic-signer", authority]` under the Signer program.
pub fn programmatic_signer(cold: &Keypair) -> Address {
    ProgrammaticSigner::derive_address(&spl_ed25519_signer_interface::id(), &cold.pubkey())
}

pub fn mollusk() -> Mollusk {
    let mut mollusk = Mollusk::new(
        &spl_ed25519_signer_interface::id(),
        "fixtures/spl_ed25519_signer_program",
    );
    mollusk.add_program(
        &spl_message_executor_interface::id(),
        "fixtures/spl_message_executor_program",
    );
    mollusk.add_program(&spl_nonce_interface::id(), "fixtures/spl_nonce_program");
    mollusk
}

pub fn context(accounts: impl IntoIterator<Item = (Address, Account)>) -> Context {
    mollusk().with_context(accounts.into_iter().collect())
}

pub fn system_account(lamports: u64) -> Account {
    Account::new(lamports, 0, &SYSTEM_PROGRAM_ID)
}

/// An initialized 72-byte nonce account: nonce, authority, initialize_slot.
pub fn nonce_account(nonce: Hash, authority: &Address) -> Account {
    let mut data = Vec::with_capacity(Nonce::LEN);
    data.extend_from_slice(nonce.as_bytes());
    data.extend_from_slice(authority.as_ref());
    data.extend_from_slice(&1u64.to_le_bytes());
    Account {
        lamports: mollusk().sysvars.rent.minimum_balance(Nonce::LEN),
        data,
        owner: spl_nonce_interface::id(),
        executable: false,
        rent_epoch: 0,
    }
}

/// An offline-signed transaction, ready for any relayer to land.
pub struct Presigned {
    pub submit: Instruction,
    pub execution_message: v1::Message,
}

/// Signs `payload` offline against `nonce` on `nonce_account`. The
/// programmatic signer is both the nonce authority and the execution
/// message's first key, which is how the CLI's `--cold-authority` flow
/// lays it out. No chain state is read.
pub fn presign(
    cold: &Keypair,
    nonce_account: &Address,
    nonce: Hash,
    payload: &[Instruction],
) -> Presigned {
    let pda = programmatic_signer(cold);
    let execution_message = v1::Message::try_compile(&pda, payload, nonce).unwrap();
    let executor_ix = execute(nonce_account, &pda, &execution_message);
    let submit = sign_and_submit(&executor_ix, &[cold]).unwrap();
    Presigned {
        submit,
        execution_message,
    }
}

/// The value `nonce_account` holds after `execution_message` lands.
pub fn next_nonce(nonce_account: &Address, current: Hash, execution_message: &v1::Message) -> Hash {
    let state = Nonce {
        nonce: current,
        ..Nonce::default()
    };
    state.derive_next_nonce(
        &spl_nonce_interface::id(),
        nonce_account,
        &derive_transition_commitment(&VersionedMessage::V1(execution_message.clone())),
    )
}

pub fn account(ctx: &Context, address: &Address) -> Account {
    ctx.account_store.borrow()[address].clone()
}

pub fn stored_nonce(ctx: &Context, nonce_account: &Address) -> Hash {
    Hash::new_from_array(account(ctx, nonce_account).data[..32].try_into().unwrap())
}

pub fn lamports(ctx: &Context, address: &Address) -> u64 {
    ctx.account_store
        .borrow()
        .get(address)
        .map_or(0, |account| account.lamports)
}
