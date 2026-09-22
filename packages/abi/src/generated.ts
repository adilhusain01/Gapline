//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// AggregatorV3Interface
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const aggregatorV3InterfaceAbi = [
  {
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'description',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '_roundId', internalType: 'uint80', type: 'uint80' }],
    name: 'getRoundData',
    outputs: [
      { name: 'roundId', internalType: 'uint80', type: 'uint80' },
      { name: 'answer', internalType: 'int256', type: 'int256' },
      { name: 'startedAt', internalType: 'uint256', type: 'uint256' },
      { name: 'updatedAt', internalType: 'uint256', type: 'uint256' },
      { name: 'answeredInRound', internalType: 'uint80', type: 'uint80' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { name: 'roundId', internalType: 'uint80', type: 'uint80' },
      { name: 'answer', internalType: 'int256', type: 'int256' },
      { name: 'startedAt', internalType: 'uint256', type: 'uint256' },
      { name: 'updatedAt', internalType: 'uint256', type: 'uint256' },
      { name: 'answeredInRound', internalType: 'uint80', type: 'uint80' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// GapGuardedLendingPool
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * [__View Contract on Robinhood Chain Testnet Blockscout__](https://explorer.testnet.chain.robinhood.com/address/0x6BF25eC4CB7E909b181cc844b4642a84c2f9A850)
 */
export const gapGuardedLendingPoolAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'stock_', internalType: 'contract IERC20', type: 'address' },
      { name: 'usdg_', internalType: 'contract IERC20', type: 'address' },
      {
        name: 'oracle_',
        internalType: 'contract ImpliedPriceOracle',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'BPS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'HEDGE_BUDGET_BPS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'HEDGE_COVER_BPS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'LIQUIDATION_BONUS_BPS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'LIQUIDATION_THRESHOLD_BPS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MAX_LTV_BPS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'borrow',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'collateralOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'uint256', type: 'uint256' }],
    name: 'collectHedge',
    outputs: [{ name: 'payout', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'debtOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'deposit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'gapMarket',
    outputs: [
      { name: '', internalType: 'contract GapMarket', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'uint256', type: 'uint256' }],
    name: 'hedge',
    outputs: [
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
      { name: 'premium', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'uint256', type: 'uint256' }],
    name: 'hedgePremium',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'uint256', type: 'uint256' }],
    name: 'hedgeShares',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'user', internalType: 'address', type: 'address' }],
    name: 'isLiquidatable',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'user', internalType: 'address', type: 'address' },
      { name: 'repayAmount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'liquidate',
    outputs: [{ name: 'seized', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'liquidationPrice',
    outputs: [{ name: '', internalType: 'int256', type: 'int256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'user', internalType: 'address', type: 'address' }],
    name: 'maxBorrow',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
      { name: '', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'onERC1155BatchReceived',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'onERC1155Received',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'oracle',
    outputs: [
      {
        name: '',
        internalType: 'contract ImpliedPriceOracle',
        type: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'user', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'repay',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'riskPrice',
    outputs: [{ name: '', internalType: 'int256', type: 'int256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'stock',
    outputs: [{ name: '', internalType: 'contract IERC20', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'interfaceId', internalType: 'bytes4', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalDebt',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'usdg',
    outputs: [{ name: '', internalType: 'contract IERC20', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'user', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Borrowed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'user', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Deposited',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'marketId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'payout',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'HedgeCollected',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'marketId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'shares',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'premium',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'debtCovered',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Hedged',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'user', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'liquidator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'repaid',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'seized',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'priceUsed',
        internalType: 'int256',
        type: 'int256',
        indexed: false,
      },
    ],
    name: 'Liquidated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'user', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'payer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Repaid',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'user', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Withdrawn',
  },
  { type: 'error', inputs: [], name: 'AlreadyHedged' },
  { type: 'error', inputs: [], name: 'ExceedsLtv' },
  { type: 'error', inputs: [], name: 'Healthy' },
  { type: 'error', inputs: [], name: 'InsufficientLiquidity' },
  { type: 'error', inputs: [], name: 'NotActiveMarket' },
  { type: 'error', inputs: [], name: 'NothingToHedge' },
  { type: 'error', inputs: [], name: 'PricingPaused' },
  { type: 'error', inputs: [], name: 'ReentrancyGuardReentrantCall' },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
  },
] as const

/**
 * [__View Contract on Robinhood Chain Testnet Blockscout__](https://explorer.testnet.chain.robinhood.com/address/0x6BF25eC4CB7E909b181cc844b4642a84c2f9A850)
 */
export const gapGuardedLendingPoolAddress = {
  46630: '0x6BF25eC4CB7E909b181cc844b4642a84c2f9A850',
} as const

/**
 * [__View Contract on Robinhood Chain Testnet Blockscout__](https://explorer.testnet.chain.robinhood.com/address/0x6BF25eC4CB7E909b181cc844b4642a84c2f9A850)
 */
export const gapGuardedLendingPoolConfig = {
  address: gapGuardedLendingPoolAddress,
  abi: gapGuardedLendingPoolAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// GapMarket
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * [__View Contract on Robinhood Chain Testnet Blockscout__](https://explorer.testnet.chain.robinhood.com/address/0x44540A78c4006897109b33A60d89E4a5522CC4dB)
 */
export const gapMarketAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'collateral_', internalType: 'contract IERC20', type: 'address' },
      {
        name: 'calendar_',
        internalType: 'contract MarketCalendar',
        type: 'address',
      },
      { name: 'feeBps_', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MAX_FEE_BPS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MAX_OUTCOMES',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MAX_SETTLE_DELAY',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MIN_OUTCOMES',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'id', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'accounts', internalType: 'address[]', type: 'address[]' },
      { name: 'ids', internalType: 'uint256[]', type: 'uint256[]' },
    ],
    name: 'balanceOfBatch',
    outputs: [{ name: '', internalType: 'uint256[]', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'marketId', internalType: 'uint256', type: 'uint256' },
      { name: 'outcome', internalType: 'uint8', type: 'uint8' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
      { name: 'maxCost', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'buy',
    outputs: [{ name: 'cost', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'calendar',
    outputs: [
      { name: '', internalType: 'contract MarketCalendar', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'uint256', type: 'uint256' }],
    name: 'claimFees',
    outputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'collateral',
    outputs: [{ name: '', internalType: 'contract IERC20', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'feed',
        internalType: 'contract AggregatorV3Interface',
        type: 'address',
      },
      { name: 'boundariesBps', internalType: 'int256[]', type: 'int256[]' },
      { name: 'liquidity', internalType: 'uint256', type: 'uint256' },
      { name: 'tailWidthBps', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'createMarket',
    outputs: [{ name: 'marketId', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'exists',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'feeBps',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'uint256', type: 'uint256' }],
    name: 'getMarket',
    outputs: [
      {
        name: '',
        internalType: 'struct GapMarket.Market',
        type: 'tuple',
        components: [
          {
            name: 'feed',
            internalType: 'contract AggregatorV3Interface',
            type: 'address',
          },
          { name: 'creator', internalType: 'address', type: 'address' },
          { name: 'closeTs', internalType: 'uint64', type: 'uint64' },
          { name: 'reopenTs', internalType: 'uint64', type: 'uint64' },
          { name: 'refPrice', internalType: 'int256', type: 'int256' },
          { name: 'liquidity', internalType: 'int256', type: 'int256' },
          { name: 'tailWidthBps', internalType: 'int256', type: 'int256' },
          { name: 'boundariesBps', internalType: 'int256[]', type: 'int256[]' },
          { name: 'shares', internalType: 'int256[]', type: 'int256[]' },
          { name: 'collateralHeld', internalType: 'uint256', type: 'uint256' },
          { name: 'feesAccrued', internalType: 'uint256', type: 'uint256' },
          { name: 'resolved', internalType: 'bool', type: 'bool' },
          { name: 'winner', internalType: 'uint8', type: 'uint8' },
          { name: 'settlePrice', internalType: 'int256', type: 'int256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'uint256', type: 'uint256' }],
    name: 'impliedMove',
    outputs: [
      { name: 'meanBps', internalType: 'int256', type: 'int256' },
      { name: 'stdevBps', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'operator', internalType: 'address', type: 'address' },
    ],
    name: 'isApprovedForAll',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'marketCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'uint256', type: 'uint256' }],
    name: 'prices',
    outputs: [{ name: 'p', internalType: 'uint256[]', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'marketId', internalType: 'uint256', type: 'uint256' },
      { name: 'outcome', internalType: 'uint8', type: 'uint8' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'quoteBuy',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'marketId', internalType: 'uint256', type: 'uint256' },
      { name: 'outcome', internalType: 'uint8', type: 'uint8' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'quoteSell',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'uint256', type: 'uint256' }],
    name: 'redeem',
    outputs: [{ name: 'payout', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'marketId', internalType: 'uint256', type: 'uint256' },
      { name: 'roundId', internalType: 'uint80', type: 'uint80' },
    ],
    name: 'resolve',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'ids', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'values', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'safeBatchTransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'id', internalType: 'uint256', type: 'uint256' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'safeTransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'marketId', internalType: 'uint256', type: 'uint256' },
      { name: 'outcome', internalType: 'uint8', type: 'uint8' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
      { name: 'minReturn', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'sell',
    outputs: [{ name: 'proceeds', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'approved', internalType: 'bool', type: 'bool' },
    ],
    name: 'setApprovalForAll',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'interfaceId', internalType: 'bytes4', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'marketId', internalType: 'uint256', type: 'uint256' },
      { name: 'outcome', internalType: 'uint8', type: 'uint8' },
    ],
    name: 'tokenId',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'totalSupply',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    name: 'uri',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'uint256', type: 'uint256' }],
    name: 'withdrawResidual',
    outputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'approved', internalType: 'bool', type: 'bool', indexed: false },
    ],
    name: 'ApprovalForAll',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'marketId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'FeesClaimed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'marketId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      { name: 'feed', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'refPrice',
        internalType: 'int256',
        type: 'int256',
        indexed: false,
      },
      {
        name: 'closeTs',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
      {
        name: 'reopenTs',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
      {
        name: 'boundariesBps',
        internalType: 'int256[]',
        type: 'int256[]',
        indexed: false,
      },
    ],
    name: 'MarketCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'marketId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'holder',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'shares',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'payout',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Redeemed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'marketId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'ResidualWithdrawn',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'marketId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'roundId',
        internalType: 'uint80',
        type: 'uint80',
        indexed: false,
      },
      {
        name: 'settlePrice',
        internalType: 'int256',
        type: 'int256',
        indexed: false,
      },
      {
        name: 'moveBps',
        internalType: 'int256',
        type: 'int256',
        indexed: false,
      },
      { name: 'winner', internalType: 'uint8', type: 'uint8', indexed: false },
    ],
    name: 'Resolved',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'marketId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'trader',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'outcome', internalType: 'uint8', type: 'uint8', indexed: false },
      {
        name: 'shareDelta',
        internalType: 'int256',
        type: 'int256',
        indexed: false,
      },
      {
        name: 'collateralAmount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      { name: 'fee', internalType: 'uint256', type: 'uint256', indexed: false },
    ],
    name: 'Traded',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'ids',
        internalType: 'uint256[]',
        type: 'uint256[]',
        indexed: false,
      },
      {
        name: 'values',
        internalType: 'uint256[]',
        type: 'uint256[]',
        indexed: false,
      },
    ],
    name: 'TransferBatch',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: false },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'TransferSingle',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'value', internalType: 'string', type: 'string', indexed: false },
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: true },
    ],
    name: 'URI',
  },
  { type: 'error', inputs: [], name: 'AlreadyResolved' },
  { type: 'error', inputs: [], name: 'BadBoundaries' },
  { type: 'error', inputs: [], name: 'BadLiquidity' },
  { type: 'error', inputs: [], name: 'BadOutcome' },
  { type: 'error', inputs: [], name: 'BadPrice' },
  {
    type: 'error',
    inputs: [
      { name: 'sender', internalType: 'address', type: 'address' },
      { name: 'balance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC1155InsufficientBalance',
  },
  {
    type: 'error',
    inputs: [{ name: 'approver', internalType: 'address', type: 'address' }],
    name: 'ERC1155InvalidApprover',
  },
  {
    type: 'error',
    inputs: [
      { name: 'idsLength', internalType: 'uint256', type: 'uint256' },
      { name: 'valuesLength', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC1155InvalidArrayLength',
  },
  {
    type: 'error',
    inputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    name: 'ERC1155InvalidOperator',
  },
  {
    type: 'error',
    inputs: [{ name: 'receiver', internalType: 'address', type: 'address' }],
    name: 'ERC1155InvalidReceiver',
  },
  {
    type: 'error',
    inputs: [{ name: 'sender', internalType: 'address', type: 'address' }],
    name: 'ERC1155InvalidSender',
  },
  {
    type: 'error',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'owner', internalType: 'address', type: 'address' },
    ],
    name: 'ERC1155MissingApprovalForAll',
  },
  { type: 'error', inputs: [], name: 'FeeTooHigh' },
  { type: 'error', inputs: [], name: 'MarketIsOpen' },
  { type: 'error', inputs: [], name: 'NotCreator' },
  { type: 'error', inputs: [], name: 'NotFirstRoundAfterReopen' },
  { type: 'error', inputs: [], name: 'NotResolved' },
  {
    type: 'error',
    inputs: [
      { name: 'x', internalType: 'uint256', type: 'uint256' },
      { name: 'y', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'PRBMath_MulDiv18_Overflow',
  },
  {
    type: 'error',
    inputs: [
      { name: 'x', internalType: 'uint256', type: 'uint256' },
      { name: 'y', internalType: 'uint256', type: 'uint256' },
      { name: 'denominator', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'PRBMath_MulDiv_Overflow',
  },
  { type: 'error', inputs: [], name: 'PRBMath_SD59x18_Div_InputTooSmall' },
  {
    type: 'error',
    inputs: [
      { name: 'x', internalType: 'SD59x18', type: 'int256' },
      { name: 'y', internalType: 'SD59x18', type: 'int256' },
    ],
    name: 'PRBMath_SD59x18_Div_Overflow',
  },
  {
    type: 'error',
    inputs: [{ name: 'x', internalType: 'SD59x18', type: 'int256' }],
    name: 'PRBMath_SD59x18_Exp2_InputTooBig',
  },
  {
    type: 'error',
    inputs: [{ name: 'x', internalType: 'SD59x18', type: 'int256' }],
    name: 'PRBMath_SD59x18_Exp_InputTooBig',
  },
  {
    type: 'error',
    inputs: [{ name: 'x', internalType: 'SD59x18', type: 'int256' }],
    name: 'PRBMath_SD59x18_Log_InputTooSmall',
  },
  { type: 'error', inputs: [], name: 'PRBMath_SD59x18_Mul_InputTooSmall' },
  {
    type: 'error',
    inputs: [
      { name: 'x', internalType: 'SD59x18', type: 'int256' },
      { name: 'y', internalType: 'SD59x18', type: 'int256' },
    ],
    name: 'PRBMath_SD59x18_Mul_Overflow',
  },
  { type: 'error', inputs: [], name: 'ReentrancyGuardReentrantCall' },
  {
    type: 'error',
    inputs: [{ name: 'value', internalType: 'int256', type: 'int256' }],
    name: 'SafeCastOverflowedIntToUint',
  },
  {
    type: 'error',
    inputs: [
      { name: 'bits', internalType: 'uint8', type: 'uint8' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'SafeCastOverflowedUintDowncast',
  },
  {
    type: 'error',
    inputs: [{ name: 'value', internalType: 'uint256', type: 'uint256' }],
    name: 'SafeCastOverflowedUintToInt',
  },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
  },
  { type: 'error', inputs: [], name: 'Slippage' },
  { type: 'error', inputs: [], name: 'StaleReference' },
  { type: 'error', inputs: [], name: 'TooEarly' },
  { type: 'error', inputs: [], name: 'TradingClosed' },
] as const

/**
 * [__View Contract on Robinhood Chain Testnet Blockscout__](https://explorer.testnet.chain.robinhood.com/address/0x44540A78c4006897109b33A60d89E4a5522CC4dB)
 */
export const gapMarketAddress = {
  46630: '0x44540A78c4006897109b33A60d89E4a5522CC4dB',
} as const

/**
 * [__View Contract on Robinhood Chain Testnet Blockscout__](https://explorer.testnet.chain.robinhood.com/address/0x44540A78c4006897109b33A60d89E4a5522CC4dB)
 */
export const gapMarketConfig = {
  address: gapMarketAddress,
  abi: gapMarketAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IERC20Metadata
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const ierc20MetadataAbi = [
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'spender', internalType: 'address', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'spender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Approval',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Transfer',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ImpliedPriceOracle
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * [__View Contract on Robinhood Chain Testnet Blockscout__](https://explorer.testnet.chain.robinhood.com/address/0xA7E0E23f9dab3041a0bd506db09f3d22a73d2406)
 */
export const impliedPriceOracleAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'feed_',
        internalType: 'contract AggregatorV3Interface',
        type: 'address',
      },
      {
        name: 'gapMarket_',
        internalType: 'contract GapMarket',
        type: 'address',
      },
      { name: 'maxStaleness_', internalType: 'uint256', type: 'uint256' },
      { name: 'minLiquidity_', internalType: 'uint256', type: 'uint256' },
      { name: 'bandSigmas_', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'activeMarketId',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'bandSigmas',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'calendar',
    outputs: [
      { name: '', internalType: 'contract MarketCalendar', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'description',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'feed',
    outputs: [
      {
        name: '',
        internalType: 'contract AggregatorV3Interface',
        type: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'gapMarket',
    outputs: [
      { name: '', internalType: 'contract GapMarket', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'roundId', internalType: 'uint80', type: 'uint80' }],
    name: 'getRoundData',
    outputs: [
      { name: '', internalType: 'uint80', type: 'uint80' },
      { name: '', internalType: 'int256', type: 'int256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint80', type: 'uint80' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'hasActiveMarket',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'isFeedFrozen',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'isImplied',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { name: 'roundId', internalType: 'uint80', type: 'uint80' },
      { name: 'answer', internalType: 'int256', type: 'int256' },
      { name: 'startedAt', internalType: 'uint256', type: 'uint256' },
      { name: 'updatedAt', internalType: 'uint256', type: 'uint256' },
      { name: 'answeredInRound', internalType: 'uint80', type: 'uint80' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'maxStaleness',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'minLiquidity',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'priceBand',
    outputs: [
      { name: 'low', internalType: 'int256', type: 'int256' },
      { name: 'mid', internalType: 'int256', type: 'int256' },
      { name: 'high', internalType: 'int256', type: 'int256' },
      { name: 'implied', internalType: 'bool', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'uint256', type: 'uint256' }],
    name: 'setActiveMarket',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'marketId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'liquidity',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'ActiveMarketSet',
  },
  { type: 'error', inputs: [], name: 'MarketResolved' },
  { type: 'error', inputs: [], name: 'NotCurrentClosure' },
  { type: 'error', inputs: [], name: 'TooShallow' },
  { type: 'error', inputs: [], name: 'WrongFeed' },
] as const

/**
 * [__View Contract on Robinhood Chain Testnet Blockscout__](https://explorer.testnet.chain.robinhood.com/address/0xA7E0E23f9dab3041a0bd506db09f3d22a73d2406)
 */
export const impliedPriceOracleAddress = {
  46630: '0xA7E0E23f9dab3041a0bd506db09f3d22a73d2406',
} as const

/**
 * [__View Contract on Robinhood Chain Testnet Blockscout__](https://explorer.testnet.chain.robinhood.com/address/0xA7E0E23f9dab3041a0bd506db09f3d22a73d2406)
 */
export const impliedPriceOracleConfig = {
  address: impliedPriceOracleAddress,
  abi: impliedPriceOracleAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// MarketCalendar
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * [__View Contract on Robinhood Chain Testnet Blockscout__](https://explorer.testnet.chain.robinhood.com/address/0x951F2e74FA66Bec48d8Bd5481C6B95D8147f75ba)
 */
export const marketCalendarAbi = [
  {
    type: 'constructor',
    inputs: [{ name: 'owner_', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'day', internalType: 'uint256', type: 'uint256' }],
    name: 'isHoliday',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'ts', internalType: 'uint256', type: 'uint256' }],
    name: 'isOpen',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'ts', internalType: 'uint256', type: 'uint256' }],
    name: 'lastClose',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'ts', internalType: 'uint256', type: 'uint256' }],
    name: 'nextOpen',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'day', internalType: 'uint256', type: 'uint256' }],
    name: 'sessionStart',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      { name: 'year', internalType: 'uint256', type: 'uint256' },
      { name: 'month', internalType: 'uint256', type: 'uint256' },
      { name: 'day', internalType: 'uint256', type: 'uint256' },
      { name: 'closed', internalType: 'bool', type: 'bool' },
    ],
    name: 'setHoliday',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'ts', internalType: 'uint256', type: 'uint256' }],
    name: 'tradingDayOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'year', internalType: 'uint256', type: 'uint256', indexed: true },
      {
        name: 'month',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      { name: 'day', internalType: 'uint256', type: 'uint256', indexed: true },
      { name: 'closed', internalType: 'bool', type: 'bool', indexed: false },
    ],
    name: 'HolidaySet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  { type: 'error', inputs: [], name: 'NoOpenSessionAhead' },
  {
    type: 'error',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'OwnableInvalidOwner',
  },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'OwnableUnauthorizedAccount',
  },
] as const

/**
 * [__View Contract on Robinhood Chain Testnet Blockscout__](https://explorer.testnet.chain.robinhood.com/address/0x951F2e74FA66Bec48d8Bd5481C6B95D8147f75ba)
 */
export const marketCalendarAddress = {
  46630: '0x951F2e74FA66Bec48d8Bd5481C6B95D8147f75ba',
} as const

/**
 * [__View Contract on Robinhood Chain Testnet Blockscout__](https://explorer.testnet.chain.robinhood.com/address/0x951F2e74FA66Bec48d8Bd5481C6B95D8147f75ba)
 */
export const marketCalendarConfig = {
  address: marketCalendarAddress,
  abi: marketCalendarAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// MirroredFeed
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * [__View Contract on Robinhood Chain Testnet Blockscout__](https://explorer.testnet.chain.robinhood.com/address/0xBfB0559AF20D15E844FF17810570c028Bad764C7)
 */
export const mirroredFeedAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'owner_', internalType: 'address', type: 'address' },
      { name: 'decimals_', internalType: 'uint8', type: 'uint8' },
      { name: 'description_', internalType: 'string', type: 'string' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'description',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'roundId', internalType: 'uint80', type: 'uint80' }],
    name: 'getRoundData',
    outputs: [
      { name: '', internalType: 'uint80', type: 'uint80' },
      { name: '', internalType: 'int256', type: 'int256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint80', type: 'uint80' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'latestRound',
    outputs: [{ name: '', internalType: 'uint80', type: 'uint80' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { name: '', internalType: 'uint80', type: 'uint80' },
      { name: '', internalType: 'int256', type: 'int256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint80', type: 'uint80' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'answer', internalType: 'int256', type: 'int256' },
      { name: 'startedAt', internalType: 'uint256', type: 'uint256' },
      { name: 'updatedAt', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'mirror',
    outputs: [{ name: 'roundId', internalType: 'uint80', type: 'uint80' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'roundId',
        internalType: 'uint80',
        type: 'uint80',
        indexed: true,
      },
      {
        name: 'answer',
        internalType: 'int256',
        type: 'int256',
        indexed: false,
      },
      {
        name: 'updatedAt',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'RoundMirrored',
  },
  { type: 'error', inputs: [], name: 'NonMonotonic' },
  {
    type: 'error',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'OwnableInvalidOwner',
  },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'OwnableUnauthorizedAccount',
  },
  { type: 'error', inputs: [], name: 'RoundNotFound' },
] as const

/**
 * [__View Contract on Robinhood Chain Testnet Blockscout__](https://explorer.testnet.chain.robinhood.com/address/0xBfB0559AF20D15E844FF17810570c028Bad764C7)
 */
export const mirroredFeedAddress = {
  46630: '0xBfB0559AF20D15E844FF17810570c028Bad764C7',
} as const

/**
 * [__View Contract on Robinhood Chain Testnet Blockscout__](https://explorer.testnet.chain.robinhood.com/address/0xBfB0559AF20D15E844FF17810570c028Bad764C7)
 */
export const mirroredFeedConfig = {
  address: mirroredFeedAddress,
  abi: mirroredFeedAbi,
} as const
