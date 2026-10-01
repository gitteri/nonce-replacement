//! Functional Requirement 5 — Selective Revocation
//! (`../../../requirements/nonce-replacement-spec.md`): revoking one
//! pre-signed transaction must not affect any other outstanding
//! transaction. Revocation is an Execute with an empty payload signed at
//! the outstanding nonce: it advances that nonce account with a different
//! commitment, so the transaction signed against it can never land.

mod common;

use mollusk_svm::result::Check;
use solana_address::Address;
use solana_system_interface::instruction::transfer;
use spl_message_executor_interface::error::Error as ExecutorError;

use common::{
    context, lamports, next_nonce, nonce_account, presign, programmatic_signer, stored_nonce,
    system_account, INITIAL_NONCE,
};

#[test]
fn revoking_one_nonce_account_leaves_the_others_outstanding() {
    let cold = common::cold_key(50);
    let pda = programmatic_signer(&cold);
    let (nonce_a, nonce_b) = (Address::new_unique(), Address::new_unique());
    let dest = Address::new_unique();

    let ctx = context([
        (pda, system_account(10_000_000)),
        (nonce_a, nonce_account(INITIAL_NONCE, &pda)),
        (nonce_b, nonce_account(INITIAL_NONCE, &pda)),
    ]);

    // Two withdrawals outstanding under the same cold key, one per nonce
    // account.
    let withdraw_a = presign(
        &cold,
        &nonce_a,
        INITIAL_NONCE,
        &[transfer(&pda, &dest, 1_000_000)],
    );
    let withdraw_b = presign(
        &cold,
        &nonce_b,
        INITIAL_NONCE,
        &[transfer(&pda, &dest, 2_000_000)],
    );

    // The revocation is signed offline exactly like any other transaction.
    let revoke_a = presign(&cold, &nonce_a, INITIAL_NONCE, &[]);
    let revoked_nonce = next_nonce(&nonce_a, INITIAL_NONCE, &revoke_a.execution_message);

    ctx.process_and_validate_transaction_instructions(
        &[revoke_a.submit],
        &[Check::success()],
        None,
    );
    assert_eq!(stored_nonce(&ctx, &nonce_a), revoked_nonce);
    assert_eq!(stored_nonce(&ctx, &nonce_b), INITIAL_NONCE);
    assert_eq!(lamports(&ctx, &pda), 10_000_000);

    // A's withdrawal is orphaned: the nonce it names is gone.
    ctx.process_and_validate_transaction_instructions(
        &[withdraw_a.submit],
        &[Check::err(ExecutorError::NonceMismatch.into())],
        None,
    );
    assert_eq!(lamports(&ctx, &dest), 0);

    // B lands exactly as it would have without the revocation.
    ctx.process_and_validate_transaction_instructions(
        &[withdraw_b.submit],
        &[Check::success()],
        None,
    );
    assert_eq!(lamports(&ctx, &dest), 2_000_000);
    assert_eq!(lamports(&ctx, &pda), 8_000_000);
}

#[test]
fn revocation_orphans_the_rest_of_a_presigned_chain() {
    let cold = common::cold_key(51);
    let pda = programmatic_signer(&cold);
    let nonce = Address::new_unique();
    let dest = Address::new_unique();

    let ctx = context([
        (pda, system_account(10_000_000)),
        (nonce, nonce_account(INITIAL_NONCE, &pda)),
    ]);

    // An ordered pair on one nonce account: the second is signed against
    // the value the first will leave behind.
    let first = presign(
        &cold,
        &nonce,
        INITIAL_NONCE,
        &[transfer(&pda, &dest, 1_000_000)],
    );
    let after_first = next_nonce(&nonce, INITIAL_NONCE, &first.execution_message);
    let second = presign(
        &cold,
        &nonce,
        after_first,
        &[transfer(&pda, &dest, 2_000_000)],
    );

    // Revoke at the head of the chain instead of landing `first`.
    let revoke = presign(&cold, &nonce, INITIAL_NONCE, &[]);
    ctx.process_and_validate_transaction_instructions(&[revoke.submit], &[Check::success()], None);

    for orphan in [first.submit, second.submit] {
        ctx.process_and_validate_transaction_instructions(
            &[orphan],
            &[Check::err(ExecutorError::NonceMismatch.into())],
            None,
        );
    }
    assert_eq!(lamports(&ctx, &dest), 0);
}
