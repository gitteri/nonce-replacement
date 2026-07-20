//! Functional Requirement 4 — Transaction Integrity
//! (`../../../requirements/nonce-replacement-spec.md`): the signed payload
//! must be cryptographically locked at sign time and unalterable by the
//! fee payer or anyone else between signing and broadcast.

mod common;

use mollusk_svm::result::Check;
use solana_account::Account;
use solana_address::Address;
use solana_program_error::ProgramError;
use vector_core::{
    advance_vector_digest, create_passthrough_instruction, create_withdraw_subinstruction,
    ed25519_pubkey, find_vector_pda, sign_advance_instruction_ed25519, ED25519,
};

use common::{account_data, build_vector_account, expected_advanced_data, mollusk, NONCE};

#[test]
fn mutating_payload_after_signing_invalidates_signature() {
    let mollusk = mollusk();
    let key = common::signing_key(1);
    let pubkey = ed25519_pubkey(&key);
    let (vector, bump) = find_vector_pda(&ED25519, &pubkey);
    let rent_min = mollusk.sysvars.rent.minimum_balance(ED25519.account_len());
    let starting_lamports = rent_min + 5_000_000;

    let (eoa, eoa_account) = (
        Address::new_unique(),
        Account::new(0, 0, &Address::default()),
    );

    let withdraw_sub = create_withdraw_subinstruction(&ED25519, &pubkey, &eoa, 1_000_000);
    let passthrough_ix = create_passthrough_instruction(&ED25519, &pubkey, &[withdraw_sub]);
    let advance_ix =
        sign_advance_instruction_ed25519(&key, &NONCE, &[], std::slice::from_ref(&passthrough_ix));

    // Baseline: signed as-is, the pair lands and advances the nonce exactly
    // as committed to at sign time.
    let next_nonce = advance_vector_digest(
        &ED25519,
        &NONCE,
        &pubkey,
        &[],
        std::slice::from_ref(&passthrough_ix),
    );
    let expected_data = expected_advanced_data(next_nonce, bump, &pubkey);
    let vector_account = build_vector_account(NONCE, bump, starting_lamports, &pubkey);
    mollusk.process_and_validate_transaction_instructions(
        &[advance_ix.clone(), passthrough_ix.clone()],
        &[(vector, vector_account), (eoa, eoa_account.clone())],
        &[
            Check::success(),
            Check::account(&vector).data(&expected_data).build(),
        ],
    );

    // Same advance signature, but the withdrawal amount encoded in the
    // sibling passthrough's data is tampered with post-signing (a
    // fee-payer or relay flipping a byte before broadcast). The instructions
    // sysvar the program hashes now differs from what was signed, so the
    // signature no longer verifies over the recomputed digest — even though
    // the advance instruction's own bytes are untouched.
    let mut tampered_passthrough = passthrough_ix.clone();
    let last = tampered_passthrough.data.len() - 1;
    tampered_passthrough.data[last] ^= 0xFF;

    let vector_account = build_vector_account(NONCE, bump, starting_lamports, &pubkey);
    let result = mollusk.process_and_validate_transaction_instructions(
        &[advance_ix, tampered_passthrough],
        &[(vector, vector_account.clone()), (eoa, eoa_account)],
        &[Check::err(ProgramError::MissingRequiredSignature)],
    );
    assert_eq!(
        account_data(&result.resulting_accounts, &vector),
        vector_account.data,
        "a rejected advance must not have moved the nonce"
    );
}

#[test]
fn appending_unsigned_instruction_invalidates_signature() {
    let mollusk = mollusk();
    let key = common::signing_key(2);
    let pubkey = ed25519_pubkey(&key);
    let (vector, bump) = find_vector_pda(&ED25519, &pubkey);
    let rent_min = mollusk.sysvars.rent.minimum_balance(ED25519.account_len());

    // Signed over an empty payload — the signer's intent is "just advance,
    // nothing else".
    let advance_ix = sign_advance_instruction_ed25519(&key, &NONCE, &[], &[]);

    let (eoa, eoa_account) = (
        Address::new_unique(),
        Account::new(0, 0, &Address::default()),
    );
    let withdraw_sub = create_withdraw_subinstruction(&ED25519, &pubkey, &eoa, 1);
    let passthrough_ix = create_passthrough_instruction(&ED25519, &pubkey, &[withdraw_sub]);

    let vector_account = build_vector_account(NONCE, bump, rent_min, &pubkey);
    let result = mollusk.process_and_validate_transaction_instructions(
        // A relay appends a passthrough after the signed advance, hoping the
        // extra instruction rides along un-vetted. The digest committed to
        // an instruction list ending at the advance — the sysvar now
        // carries one more instruction than it was signed for.
        &[advance_ix, passthrough_ix],
        &[(vector, vector_account.clone()), (eoa, eoa_account)],
        &[Check::err(ProgramError::MissingRequiredSignature)],
    );
    assert_eq!(
        account_data(&result.resulting_accounts, &vector),
        vector_account.data
    );
}
