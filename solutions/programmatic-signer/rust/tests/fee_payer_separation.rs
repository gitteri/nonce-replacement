//! Functional Requirement 3 — Fee-Payer Separation
//! (`../../../requirements/nonce-replacement-spec.md`): the signing
//! authority and the fee payer can be different keys, and the fee payer is
//! chosen at broadcast time, after signing.

mod common;

use mollusk_svm::result::Check;
use solana_address::Address;
use solana_signer::Signer;
use solana_system_interface::instruction::transfer;

use common::{
    context, lamports, nonce_account, presign, programmatic_signer, system_account, INITIAL_NONCE,
};

#[test]
fn submit_needs_no_signature_from_the_cold_side() {
    let cold = common::cold_key(30);
    let pda = programmatic_signer(&cold);
    let nonce = Address::new_unique();
    let dest = Address::new_unique();

    let withdraw = presign(
        &cold,
        &nonce,
        INITIAL_NONCE,
        &[transfer(&pda, &dest, 1_000_000)],
    );

    // Every account on Submit is unsigned, the cold key included. The only
    // signature a relayer adds is its own, as fee payer.
    assert!(withdraw.submit.accounts.iter().all(|meta| !meta.is_signer));
    assert!(withdraw
        .submit
        .accounts
        .iter()
        .any(|meta| meta.pubkey == cold.pubkey()));
}

#[test]
fn any_relayer_can_land_the_same_signed_bytes() {
    let cold = common::cold_key(31);
    let pda = programmatic_signer(&cold);
    let nonce = Address::new_unique();
    let dest = Address::new_unique();

    let withdraw = presign(
        &cold,
        &nonce,
        INITIAL_NONCE,
        &[transfer(&pda, &dest, 1_000_000)],
    );

    // Two relayers that never existed at signing time. Neither key appears
    // in the signed Submit, and either one can broadcast it as fee payer.
    for relayer in [Address::new_unique(), Address::new_unique()] {
        assert!(!withdraw
            .submit
            .accounts
            .iter()
            .any(|meta| meta.pubkey == relayer));

        let ctx = context([
            (pda, system_account(10_000_000)),
            (nonce, nonce_account(INITIAL_NONCE, &pda)),
            (relayer, system_account(1_000_000_000)),
        ]);
        ctx.process_and_validate_transaction_instructions(
            std::slice::from_ref(&withdraw.submit),
            &[Check::success()],
            Some(&relayer),
        );
        assert_eq!(lamports(&ctx, &dest), 1_000_000);
        assert_eq!(lamports(&ctx, &pda), 9_000_000);
    }
}
