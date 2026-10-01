//! Functional Requirement 2 — Concurrency
//! (`../../../requirements/nonce-replacement-spec.md`): one cold key holds
//! any number of outstanding pre-signed transactions by giving each its own
//! nonce account, all under the same programmatic signer. Ordered batches
//! can instead share one nonce account as a hashchain.

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
fn nonce_accounts_under_one_authority_land_in_any_order() {
    let cold = common::cold_key(20);
    let pda = programmatic_signer(&cold);
    let dest = Address::new_unique();
    let nonces: Vec<Address> = (0..3).map(|_| Address::new_unique()).collect();

    let ctx = context(
        nonces
            .iter()
            .map(|nonce| (*nonce, nonce_account(INITIAL_NONCE, &pda)))
            .chain([(pda, system_account(10_000_000))]),
    );

    // One signing session, three independent approvals.
    let presigned: Vec<_> = nonces
        .iter()
        .zip([1_000_000u64, 2_000_000, 3_000_000])
        .map(|(nonce, amount)| {
            presign(
                &cold,
                nonce,
                INITIAL_NONCE,
                &[transfer(&pda, &dest, amount)],
            )
        })
        .collect();

    // Landing order is the reverse of signing order.
    for (index, transaction) in presigned.iter().enumerate().rev() {
        ctx.process_and_validate_transaction_instructions(
            std::slice::from_ref(&transaction.submit),
            &[Check::success()],
            None,
        );
        assert_eq!(
            stored_nonce(&ctx, &nonces[index]),
            next_nonce(
                &nonces[index],
                INITIAL_NONCE,
                &transaction.execution_message
            )
        );
    }
    assert_eq!(lamports(&ctx, &dest), 6_000_000);
}

#[test]
fn two_transactions_on_one_nonce_account_are_mutually_exclusive() {
    let cold = common::cold_key(21);
    let pda = programmatic_signer(&cold);
    let nonce = Address::new_unique();
    let (dest_1, dest_2) = (Address::new_unique(), Address::new_unique());

    let ctx = context([
        (pda, system_account(10_000_000)),
        (nonce, nonce_account(INITIAL_NONCE, &pda)),
    ]);

    let candidate_1 = presign(
        &cold,
        &nonce,
        INITIAL_NONCE,
        &[transfer(&pda, &dest_1, 1_000_000)],
    );
    let candidate_2 = presign(
        &cold,
        &nonce,
        INITIAL_NONCE,
        &[transfer(&pda, &dest_2, 2_000_000)],
    );

    ctx.process_and_validate_transaction_instructions(
        &[candidate_1.submit],
        &[Check::success()],
        None,
    );
    ctx.process_and_validate_transaction_instructions(
        &[candidate_2.submit],
        &[Check::err(ExecutorError::NonceMismatch.into())],
        None,
    );
    assert_eq!(lamports(&ctx, &dest_1), 1_000_000);
    assert_eq!(lamports(&ctx, &dest_2), 0);
}

#[test]
fn a_presigned_chain_on_one_nonce_account_lands_only_in_order() {
    let cold = common::cold_key(22);
    let pda = programmatic_signer(&cold);
    let nonce = Address::new_unique();
    let dest = Address::new_unique();

    let ctx = context([
        (pda, system_account(10_000_000)),
        (nonce, nonce_account(INITIAL_NONCE, &pda)),
    ]);

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

    // The second link is not valid yet.
    ctx.process_and_validate_transaction_instructions(
        std::slice::from_ref(&second.submit),
        &[Check::err(ExecutorError::NonceMismatch.into())],
        None,
    );

    ctx.process_and_validate_transaction_instructions(&[first.submit], &[Check::success()], None);
    ctx.process_and_validate_transaction_instructions(&[second.submit], &[Check::success()], None);
    assert_eq!(lamports(&ctx, &dest), 3_000_000);
}
