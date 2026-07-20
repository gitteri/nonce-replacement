//! Functional Requirement 9 — Composability
//! (`../../../requirements/nonce-replacement-spec.md`): Vector must work
//! with existing token infrastructure via Passthrough, not a bespoke
//! integration. Mirrors Vector's own `run_round_trip_spl` /
//! `advance_round_trips_spl_mint_authority`: the vector PDA temporarily
//! holds SPL mint authority, mints, then hands authority back — all
//! authorised by a single signed `advance`.
//!
//! Known gap: there is no wallet-standard integration for Vector today
//! (the spec's "ideally includes... wallet standard" is unmet) — a
//! custodian must drive `advance`/`passthrough` construction directly
//! through `vector-core` rather than through a wallet-adapter connection.

mod common;

use mollusk_svm::result::Check;
use mollusk_svm_programs_token::token::{self, keyed_account};
use solana_account::Account;
use solana_address::Address;
use solana_program_option::COption;
use solana_program_pack::Pack;
use spl_token_interface::{
    instruction::{mint_to, set_authority, AuthorityType},
    state::{Account as TokenAccount, AccountState, Mint},
};
use vector_core::{
    advance_vector_digest, create_passthrough_instruction, ed25519_pubkey, find_vector_pda,
    sign_advance_instruction_ed25519, ED25519,
};

use common::{build_vector_account, expected_advanced_data, mollusk, NONCE};

#[test]
fn passthrough_round_trips_spl_mint_authority() {
    let mut mollusk = mollusk();
    token::add_program(&mut mollusk);
    mollusk.compute_budget.compute_unit_limit = 1_400_000;

    let key = common::signing_key(70);
    let pubkey = ed25519_pubkey(&key);
    let (vector, bump) = find_vector_pda(&ED25519, &pubkey);
    let vector_account = build_vector_account(
        NONCE,
        bump,
        mollusk.sysvars.rent.minimum_balance(ED25519.account_len()),
        &pubkey,
    );

    let (token_program, token_program_account) = keyed_account();
    let (eoa, eoa_account) = (
        Address::new_unique(),
        Account::new(10_000_000_000, 0, &Address::default()),
    );

    let (mint, mint_account) = (
        Address::new_unique(),
        token::create_account_for_mint(Mint {
            mint_authority: COption::Some(vector),
            supply: 0,
            decimals: 6,
            is_initialized: true,
            freeze_authority: COption::None,
        }),
    );
    let (destination, destination_account) = (
        Address::new_unique(),
        token::create_account_for_token_account(TokenAccount {
            mint,
            owner: Address::new_unique(),
            amount: 0,
            delegate: COption::None,
            state: AccountState::Initialized,
            is_native: COption::None,
            delegated_amount: 0,
            close_authority: COption::None,
        }),
    );

    // Hand mint authority to the EOA, mint, then hand it back — the
    // middle instruction runs as a plain top-level ix (no PDA authority
    // needed); only the two authority handoffs need the PDA's signature,
    // and only the first of those runs inside Passthrough (the return
    // handoff is signed by the EOA, also a plain top-level ix).
    let pda_to_eoa_ix = set_authority(
        &token::ID,
        &mint,
        Some(&eoa),
        AuthorityType::MintTokens,
        &vector,
        &[],
    )
    .unwrap();
    let mint_to_ix = mint_to(&token::ID, &mint, &destination, &eoa, &[], 10_000).unwrap();
    let eoa_to_pda_ix = set_authority(
        &token::ID,
        &mint,
        Some(&vector),
        AuthorityType::MintTokens,
        &eoa,
        &[],
    )
    .unwrap();

    let passthrough_ix = create_passthrough_instruction(&ED25519, &pubkey, &[pda_to_eoa_ix.clone()]);
    let post_ixs = [passthrough_ix.clone(), mint_to_ix.clone(), eoa_to_pda_ix.clone()];
    let advance_ix = sign_advance_instruction_ed25519(&key, &NONCE, &[], &post_ixs);
    let next_nonce = advance_vector_digest(&ED25519, &NONCE, &pubkey, &[], &post_ixs);
    let expected_vector_data = expected_advanced_data(next_nonce, bump, &pubkey);

    let accounts = vec![
        (vector, vector_account),
        (token_program, token_program_account),
        (mint, mint_account),
        (destination, destination_account),
        (eoa, eoa_account),
    ];

    let mut expected_mint_data = vec![0u8; Mint::LEN];
    Mint::pack(
        Mint {
            mint_authority: COption::Some(vector),
            supply: 10_000,
            decimals: 6,
            is_initialized: true,
            freeze_authority: COption::None,
        },
        &mut expected_mint_data,
    )
    .unwrap();

    mollusk.process_and_validate_instruction_chain(
        &[
            (
                &advance_ix,
                &[
                    Check::success(),
                    Check::account(&vector).data(&expected_vector_data).build(),
                ],
            ),
            (&passthrough_ix, &[Check::success()]),
            (&mint_to_ix, &[Check::success()]),
            (
                &eoa_to_pda_ix,
                &[
                    Check::success(),
                    Check::account(&mint).data(&expected_mint_data).build(),
                ],
            ),
        ],
        &accounts,
    );
}
