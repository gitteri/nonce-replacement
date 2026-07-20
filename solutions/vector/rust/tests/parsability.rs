//! Functional Requirement 7 — Transaction Parsability
//! (`../../../requirements/nonce-replacement-spec.md`): any payload
//! instruction that doesn't itself need the vector PDA's signature is a
//! plain, top-level instruction in the transaction — not embedded inside
//! Vector's own wire format — so a generic parser (a cold-wallet policy
//! engine, say) can inspect it with zero Vector-specific decoding.

mod common;

use mollusk_svm::result::Check;
use solana_account::Account;
use solana_address::Address;
use solana_instruction::{AccountMeta, Instruction};
use vector_core::{
    advance_vector_digest, ed25519_pubkey, find_vector_pda, sign_advance_instruction_ed25519,
    ED25519, SYSTEM_PROGRAM_ID,
};

use common::{build_vector_account, mollusk, NONCE};

/// A vanilla System Program `Transfer`, built with no knowledge of Vector
/// whatsoever — the same four bytes of discriminator + eight bytes of
/// lamports any Solana SDK would produce.
fn system_transfer(from: &Address, to: &Address, lamports: u64) -> Instruction {
    let mut data = Vec::with_capacity(12);
    data.extend_from_slice(&2u32.to_le_bytes()); // SystemInstruction::Transfer
    data.extend_from_slice(&lamports.to_le_bytes());
    Instruction {
        program_id: SYSTEM_PROGRAM_ID,
        accounts: vec![AccountMeta::new(*from, true), AccountMeta::new(*to, false)],
        data,
    }
}

#[test]
fn payload_instruction_is_untouched_by_the_advance_wrapper() {
    let key = common::signing_key(50);
    let pubkey = ed25519_pubkey(&key);

    let (payer, dest) = (Address::new_unique(), Address::new_unique());
    let payload_ix = system_transfer(&payer, &dest, 555_000);

    // The advance commits to the payload's bytes via the digest, but never
    // rewrites or wraps them — it is included as a sibling top-level
    // instruction, not as embedded sub-instruction data (contrast with
    // `create_passthrough_instruction`, which DOES serialize its
    // sub-instructions into its own instruction data because those need
    // the PDA's signature; a plain transfer needs no such authority).
    let advance_ix =
        sign_advance_instruction_ed25519(&key, &NONCE, &[], std::slice::from_ref(&payload_ix));

    // Rebuilding the same transfer via the same generic constructor
    // produces byte-identical output to what's sitting in the transaction
    // — proof there's no Vector-side mutation to undo before inspecting
    // it.
    let independently_built = system_transfer(&payer, &dest, 555_000);
    assert_eq!(payload_ix, independently_built);

    // Decode the payload as any standard System Program parser would —
    // reading the discriminator and lamports fields directly off the
    // wire — with no reference to Vector's digest, PDA, or instruction
    // formats at all.
    let discriminator = u32::from_le_bytes(payload_ix.data[0..4].try_into().unwrap());
    let decoded_lamports = u64::from_le_bytes(payload_ix.data[4..12].try_into().unwrap());
    assert_eq!(discriminator, 2);
    assert_eq!(decoded_lamports, 555_000);
    assert_eq!(payload_ix.program_id, SYSTEM_PROGRAM_ID);

    // And it genuinely executes as a normal transfer once landed — this
    // isn't just a type-equality trick, the chain treats it as an
    // ordinary instruction.
    let mollusk = mollusk();
    let rent_min = mollusk.sysvars.rent.minimum_balance(ED25519.account_len());
    let (vector, bump) = find_vector_pda(&ED25519, &pubkey);
    let vector_account = build_vector_account(NONCE, bump, rent_min, &pubkey);
    let (system_program, system_program_account) =
        mollusk_svm::program::keyed_account_for_system_program();
    let payer_account = Account::new(10_000_000_000, 0, &system_program);
    let dest_account = Account::new(0, 0, &system_program);

    let next_nonce =
        advance_vector_digest(&ED25519, &NONCE, &pubkey, &[], std::slice::from_ref(&payload_ix));
    let expected_vector_data =
        common::expected_advanced_data(next_nonce, bump, &pubkey);

    mollusk.process_and_validate_transaction_instructions(
        &[advance_ix, payload_ix],
        &[
            (vector, vector_account),
            (payer, payer_account),
            (dest, dest_account),
            (system_program, system_program_account),
        ],
        &[
            Check::success(),
            Check::account(&vector).data(&expected_vector_data).build(),
            Check::account(&dest).lamports(555_000).build(),
        ],
    );
}
