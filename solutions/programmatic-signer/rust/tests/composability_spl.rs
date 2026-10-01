//! Functional Requirement 9 — Composability
//! (`../../../requirements/nonce-replacement-spec.md`): the scheme must work
//! with existing token infrastructure. The programmatic signer owns a
//! standard SPL Token account and a plain `spl_token::transfer` runs as the
//! payload, invoked by Executor with the PDA promoted to signer.
//!
//! Known gaps: the payload runs at CPI depth 3 (Submit, Execute, payload),
//! which leaves less nesting room for programs that CPI further. The JS
//! client is unpublished and there is no wallet-standard integration.

mod common;

use std::collections::HashMap;

use mollusk_svm::result::Check;
use mollusk_svm_programs_token::token;
use solana_account::Account;
use solana_address::Address;
use solana_program_option::COption;
use solana_program_pack::Pack;
use spl_token_interface::{
    instruction::transfer as token_transfer,
    state::{Account as TokenAccount, AccountState, Mint},
};

use common::{nonce_account, presign, programmatic_signer, system_account, INITIAL_NONCE};

fn token_account(mint: Address, owner: Address, amount: u64) -> Account {
    token::create_account_for_token_account(TokenAccount {
        mint,
        owner,
        amount,
        delegate: COption::None,
        state: AccountState::Initialized,
        is_native: COption::None,
        delegated_amount: 0,
        close_authority: COption::None,
    })
}

fn token_amount(account: &Account) -> u64 {
    TokenAccount::unpack(&account.data).unwrap().amount
}

#[test]
fn an_spl_transfer_runs_as_the_payload() {
    let mut mollusk = common::mollusk();
    token::add_program(&mut mollusk);

    let cold = common::cold_key(90);
    let pda = programmatic_signer(&cold);
    let nonce = Address::new_unique();
    let (mint, source, destination) = (
        Address::new_unique(),
        Address::new_unique(),
        Address::new_unique(),
    );

    let ctx = mollusk.with_context(HashMap::from([
        (pda, system_account(0)),
        (nonce, nonce_account(INITIAL_NONCE, &pda)),
        (
            mint,
            token::create_account_for_mint(Mint {
                mint_authority: COption::None,
                supply: 1_000_000,
                decimals: 6,
                is_initialized: true,
                freeze_authority: COption::None,
            }),
        ),
        (source, token_account(mint, pda, 1_000_000)),
        (destination, token_account(mint, Address::new_unique(), 0)),
    ]));

    let payment = presign(
        &cold,
        &nonce,
        INITIAL_NONCE,
        &[token_transfer(&token::ID, &source, &destination, &pda, &[], 250_000).unwrap()],
    );
    ctx.process_and_validate_transaction_instructions(&[payment.submit], &[Check::success()], None);

    assert_eq!(token_amount(&common::account(&ctx, &source)), 750_000);
    assert_eq!(token_amount(&common::account(&ctx, &destination)), 250_000);
}
