# PancakeSwap LP Agent

Autonomous PancakeSwap v3 LP agent for BNB Chain, powered by LLMs.

## Commands
- `npm start` - Run agent
- `npm run dev` - Dry run (no transactions)
- `node cli.js screen` - One screening cycle
- `node cli.js manage` - One management cycle
- `node cli.js candidates` - List top pools
- `node cli.js balance` - Check balance
- `node cli.js positions` - List positions

## Setup
1. Copy `.env.example` to `.env` and fill in keys
2. Copy `user-config.example.json` to `user-config.json`
3. `npm install`
4. `npm start`

## Architecture
- `index.js` - Entry + REPL + cron
- `agent.js` - LLM ReAct loop
- `config.js` - Chain config + PancakeSwap addresses
- `tools/pancakeswap.js` - PancakeSwap v3 contract interactions
- `tools/screening.js` - Pool discovery via subgraph
- `tools/executor.js` - Tool dispatch + safety checks
- `state.js` - Position registry
- `lessons.js` - Learning engine
