//! Functional Requirement 3 — Fee-Payer Separation
//! (`../../../requirements/nonce-replacement-spec.md`): the signing
//! authority and the fee payer can be different keys, and fee-payer
//! selection can happen at broadcast time, after signing.

mod common;

use mollusk_svm::result::Check;
use solana_account::Account;
use solana_address::Address;
use vector_core::{
    advance_vector_digest, advance_vector_digest_with_fee_payer, create_withdraw_subinstruction,
    ed25519_pubkey, find_vector_pda, sign_advance_instruction_ed25519, ED25519,
};

use common::{account_data, build_vector_account, expected_advanced_data, mollusk, NONCE};

#[test]
fn digest_ignores_a_fee_payer_absent_from_the_instructions() {
    let key = common::signing_key(10);
    let pubkey = ed25519_pubkey(&key);
    let eoa = Address::new_unique();
    let withdraw_sub = create_withdraw_subinstruction(&ED25519, &pubkey, &eoa, 1_000);

    let plain = advance_vector_digest(&ED25519, &NONCE, &pubkey, &[], &[withdraw_sub.clone()]);

    // A fee payer that never appears among the instructions' accounts only
    // participates in message-level flag promotion for accounts that are
    // already referenced — with none referenced, promotion is a no-op and
    // the digest is identical.
    let unrelated_fee_payer = Address::new_unique();
    let with_unrelated_payer = advance_vector_digest_with_fee_payer(
        &ED25519,
        &NONCE,
        &pubkey,
        &[],
        &[withdraw_sub.clone()],
        Some(&unrelated_fee_payer),
    );
    assert_eq!(plain, with_unrelated_payer);

    // Contrast: a fee payer deliberately baked in as one of the withdraw's
    // own accounts (i.e. it IS the receiver) changes the digest, because
    // promotion now touches an account flag the buffer actually encodes.
    let with_baked_in_payer = advance_vector_digest_with_fee_payer(
        &ED25519,
        &NONCE,
        &pubkey,
        &[],
        &[withdraw_sub],
        Some(&eoa),
    );
    assert_ne!(plain, with_baked_in_payer);
}

#[test]
fn advance_lands_regardless_of_which_unrelated_account_is_present() {
    let mollusk = mollusk();
    let key = common::signing_key(11);
    let pubkey = ed25519_pubkey(&key);
    let (vector, bump) = find_vector_pda(&ED25519, &pubkey);
    let rent_min = mollusk.sysvars.rent.minimum_balance(ED25519.account_len());

    let advance_ix = sign_advance_instruction_ed25519(&key, &NONCE, &[], &[]);
    let next_nonce = advance_vector_digest(&ED25519, &NONCE, &pubkey, &[], &[]);
    let expected_data = expected_advanced_data(next_nonce, bump, &pubkey);

    // Two candidate "fee payers" for the same signed instruction — neither
    // is referenced by the advance ix's accounts, so mollusk's instructions
    // sysvar (built solely from the instructions passed in) never mentions
    // either. Landing succeeds identically no matter which is funding the
    // broadcast.
    for fee_payer_lamports in [1_000_000_000u64, 4_000_000_000u64] {
        let fee_payer = (
            Address::new_unique(),
            Account::new(fee_payer_lamports, 0, &Address::default()),
        );
        let vector_account = build_vector_account(NONCE, bump, rent_min, &pubkey);
        mollusk.process_and_validate_transaction_instructions(
            &[advance_ix.clone()],
            &[(vector, vector_account), fee_payer],
            &[
                Check::success(),
                Check::account(&vector).data(&expected_data).build(),
            ],
        );
    }
}

#[test]
fn same_signature_lands_under_two_different_fee_payers() {
    let mollusk = mollusk();
    let key = common::signing_key(12);
    let pubkey = ed25519_pubkey(&key);
    let (vector, bump) = find_vector_pda(&ED25519, &pubkey);
    let rent_min = mollusk.sysvars.rent.minimum_balance(ED25519.account_len());

    // The digest — and therefore the signature — is computed exactly once.
    let advance_ix = sign_advance_instruction_ed25519(&key, &NONCE, &[], &[]);
    let next_nonce = advance_vector_digest(&ED25519, &NONCE, &pubkey, &[], &[]);
    let expected_data = expected_advanced_data(next_nonce, bump, &pubkey);

    let fee_payer_a = (
        Address::new_unique(),
        Account::new(2_000_000_000, 0, &Address::default()),
    );
    let fee_payer_b = (
        Address::new_unique(),
        Account::new(9_000_000_000, 0, &Address::default()),
    );

    // "Broadcast" the identical signed instruction twice, once per
    // candidate fee payer, against two independent copies of the account.
    let vector_account_a = build_vector_account(NONCE, bump, rent_min, &pubkey);
    let result_a = mollusk.process_and_validate_transaction_instructions(
        &[advance_ix.clone()],
        &[(vector, vector_account_a), fee_payer_a],
        &[Check::success()],
    );

    let vector_account_b = build_vector_account(NONCE, bump, rent_min, &pubkey);
    let result_b = mollusk.process_and_validate_transaction_instructions(
        &[advance_ix],
        &[(vector, vector_account_b), fee_payer_b],
        &[Check::success()],
    );

    assert_eq!(account_data(&result_a.resulting_accounts, &vector), expected_data);
    assert_eq!(account_data(&result_b.resulting_accounts, &vector), expected_data);
}
