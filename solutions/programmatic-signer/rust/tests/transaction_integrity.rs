//! Functional Requirement 4 — Transaction Integrity
//! (`../../../requirements/nonce-replacement-spec.md`): nothing the cold key
//! signed can be changed after signing. The signature covers the whole
//! authorization message, and Submit's accounts must match that message's
//! keys index for index.

mod common;

use mollusk_svm::result::Check;
use solana_address::Address;
use solana_instruction::Instruction;
use solana_system_interface::instruction::transfer;
use spl_ed25519_signer_interface::error::Error as SignerError;

use common::{
    context, lamports, nonce_account, presign, programmatic_signer, stored_nonce, system_account,
    Context, INITIAL_NONCE,
};

fn setup(marker: u8) -> (Context, Instruction, Address, Address) {
    let cold = common::cold_key(marker);
    let pda = programmatic_signer(&cold);
    let nonce = Address::new_unique();
    let dest = Address::new_unique();
    let ctx = context([
        (pda, system_account(10_000_000)),
        (nonce, nonce_account(INITIAL_NONCE, &pda)),
    ]);
    let withdraw = presign(
        &cold,
        &nonce,
        INITIAL_NONCE,
        &[transfer(&pda, &dest, 1_000_000)],
    );
    (ctx, withdraw.submit, nonce, dest)
}

#[test]
fn changing_the_signed_amount_fails_signature_verification() {
    let (ctx, mut submit, nonce, dest) = setup(40);

    let amount = 1_000_000u64.to_le_bytes();
    let offset = submit
        .data
        .windows(amount.len())
        .position(|window| window == amount)
        .expect("transfer amount inside the signed message");
    submit.data[offset..offset + amount.len()].copy_from_slice(&9_000_000u64.to_le_bytes());

    ctx.process_and_validate_transaction_instructions(
        &[submit],
        &[Check::err(SignerError::InvalidSignature.into())],
        None,
    );
    assert_eq!(lamports(&ctx, &dest), 0);
    assert_eq!(stored_nonce(&ctx, &nonce), INITIAL_NONCE);
}

#[test]
fn redirecting_an_account_fails_the_key_match() {
    let (ctx, mut submit, nonce, dest) = setup(41);

    let attacker = Address::new_unique();
    let meta = submit
        .accounts
        .iter_mut()
        .find(|meta| meta.pubkey == dest)
        .expect("destination on Submit");
    meta.pubkey = attacker;

    ctx.process_and_validate_transaction_instructions(
        &[submit],
        &[Check::err(SignerError::AccountKeyMismatch.into())],
        None,
    );
    assert_eq!(lamports(&ctx, &attacker), 0);
    assert_eq!(stored_nonce(&ctx, &nonce), INITIAL_NONCE);
}

#[test]
fn the_untouched_bytes_still_land() {
    let (ctx, submit, _, dest) = setup(42);
    ctx.process_and_validate_transaction_instructions(&[submit], &[Check::success()], None);
    assert_eq!(lamports(&ctx, &dest), 1_000_000);
}
