//! Functional Requirement 6 — No Onchain Footprint at Sign Time
//! (`../../../requirements/nonce-replacement-spec.md`): signing must not
//! rely on any onchain state update. This file never constructs a
//! `Mollusk` instance, never loads the program ELF, and never touches an
//! account: signing and offline verification are pure functions over
//! caller-supplied bytes.

mod common;

use vector_core::{
    advance_vector_digest, create_withdraw_subinstruction, ed25519_pubkey, revocation_digest,
    sign_advance_instruction_ed25519, sign_revocation_instruction_ed25519,
    verify_advance_signature_ed25519, ED25519,
};

use common::NONCE;

#[test]
fn signing_is_a_pure_function_of_its_inputs() {
    let key = common::signing_key(40);
    let pubkey = ed25519_pubkey(&key);
    let eoa = solana_address::Address::new_unique();
    let withdraw_sub = create_withdraw_subinstruction(&ED25519, &pubkey, &eoa, 42);

    // Two independent calls, identical inputs, no shared mutable state
    // (no RPC client, no ledger, no counter) — the outputs are
    // byte-for-byte identical, which would not hold if signing depended on
    // anything but the arguments in hand.
    let first = sign_advance_instruction_ed25519(&key, &NONCE, &[], std::slice::from_ref(&withdraw_sub));
    let second = sign_advance_instruction_ed25519(&key, &NONCE, &[], std::slice::from_ref(&withdraw_sub));
    assert_eq!(first.data, second.data);
    assert_eq!(first.accounts, second.accounts);
}

#[test]
fn verification_round_trips_fully_offline() {
    let key = common::signing_key(41);
    let pubkey = ed25519_pubkey(&key);
    let eoa = solana_address::Address::new_unique();
    let withdraw_sub = create_withdraw_subinstruction(&ED25519, &pubkey, &eoa, 7);

    let advance_ix = sign_advance_instruction_ed25519(
        &key,
        &NONCE,
        &[],
        std::slice::from_ref(&withdraw_sub),
    );
    // The 64-byte signature is everything after the 1-byte discriminator.
    let signature = &advance_ix.data[1..];

    let expected_digest =
        advance_vector_digest(&ED25519, &NONCE, &pubkey, &[], std::slice::from_ref(&withdraw_sub));

    // A custodian can validate a pre-signed payload — confirm it verifies,
    // and read off the nonce it would install — using only local data: the
    // identity, the nonce, the instruction list, and the signature. No
    // network call of any kind is reachable from this call.
    let verified_digest = verify_advance_signature_ed25519(
        &pubkey,
        &NONCE,
        &[],
        std::slice::from_ref(&withdraw_sub),
        None,
        signature,
    )
    .expect("offline verification of an honestly-signed advance must succeed");

    assert_eq!(verified_digest, expected_digest);
}

#[test]
fn revocation_is_equally_offline() {
    let key = common::signing_key(42);
    let pubkey = ed25519_pubkey(&key);

    let revocation_ix = sign_revocation_instruction_ed25519(&key, &NONCE);
    let signature = &revocation_ix.data[1..];
    let expected_digest = revocation_digest(&ED25519, &NONCE, &pubkey);

    let verified_digest =
        verify_advance_signature_ed25519(&pubkey, &NONCE, &[], &[], None, signature)
            .expect("offline verification of a revocation must succeed");

    assert_eq!(verified_digest, expected_digest);
}
