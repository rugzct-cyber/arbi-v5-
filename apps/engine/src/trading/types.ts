/**
 * Trading Module Types
 * Defines all types for the arbitrage trading system
 */

// Trade direction
export type TradeSide = 'LONG' | 'SHORT';

// Order type
export type OrderType = 'MARKET' | 'LIMIT';

// Order status
export type OrderStatus = 'PENDING' | 'OPEN' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'FAILED';

// Trade status
export type TradeStatus = 'PENDING' | 'EXECUTING' | 'ACTIVE' | 'CLOSING' | 'PARTIAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

/**
 * Configuration for the trading bot
 */
export interface TradingConfig {
    // Enable/disable trading (paper mode if false)
    enabled: boolean;

    // Paper trading mode (simulate trades without execution)
    paperMode: boolean;

    // Minimum spread to trigger a trade (%)
    minSpreadPercent: number;

    // Maximum spread to accept (above this is likely an error)
    maxSpreadPercent: number;

    // REST verification before trade
    verifyWithRest: boolean;

    // Max position size per trade (in USD)
    maxPositionSizeUsd: number;

    // Max total exposure (in USD)
    maxTotalExposureUsd: number;

    // Cooldown between trades on same pair (ms)
    tradeCooldownMs: number;

    // Slippage tolerance (%)
    slippageTolerance: number;
}

/**
 * Wallet/Account configuration for an exchange
 */
export interface WalletConfig {
    exchangeId: string;

    // API credentials (never hardcode these!)
    apiKey?: string;
    apiSecret?: string;

    // For EVM chains
    privateKey?: string;

    // For Starknet
    starknetAddress?: string;
    starknetPrivateKey?: string;

    // Available balance (updated after each trade)
    availableBalance: number;

    // Locked in positions
    lockedBalance: number;
}

/**
 * A single order on an exchange
 */
export interface Order {
    id: string;
    exchangeId: string;
    symbol: string;
    side: TradeSide;
    type: OrderType;
    price: number;
    quantity: number;
    filledQuantity: number;
    status: OrderStatus;
    createdAt: number;
    updatedAt: number;
    error?: string;
}

/**
 * An arbitrage trade (consists of two orders)
 */
export interface ArbitrageTrade {
    id: string;
    symbol: string;

    // Long side (buy)
    longExchange: string;
    longOrder?: Order;
    entryPriceLong: number;

    // Short side (sell)
    shortExchange: string;
    shortOrder?: Order;
    entryPriceShort: number;

    // Trade details
    quantity: number;
    entrySpread: number;
    status: TradeStatus;

    // Timestamps
    createdAt: number;
    executedAt?: number;
    closedAt?: number;

    // Exit prices (set on close)
    exitPriceLong?: number;
    exitPriceShort?: number;
    exitSpread?: number;

    // PnL (updated during trade and finalized on close)
    pnl?: number;
    realizedPnl?: number;

    // Error if failed
    error?: string;
}

/**
 * Risk check result
 */
export interface RiskCheckResult {
    allowed: boolean;
    reason?: string;
    adjustedSize?: number;
}

/**
 * Trade execution result
 */
export interface TradeResult {
    success: boolean;
    trade?: ArbitrageTrade;
    error?: string;
    status?: TradeStatus;
    symbol?: string;
}

/**
 * Default trading configuration
 */
export const DEFAULT_TRADING_CONFIG: TradingConfig = {
    enabled: false,
    paperMode: true,
    minSpreadPercent: 0.15,
    maxSpreadPercent: 5.0,
    verifyWithRest: true,
    maxPositionSizeUsd: 100,
    maxTotalExposureUsd: 500,
    tradeCooldownMs: 5000,
    slippageTolerance: 0.1,
};
