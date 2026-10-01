//! Functional Requirement 1 — Sign-to-Broadcast Time Window
//! (`../../../requirements/nonce-replacement-spec.md`): a signed transaction
//! stays valid until its nonce advances. Neither Signer nor Executor reads
//! the clock, so landing it a year of slots later works the same.

mod common;

use std::collections::HashMap;

use mollusk_svm::result::Check;
use solana_address::Address;
use solana_system_interface::instruction::transfer;

use common::{
    lamports, nonce_account, presign, programmatic_signer, system_account, INITIAL_NONCE,
};

const SLOTS_PER_YEAR: u64 = 365 * 24 * 60 * 60 * 1000 / 400;

#[test]
fn a_year_old_signature_still_lands() {
    let cold = common::cold_key(10);
    let pda = programmatic_signer(&cold);
    let nonce = Address::new_unique();
    let dest = Address::new_unique();

    let withdraw = presign(
        &cold,
        &nonce,
        INITIAL_NONCE,
        &[transfer(&pda, &dest, 1_000_000)],
    );

    let mut mollusk = common::mollusk();
    mollusk.warp_to_slot(SLOTS_PER_YEAR);
    let ctx = mollusk.with_context(HashMap::from([
        (pda, system_account(10_000_000)),
        (nonce, nonce_account(INITIAL_NONCE, &pda)),
    ]));

    ctx.process_and_validate_transaction_instructions(
        &[withdraw.submit],
        &[Check::success()],
        None,
    );
    assert_eq!(lamports(&ctx, &dest), 1_000_000);
}
