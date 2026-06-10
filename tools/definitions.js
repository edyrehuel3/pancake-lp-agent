export const tools = [
  {
    type: "function",
    function: {
      name: "discover_pools",
      description: "Discover top PancakeSwap v3 pools from subgraph. Returns pools with TVL, volume, fee tier, and 24h metrics.",
      parameters: { type: "object", properties: { page_size: { type: "number", description: "Number of pools (default 50)" } } }
    }
  },
  {
    type: "function",
    function: {
      name: "get_top_candidates",
      description: "Get pre-filtered top pool candidates ranked by score.",
      parameters: { type: "object", properties: { limit: { type: "number", description: "Number of candidates (default 5)" } } }
    }
  },
  {
    type: "function",
    function: {
      name: "get_pool_detail",
      description: "Get detailed on-chain data for a specific pool address.",
      parameters: { type: "object", properties: { pool_address: { type: "string", description: "Pool contract address" }, timeframe: { type: "string", enum: ["1h", "4h", "24h"] } }, required: ["pool_address"] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_my_positions",
      description: "List all open PancakeSwap v3 LP positions.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_position_pnl",
      description: "Get PnL data for a position. Returns current value, fees, and range status.",
      parameters: { type: "object", properties: { pool_address: { type: "string" }, position_address: { type: "string" } }, required: ["pool_address", "position_address"] }
    }
  },
  {
    type: "function",
    function: {
      name: "deploy_position",
      description: "Open a new PancakeSwap v3 LP position. Requires pool address, price range, and amounts.",
      parameters: {
        type: "object",
        properties: {
          pool_address: { type: "string", description: "Pool address" },
          token0: { type: "string", description: "Token0 mint address" },
          token1: { type: "string", description: "Token1 mint address" },
          fee_tier: { type: "number", description: "Fee tier (500=0.05%, 2500=0.25%, 10000=1%)" },
          price_lower: { type: "number", description: "Lower price boundary" },
          price_upper: { type: "number", description: "Upper price boundary" },
          amount0: { type: "number", description: "Amount of token0 to deposit" },
          amount1: { type: "number", description: "Amount of token1 to deposit" },
        },
        required: ["pool_address", "price_lower", "price_upper"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "close_position",
      description: "Close a PancakeSwap v3 LP position, withdraw all liquidity, and collect fees.",
      parameters: { type: "object", properties: { position_address: { type: "string", description: "Position token ID" }, reason: { type: "string", description: "Why closing" } }, required: ["position_address"] }
    }
  },
  {
    type: "function",
    function: {
      name: "claim_fees",
      description: "Claim accumulated fees from a position.",
      parameters: { type: "object", properties: { position_address: { type: "string" } }, required: ["position_address"] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_wallet_balance",
      description: "Get wallet BNB and token balances.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "swap_token",
      description: "Swap tokens via PancakeSwap router.",
      parameters: { type: "object", properties: { input_mint: { type: "string" }, output_mint: { type: "string" }, amount: { type: "number" } }, required: ["input_mint", "output_mint", "amount"] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_token_info",
      description: "Get token info from on-chain and DexScreener.",
      parameters: { type: "object", properties: { query: { type: "string", description: "Token address or symbol" } }, required: ["query"] }
    }
  },
  {
    type: "function",
    function: {
      name: "search_pools",
      description: "Search for pools by token symbol or address.",
      parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_top_lpers",
      description: "Study top LPers in a pool.",
      parameters: { type: "object", properties: { pool_address: { type: "string" } }, required: ["pool_address"] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_performance_history",
      description: "View closed position performance.",
      parameters: { type: "object", properties: { hours: { type: "number" }, limit: { type: "number" } } }
    }
  },
  {
    type: "function",
    function: {
      name: "get_pool_memory",
      description: "Check deploy history for a pool.",
      parameters: { type: "object", properties: { pool_address: { type: "string" } }, required: ["pool_address"] }
    }
  },
  {
    type: "function",
    function: {
      name: "add_lesson",
      description: "Save a lesson to memory.",
      parameters: { type: "object", properties: { rule: { type: "string" }, tags: { type: "array", items: { type: "string" } }, pinned: { type: "boolean" } }, required: ["rule"] }
    }
  },
  {
    type: "function",
    function: {
      name: "update_config",
      description: "Update configuration at runtime.",
      parameters: { type: "object", properties: { changes: { type: "object" }, reason: { type: "string" } }, required: ["changes"] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_recent_decisions",
      description: "Get recent deploy/close decisions.",
      parameters: { type: "object", properties: { limit: { type: "number" } } }
    }
  },
  {
    type: "function",
    function: {
      name: "set_price_trigger",
      description: "Set a price trigger on a position. When price hits your target, the management agent will close the position automatically. Example: close BTCB position if price drops below 64000 USDT.",
      parameters: {
        type: "object",
        properties: {
          position_address: { type: "string", description: "Position token ID" },
          price: { type: "number", description: "Trigger price" },
          direction: { type: "string", enum: ["below", "above"], description: "Close if price goes below or above this price" },
          pair: { type: "string", description: "e.g. BTCB/USDT" },
        },
        required: ["position_address", "price", "direction"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_price_triggers",
      description: "Check all price triggers and return which ones have been hit.",
      parameters: { type: "object", properties: {} }
    }
  },
];
