//! Functional Requirement 6 — No Onchain Footprint at Sign Time
//! (`../../../requirements/nonce-replacement-spec.md`): signing must not
//! rely on any onchain state update. Signing is a pure function of the cold
//! key, the nonce value and the payload, and successor nonces are computed
//! offline, so a whole chain can be signed before anything lands.

mod common;

use mollusk_svm::result::Check;
use solana_address::Address;
use solana_system_interface::instruction::transfer;

use common::{
    context, lamports, next_nonce, nonce_account, presign, programmatic_signer, system_account,
    INITIAL_NONCE,
};

#[test]
fn signing_is_a_pure_function_of_its_inputs() {
    let cold = common::cold_key(60);
    let pda = programmatic_signer(&cold);
    let nonce = Address::new_from_array([7; 32]);
    let dest = Address::new_from_array([8; 32]);
    let payload = [transfer(&pda, &dest, 42)];

    // No Mollusk, no accounts: two independent calls produce identical bytes
    // (Ed25519 signatures are deterministic).
    let a = presign(&cold, &nonce, INITIAL_NONCE, &payload);
    let b = presign(&cold, &nonce, INITIAL_NONCE, &payload);
    assert_eq!(a.submit, b.submit);

    let after_a = next_nonce(&nonce, INITIAL_NONCE, &a.execution_message);
    assert_eq!(
        after_a,
        next_nonce(&nonce, INITIAL_NONCE, &b.execution_message)
    );
    assert_ne!(after_a, INITIAL_NONCE);
}

#[test]
fn a_chain_signed_entirely_offline_lands_later() {
    let cold = common::cold_key(61);
    let pda = programmatic_signer(&cold);
    let nonce = Address::new_unique();
    let dest = Address::new_unique();

    // Sign five links before any chain state exists.
    let mut current = INITIAL_NONCE;
    let chain: Vec<_> = (1..=5u64)
        .map(|step| {
            let link = presign(
                &cold,
                &nonce,
                current,
                &[transfer(&pda, &dest, step * 100_000)],
            );
            current = next_nonce(&nonce, current, &link.execution_message);
            link
        })
        .collect();

    // Only now does the nonce account exist onchain.
    let ctx = context([
        (pda, system_account(10_000_000)),
        (nonce, nonce_account(INITIAL_NONCE, &pda)),
    ]);
    for link in chain {
        ctx.process_and_validate_transaction_instructions(
            &[link.submit],
            &[Check::success()],
            None,
        );
    }
    assert_eq!(lamports(&ctx, &dest), 1_500_000);
    assert_eq!(common::stored_nonce(&ctx, &nonce), current);
}
