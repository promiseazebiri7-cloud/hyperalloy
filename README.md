# Hyperalloy

**One token that holds a basket of tokenized real-world assets.**

> **Status: testnet prototype. Not audited. Do not use with real money.**
> Everything here runs on Arbitrum Sepolia with worthless test tokens.

Live demo: https://hyperalloy.vercel.app

## What it is

You deposit tokenized assets into a shared vault and get HALLOY back. HALLOY is your share of the whole basket. Burn it later and you get your share out.

Hyperalloy is a protocol, not a product for specific tokens. Any token can be added if it passes the admission rules below.

## The problem it tackles

Many tokenized real-world assets sit idle. Pooling them does not make them easy to sell, so HALLOY can trade below the basket's real value (its NAV). The stablecoin buffer, fee curve, trading pool and in-kind redemption are there to limit this. They reduce the problem. They do not remove it.

## How it is designed

- **One basket, one token.** One HALLOY and one trading pool. No extra baskets in version 1.
- **Fair minting.** New shares are priced from the vault's current value, so late depositors are not treated worse than early ones. A small block of starting shares is locked forever to stop first-depositor tricks.
- **Asset Registry.** A separate contract (it holds no funds) stores the rules for each token: status, haircut, cap, price source, max price age, issuer and a gated flag. Making a rule stricter is instant. Making it looser waits for a delay. Tokens are never deleted, only set to withdraw-only.
- **Admission rules.** Legal fit, normal token behavior and a trusted price must pass. Freeze risk and exit depth set a token's cap and haircut.
- **Prices.** One direct Chainlink-style feed per token. Zero prices are rejected. Each asset has its own max price age. When a price is too old, only that asset's deposits stop. Withdrawals are never blocked by a stale price.
- **NAV.** The vault's own estimate of what one HALLOY is worth, with a stale-price flag. It is an estimate, not a promise of a sale price.
- **Target weights.** Soft targets with balancing fees, plus caps. The vault never buys or sells assets by itself.
- **Stablecoin buffer.** Target 25%, floor 15%, across more than one stablecoin with a cap per issuer.
- **Redemption.** In kind: you receive a slice of every asset. A token that cannot be sent to you (for example a gated one) is skipped and kept as a claim you can collect later.
- **Gated tokens.** Allowed, but only active after the issuer approves the vault.
- **Safety basics.** Reentrancy guard, safe transfers, events on every action, tests written first.

The weights, caps and haircuts are starting points, not proven numbers.

## Status

- [x] v0 prototype: mock real estate token, mock gold token, vault (deposit, basket view, withdraw)
- [x] Deployed to Arbitrum Sepolia
- [x] Frontend (deposit, basket view, withdraw)
- [x] Foundry project set up for tests
- [ ] Asset Registry
- [ ] Fair share-price minting
- [ ] Price checks and NAV
- [ ] Stablecoin buffer and balancing fees
- [ ] In-kind redemption with claims
- [ ] Test suite and attack tests
- [ ] Audit and legal review (required before mainnet)

## Roadmap

1. Registry, fair minting, safety basics, tests
2. Fresh-price rule, price feeds, NAV
3. Stablecoin buffer, in-kind redemption, trading pool, target weights
4. Per-asset markets, lending collateral, issuer partnerships
5. Audit and legal review

Mainnet (Arbitrum One) comes only after an audit.

## v0 contracts (Arbitrum Sepolia, chain ID 421614)

| Contract | Address |
| --- | --- |
| Mock real estate token | `0x38313e719ffE9C3bC03C2aaA79782078e1ca06eE` |
| Mock gold token | `0xae7Bdf612A4e7da53f467888659ADcC3A74d5A70` |
| HyperalloyVault (also the HALLOY token) | `0xf22e28b426b3f3cf0FA1143b9470D5d265f68252` |

v0 is an early prototype with known flaws: asset values are set by hand, minting is not share-price based, and it has no reentrancy guard, safe transfers, events or tests. The mock real estate token is retired from the plan.

## Repo layout

- `frontend/`: plain HTML pages, `styles.css`, `script.js`, `config.js`, `abi/`. Uses ethers v6.
- `contracts/`: Foundry project for the new vault and its tests.
- Root `.sol` files: the v0 contracts, deployed with Remix.

## Tech

Solidity, OpenZeppelin, Foundry (tests), Remix (deploys), ethers v6, Arbitrum Sepolia. Chainlink-style price feeds are planned.

## Risks, plainly

- HALLOY can trade below NAV.
- Any token can be frozen by its issuer, including large stablecoins.
- One shared basket means one bad asset affects every holder.
- Some assets are gated, and HALLOY trades freely. This needs legal advice before mainnet.
- Prices from market-based feeds can go quiet when markets are closed.
- No audit yet.

## Background

Started at the Arbitrum Open House Singapore 2026 Buildathon.

## License

See the license file in this repo, if one has been added.