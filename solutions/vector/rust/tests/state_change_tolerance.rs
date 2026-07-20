//! Functional Requirement 8 — State Change Tolerance
//! (`../../../requirements/nonce-replacement-spec.md`): no silent partial
//! execution. If the Passthrough's inner CPI fails, the whole transaction
//! — including the sibling `advance` that already ran — reverts atomically:
//! the nonce does not move and no lamports change hands.

mod common;

use mollusk_svm::result::Check;
use solana_account::Account;
use solana_address::Address;
use solana_program_error::ProgramError;
use vector_core::{
    create_passthrough_instruction, create_withdraw_subinstruction, ed25519_pubkey,
    find_vector_pda, sign_advance_instruction_ed25519, ED25519,
};

use common::{build_vector_account, mollusk, NONCE};

#[test]
fn a_failing_inner_cpi_reverts_the_advance_too() {
    let mollusk = mollusk();
    let key = common::signing_key(60);
    let pubkey = ed25519_pubkey(&key);
    let (vector, bump) = find_vector_pda(&ED25519, &pubkey);
    let rent_min = mollusk.sysvars.rent.minimum_balance(ED25519.account_len());
    let starting_lamports = rent_min + 5_000_000;
    let (eoa, eoa_account) = (
        Address::new_unique(),
        Account::new(0, 0, &Address::default()),
    );

    // A withdrawal larger than the PDA's entire balance: `checked_sub`
    // underflows on-chain regardless of the exact rent-exemption floor, so
    // this doesn't depend on rent-math parity between the host's
    // `solana_rent::Rent` and whatever the on-chain program's pinocchio
    // `Rent` sysvar resolves to (the two are not guaranteed to agree
    // bit-for-bit — pinocchio's compact rent sysvar is a single
    // pre-combined `lamports_per_byte` field, populated from the same
    // wire bytes host tooling reads as separate `lamports_per_byte_year` /
    // `exemption_threshold` fields).
    let over_the_limit = starting_lamports + 1;
    let withdraw_sub = create_withdraw_subinstruction(&ED25519, &pubkey, &eoa, over_the_limit);
    let passthrough_ix = create_passthrough_instruction(&ED25519, &pubkey, &[withdraw_sub]);
    let advance_ix = sign_advance_instruction_ed25519(
        &key,
        &NONCE,
        &[],
        std::slice::from_ref(&passthrough_ix),
    );

    let vector_account = build_vector_account(NONCE, bump, starting_lamports, &pubkey);
    let original_data = vector_account.data.clone();

    // `process_and_validate_transaction_instructions` runs both
    // instructions in one shared transaction context — the same atomicity
    // guarantee a real transaction gets. The advance instruction alone
    // would succeed; here it's asserted only that the *transaction* fails,
    // since a partial result (advance applied, passthrough reverted) would
    // be exactly the silent partial execution this requirement forbids.
    let result = mollusk.process_and_validate_transaction_instructions(
        &[advance_ix, passthrough_ix],
        &[(vector, vector_account), (eoa, eoa_account.clone())],
        &[Check::err(ProgramError::InsufficientFunds)],
    );

    let final_vector = common::find_account(&result.resulting_accounts, &vector);
    assert_eq!(
        final_vector.data, original_data,
        "nonce must not advance when the transaction as a whole fails"
    );
    assert_eq!(
        final_vector.lamports, starting_lamports,
        "no lamports may move when the transaction as a whole fails"
    );
    let final_eoa = common::find_account(&result.resulting_accounts, &eoa);
    assert_eq!(final_eoa.lamports, 0);
}

#[test]
fn the_same_shape_succeeds_atomically_within_the_limit() {
    let mollusk = mollusk();
    let key = common::signing_key(61);
    let pubkey = ed25519_pubkey(&key);
    let (vector, bump) = find_vector_pda(&ED25519, &pubkey);
    let rent_min = mollusk.sysvars.rent.minimum_balance(ED25519.account_len());
    let starting_lamports = rent_min + 5_000_000;
    let (eoa, eoa_account) = (
        Address::new_unique(),
        Account::new(0, 0, &Address::default()),
    );

    let within_limit = 5_000_000u64;
    let withdraw_sub = create_withdraw_subinstruction(&ED25519, &pubkey, &eoa, within_limit);
    let passthrough_ix = create_passthrough_instruction(&ED25519, &pubkey, &[withdraw_sub]);
    let advance_ix = sign_advance_instruction_ed25519(
        &key,
        &NONCE,
        &[],
        std::slice::from_ref(&passthrough_ix),
    );

    let vector_account = build_vector_account(NONCE, bump, starting_lamports, &pubkey);

    // Same instruction shape, an amount the PDA can afford: the
    // all-or-nothing boundary runs the other way — everything commits.
    mollusk.process_and_validate_transaction_instructions(
        &[advance_ix, passthrough_ix],
        &[(vector, vector_account), (eoa, eoa_account)],
        &[
            Check::success(),
            Check::account(&vector).lamports(rent_min).build(),
            Check::account(&eoa).lamports(within_limit).build(),
        ],
    );
}
