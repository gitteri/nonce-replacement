//! Functional Requirement 2 — Concurrency
//! (`../../../requirements/nonce-replacement-spec.md`): a single signing
//! authority uses N independent `VectorAccount` identities ("lanes") to
//! hold N concurrently outstanding pre-signed transactions. Each lane's
//! own nonce still enforces mutual exclusion within that lane.

mod common;

use mollusk_svm::result::Check;
use solana_account::Account;
use solana_address::Address;
use solana_program_error::ProgramError;
use vector_core::{
    advance_vector_digest, create_passthrough_instruction, create_withdraw_subinstruction,
    ed25519_pubkey, find_vector_pda, sign_advance_instruction_ed25519, ED25519,
};

use common::{build_vector_account, expected_advanced_data, mollusk, NONCE};

#[test]
fn independent_lanes_land_independently() {
    let mollusk = mollusk();
    let rent_min = mollusk.sysvars.rent.minimum_balance(ED25519.account_len());
    let (eoa, eoa_account) = (
        Address::new_unique(),
        Account::new(10_000_000_000, 0, &Address::default()),
    );

    // Three lanes, three identities, three independently pre-signed
    // withdrawals — a cold-wallet ceremony batching multiple approvals in
    // one session.
    for (marker, withdraw_amount) in [(30u8, 1_000_000u64), (31, 2_000_000), (32, 3_000_000)] {
        let key = common::signing_key(marker);
        let pubkey = ed25519_pubkey(&key);
        let (vector, bump) = find_vector_pda(&ED25519, &pubkey);
        let vector_account = build_vector_account(NONCE, bump, rent_min + 5_000_000, &pubkey);

        let withdraw_sub = create_withdraw_subinstruction(&ED25519, &pubkey, &eoa, withdraw_amount);
        let passthrough_ix = create_passthrough_instruction(&ED25519, &pubkey, &[withdraw_sub]);
        let advance_ix = sign_advance_instruction_ed25519(
            &key,
            &NONCE,
            &[],
            std::slice::from_ref(&passthrough_ix),
        );
        let next_nonce = advance_vector_digest(
            &ED25519,
            &NONCE,
            &pubkey,
            &[],
            std::slice::from_ref(&passthrough_ix),
        );
        let expected_data = expected_advanced_data(next_nonce, bump, &pubkey);

        // Each lane broadcasts as its own transaction — landing one lane
        // has no bearing on whether another lane's pre-signed transaction
        // is valid.
        mollusk.process_and_validate_transaction_instructions(
            &[advance_ix, passthrough_ix],
            &[(vector, vector_account), (eoa, eoa_account.clone())],
            &[
                Check::success(),
                Check::account(&vector).data(&expected_data).build(),
                Check::account(&vector)
                    .lamports(rent_min + 5_000_000 - withdraw_amount)
                    .build(),
            ],
        );
    }
}

#[test]
fn a_second_presigned_transaction_on_the_same_lane_fails_once_the_first_lands() {
    let mollusk = mollusk();
    let key = common::signing_key(33);
    let pubkey = ed25519_pubkey(&key);
    let (vector, bump) = find_vector_pda(&ED25519, &pubkey);
    let rent_min = mollusk.sysvars.rent.minimum_balance(ED25519.account_len());
    let (eoa_1, eoa_1_account) = (
        Address::new_unique(),
        Account::new(0, 0, &Address::default()),
    );
    let (eoa_2, eoa_2_account) = (
        Address::new_unique(),
        Account::new(0, 0, &Address::default()),
    );

    // Two racing payloads, both pre-signed against the SAME outstanding
    // nonce — e.g. a policy engine drafted two candidate withdrawals before
    // either was approved.
    let withdraw_1 = create_withdraw_subinstruction(&ED25519, &pubkey, &eoa_1, 1_000_000);
    let passthrough_1 = create_passthrough_instruction(&ED25519, &pubkey, &[withdraw_1]);
    let advance_1 = sign_advance_instruction_ed25519(
        &key,
        &NONCE,
        &[],
        std::slice::from_ref(&passthrough_1),
    );

    let withdraw_2 = create_withdraw_subinstruction(&ED25519, &pubkey, &eoa_2, 2_000_000);
    let passthrough_2 = create_passthrough_instruction(&ED25519, &pubkey, &[withdraw_2]);
    let advance_2 = sign_advance_instruction_ed25519(
        &key,
        &NONCE,
        &[],
        std::slice::from_ref(&passthrough_2),
    );

    let vector_account = build_vector_account(NONCE, bump, rent_min + 5_000_000, &pubkey);

    // The first one to land wins the lane and bumps the nonce.
    let result = mollusk.process_and_validate_transaction_instructions(
        &[advance_1, passthrough_1],
        &[(vector, vector_account), (eoa_1, eoa_1_account)],
        &[Check::success()],
    );
    let advanced_vector = common::find_account(&result.resulting_accounts, &vector).clone();

    // The second, still signed against the now-stale nonce, can no longer
    // land: the on-chain digest recomputes against the *current* nonce,
    // which no longer matches what was signed.
    mollusk.process_and_validate_transaction_instructions(
        &[advance_2, passthrough_2],
        &[(vector, advanced_vector), (eoa_2, eoa_2_account)],
        &[Check::err(ProgramError::MissingRequiredSignature)],
    );
}
