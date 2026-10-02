//! Functional Requirement 8 — State Change Tolerance
//! (`../../../requirements/nonce-replacement-spec.md`): no silent partial
//! execution. Executor advances the nonce before running the payload, but
//! the advance, every payload CPI and Submit itself are one transaction, so
//! a failing payload reverts all of it. The nonce is not burned and the
//! same signed bytes land once the state allows it.

mod common;

use mollusk_svm::result::Check;
use solana_address::Address;
use solana_program_error::ProgramError;
use solana_system_interface::{error::SystemError, instruction::transfer};

use common::{
    context, lamports, next_nonce, nonce_account, presign, programmatic_signer, stored_nonce,
    system_account, INITIAL_NONCE,
};

#[test]
fn a_failing_payload_reverts_the_advance_and_can_be_retried() {
    let cold = common::cold_key(80);
    let pda = programmatic_signer(&cold);
    let nonce = Address::new_unique();
    let (dest_1, dest_2) = (Address::new_unique(), Address::new_unique());

    let ctx = context([
        (pda, system_account(3_000_000)),
        (nonce, nonce_account(INITIAL_NONCE, &pda)),
    ]);

    // The first transfer is affordable, the second is not yet.
    let batch = presign(
        &cold,
        &nonce,
        INITIAL_NONCE,
        &[
            transfer(&pda, &dest_1, 1_000_000),
            transfer(&pda, &dest_2, 5_000_000),
        ],
    );

    ctx.process_and_validate_transaction_instructions(
        std::slice::from_ref(&batch.submit),
        &[Check::err(ProgramError::Custom(
            SystemError::ResultWithNegativeLamports as u32,
        ))],
        None,
    );
    assert_eq!(stored_nonce(&ctx, &nonce), INITIAL_NONCE);
    assert_eq!(lamports(&ctx, &dest_1), 0);
    assert_eq!(lamports(&ctx, &pda), 3_000_000);

    // Top up, then land the exact same bytes.
    ctx.account_store
        .borrow_mut()
        .get_mut(&pda)
        .unwrap()
        .lamports = 10_000_000;
    ctx.process_and_validate_transaction_instructions(&[batch.submit], &[Check::success()], None);
    assert_eq!(lamports(&ctx, &dest_1), 1_000_000);
    assert_eq!(lamports(&ctx, &dest_2), 5_000_000);
    assert_eq!(
        stored_nonce(&ctx, &nonce),
        next_nonce(&nonce, INITIAL_NONCE, &batch.execution_message)
    );
}
