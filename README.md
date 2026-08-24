# Hyperalloy

**Making idle, illiquid tokenized real-world assets useful again.**

## The Problem

Billions of dollars in tokenized real-world assets (real estate, private credit, commodities, and more) now exist on Arbitrum — but most sit idle. Verified examples show tokenized assets worth over $2M held by a single wallet, with zero secondary market to trade against. Tokenization alone doesn't create liquidity.

## What Hyperalloy Does

Hyperalloy pools idle, illiquid tokenized real-world assets into algorithmically-managed, diversified baskets — turning individually untradeable assets into one easier-to-trade digital product.

- **Automated asset intake** — assets are deposited, valued via oracle/appraisal data, and locked into vault contracts, fully permissionless
- **Algorithmic basket formation** — assets are clustered by risk/correlation, not manually curated
- **Independent withdrawal** — asset owners can always redeem their share; nothing is permanently locked
- **Automated pricing** — starting value from appraisals + oracles, live price shaped by real trading and arbitrage
- **Automated rebalancing** — smart contracts keep baskets balanced as asset values shift

This isn't about making any single asset more valuable — it's about combining hard-to-trade assets into one easier-to-trade product that software can automatically manage, making previously idle value useful again.

## Current Status

🚧 **Early-stage prototype** — building on Arbitrum Sepolia (testnet)

- [x] Mock Real Estate Token (ERC-20)
- [x] Mock Gold Token (ERC-20)
- [x] Vault contract (deposit / withdraw / basket minting)
- [ ] Deployment to Arbitrum Sepolia
- [ ] Chainlink oracle integration
- [ ] Frontend (deposit, basket view, withdraw)

## Tech Stack

- **Solidity** + **OpenZeppelin** — smart contracts
- **Remix IDE** — development environment
- **Arbitrum Sepolia** — testnet deployment
- **Chainlink** (planned) — price oracles
- **Next.js + Tailwind** (planned) — frontend

## Built For

Arbitrum Open House Singapore 2026 Buildathon

## Contracts

- `RealEstateToken.sol` — mock tokenized real estate asset
- `GoldToken.sol` — mock tokenized gold asset
- `HyperalloyVault.sol` — core vault contract combining assets into a basket token