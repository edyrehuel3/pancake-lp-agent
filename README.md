# PancakeSwap LP Agent

Autonomous PancakeSwap v3 liquidity management agent for BNB Chain, powered by LLMs.

**Forked from [Meridian](https://github.com/yunus-0x/meridian)** - adapted from Meteora DLMM (Solana) to PancakeSwap v3 (BNB Chain).

## What it does

- **Screens pools** - scans PancakeSwap v3 pools via subgraph against configurable thresholds (TVL, volume, fee tier, tx count)
- **Manages positions** - monitors, claims fees, and closes LP positions autonomously; decides to STAY, CLOSE, or REDEPLOY
- **Learns from performance** - saves structured lessons and evolves screening thresholds based on closed position history
- **LLM-powered** - uses OpenRouter with any compatible model via ReAct agent loop

## Requirements

- Node.js 18+
- [OpenRouter](https://openrouter.ai) API key
- EVM wallet private key (BNB Chain)
- BNB Chain RPC endpoint

## Setup

```bash
git clone https://github.com/edyrehuel3/pancake-lp-agent
cd pancake-lp-agent
npm install
npm run setup    # interactive wizard
```

Or manually:

```bash
cp .env.example .env
# Edit .env with your keys
cp user-config.example.json user-config.json
npm start
```

## Usage

```bash
npm run dev          # dry run - no on-chain transactions
npm start            # live mode
```

### CLI

```bash
node cli.js screen       # one AI screening cycle
node cli.js manage       # one AI management cycle
node cli.js candidates   # list top pools
node cli.js positions    # list open positions
node cli.js balance      # check wallet balance
node cli.js search BNB   # search pools by symbol
node cli.js chat "analyze my positions"
```

### REPL commands (in `npm start`)

| Command | Description |
|---|---|
| `/status` | Wallet balance + positions |
| `/positions` | List open positions |
| `/candidates` | Top pool candidates |
| `/screen` | Run screening now |
| `/manage` | Run management now |
| `/help` | Help |
| `/stop` | Shutdown |

## Architecture

```
index.js            Main entry: REPL + cron orchestration
agent.js            ReAct loop: LLM ? tool call ? repeat
config.js           Config + PancakeSwap addresses (BNB Chain)
prompt.js           System prompt builder (SCREENER/MANAGER/GENERAL)
state.js            Position registry
decision-log.js     Structured decision log
lessons.js          Learning engine + performance tracker
cli.js              CLI interface

tools/
  pancakeswap.js    PancakeSwap v3 contract interactions (NFPM, pools)
  screening.js      Pool discovery via subgraph
  token.js          Token research (DexScreener)
  definitions.js    Tool schemas for LLM
  executor.js       Tool dispatch + safety checks
```

## PancakeSwap v3 contracts (BNB Chain)

| Contract | Address |
|---|---|
| V3 Factory | `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865` |
| NFPM | `0x46A15B0b27311cedF172AB29A4fB6D9F7D4cB3C7` |
| Router | `0x1b81D678ffb9C0263b24A97847620C99d213eB14` |
| WBNB | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` |

## Disclaimer

This software is provided as-is, with no warranty. Running an autonomous trading agent carries real financial risk. Always start with `DRY_RUN=true`. Not financial advice.
