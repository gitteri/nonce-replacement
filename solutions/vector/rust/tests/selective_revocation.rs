//! Functional Requirement 5 — Selective Revocation
//! (`../../../requirements/nonce-replacement-spec.md`): revoking one
//! pre-signed transaction must not affect any other outstanding
//! transaction, including ones from a different identity/lane. Mirrors
//! Vector's own `revocation_orphans_presigned_advance` test.

mod common;

use mollusk_svm::result::Check;
use solana_account::Account;
use solana_address::Address;
use solana_program_error::ProgramError;
use vector_core::{
    create_passthrough_instruction, create_withdraw_subinstruction, ed25519_pubkey,
    find_vector_pda, revocation_digest, sign_advance_instruction_ed25519,
    sign_revocation_instruction_ed25519, ED25519,
};

use common::{build_vector_account, expected_advanced_data, find_account, mollusk, NONCE};

#[test]
fn revocation_orphans_only_its_own_lane() {
    let mollusk = mollusk();

    // Lane A: pre-signs a withdraw, then gets revoked.
    let key_a = common::signing_key(20);
    let pubkey_a = ed25519_pubkey(&key_a);
    let rent_min = mollusk.sysvars.rent.minimum_balance(ED25519.account_len());
    let (vector_a, bump_a) = find_vector_pda(&ED25519, &pubkey_a);
    let vector_account_a = build_vector_account(NONCE, bump_a, rent_min + 5_000_000, &pubkey_a);
    let (eoa, eoa_account) = (
        Address::new_unique(),
        Account::new(10_000_000_000, 0, &Address::default()),
    );

    let withdraw_sub_a = create_withdraw_subinstruction(&ED25519, &pubkey_a, &eoa, 3_000_000);
    let passthrough_a = create_passthrough_instruction(&ED25519, &pubkey_a, &[withdraw_sub_a]);
    let presigned_a = sign_advance_instruction_ed25519(
        &key_a,
        &NONCE,
        &[],
        std::slice::from_ref(&passthrough_a),
    );

    let revocation_a = sign_revocation_instruction_ed25519(&key_a, &NONCE);
    let next_nonce_a = revocation_digest(&ED25519, &NONCE, &pubkey_a);
    let expected_a_revoked = expected_advanced_data(next_nonce_a, bump_a, &pubkey_a);

    // Lane B: an entirely separate identity, with its own outstanding
    // pre-signed withdraw at its own nonce.
    let key_b = common::signing_key(21);
    let pubkey_b = ed25519_pubkey(&key_b);
    let (vector_b, bump_b) = find_vector_pda(&ED25519, &pubkey_b);
    let vector_account_b = build_vector_account(NONCE, bump_b, rent_min + 5_000_000, &pubkey_b);
    let withdraw_sub_b = create_withdraw_subinstruction(&ED25519, &pubkey_b, &eoa, 2_000_000);
    let passthrough_b = create_passthrough_instruction(&ED25519, &pubkey_b, &[withdraw_sub_b]);
    let presigned_b = sign_advance_instruction_ed25519(
        &key_b,
        &NONCE,
        &[],
        std::slice::from_ref(&passthrough_b),
    );

    // Revoke A only.
    let result = mollusk.process_and_validate_transaction_instructions(
        &[revocation_a.clone()],
        &[(vector_a, vector_account_a)],
        &[
            Check::success(),
            Check::account(&vector_a).data(&expected_a_revoked).build(),
        ],
    );
    let revoked_vector_a = find_account(&result.resulting_accounts, &vector_a).clone();

    // A's presigned withdraw is now orphaned: it was signed against the
    // consumed nonce.
    mollusk.process_and_validate_transaction_instructions(
        &[presigned_a, passthrough_a],
        &[(vector_a, revoked_vector_a), (eoa, eoa_account.clone())],
        &[Check::err(ProgramError::MissingRequiredSignature)],
    );

    // B was never touched: its own presigned withdraw, at its own
    // untouched nonce, lands exactly as it would have before A's
    // revocation ever happened — proving per-lane isolation.
    mollusk.process_and_validate_transaction_instructions(
        &[presigned_b, passthrough_b],
        &[(vector_b, vector_account_b), (eoa, eoa_account)],
        &[
            Check::success(),
            Check::account(&vector_b).lamports(rent_min + 3_000_000).build(),
        ],
    );
}
