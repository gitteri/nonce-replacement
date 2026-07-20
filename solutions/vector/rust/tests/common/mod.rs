//! Shared Ed25519 mollusk-svm helpers, adapted from Vector's own
//! `tests/common.rs` (which is generic over all five signing schemes) down
//! to the single scheme these tests exercise.

use ed25519_dalek::SigningKey;
use mollusk_svm::Mollusk;
use solana_account::Account;
use solana_address::Address;
use vector_core::{VectorAccount, ED25519};

/// Initial nonce used across every test in this crate.
pub const NONCE: [u8; 32] = [0xff; 32];

/// A distinct, deterministic Ed25519 signing key per lane/identity: 31 zero
/// bytes followed by `marker`. Any 32 bytes are a valid ed25519-dalek seed.
pub fn signing_key(marker: u8) -> SigningKey {
    let mut seed = [0u8; 32];
    seed[31] = marker;
    SigningKey::from_bytes(&seed)
}

/// Fresh `Mollusk` loaded with the real Ed25519 program ELF built from
/// Vector's own source (`fixtures/vector_ed25519.so`, relative to this
/// crate's root — mollusk's default search path checks `tests/fixtures`
/// first, then falls back to the current working directory, which `cargo
/// test` sets to the crate root).
pub fn mollusk() -> Mollusk {
    Mollusk::new(&ED25519.program_id, "fixtures/vector_ed25519")
}

pub fn build_vector_account(nonce: [u8; 32], bump: u8, lamports: u64, pubkey: &[u8; 32]) -> Account {
    let mut data = Vec::with_capacity(ED25519.account_len());
    data.extend_from_slice(&VectorAccount { nonce, bump }.header_bytes());
    data.extend_from_slice(pubkey);
    Account {
        lamports,
        data,
        owner: ED25519.program_id,
        executable: false,
        rent_epoch: 0,
    }
}

pub fn expected_advanced_data(next_nonce: [u8; 32], bump: u8, pubkey: &[u8; 32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(ED25519.account_len());
    out.extend_from_slice(
        &VectorAccount {
            nonce: next_nonce,
            bump,
        }
        .header_bytes(),
    );
    out.extend_from_slice(pubkey);
    out
}

/// Look up an account by pubkey in a `resulting_accounts` list (shared
/// shape between mollusk's `InstructionResult` and `TransactionResult`;
/// only the former exposes a `get_account` helper).
pub fn find_account<'a>(accounts: &'a [(Address, Account)], pubkey: &Address) -> &'a Account {
    &accounts
        .iter()
        .find(|(k, _)| k == pubkey)
        .expect("account present in resulting_accounts")
        .1
}

pub fn account_data<'a>(accounts: &'a [(Address, Account)], pubkey: &Address) -> &'a [u8] {
    &find_account(accounts, pubkey).data
}
