/**
 * Trading Module
 * 
 * This module provides arbitrage trading capabilities.
 * It is designed to be completely separate from the monitoring system.
 * 
 * ⚠️ PROTECTED: Requires TRADING_SECRET_TOKEN to activate
 * 
 * Usage:
 * ```typescript
 * import { TradingBot } from './trading';
 * 
 * const bot = new TradingBot({
 *     paperMode: true,  // Start in paper mode for safety
 *     minSpreadPercent: 0.15,
 * });
 * 
 * // Must authenticate with secret token
 * bot.authenticate(process.env.TRADING_SECRET_TOKEN!);
 * bot.start();
 * 
 * // Feed opportunities to the bot
 * bot.processOpportunity(opportunity);
 * ```
 */

// Types
export * from './types.js';

// Core components
export { RiskManager } from './risk-manager.js';
export { WalletManager } from './wallet-manager.js';
export { TradeExecutor, OrderExecutor } from './trade-executor.js';
export { TradePersistence } from './trade-persistence.js';
export { PositionMonitor } from './position-monitor.js';

// Strategies
export { SimpleArbStrategy } from './strategies/simple-arb.js';

// Main trading bot class
import type { TradingConfig, TradeResult } from './types.js';
import type { ArbitrageOpportunity } from '@arbitrage/shared';
import { TradeExecutor } from './trade-executor.js';
import { SimpleArbStrategy } from './strategies/simple-arb.js';
import { DEFAULT_TRADING_CONFIG } from './types.js';

/**
 * Main Trading Bot
 * Combines all trading components into a single easy-to-use interface
 * 
 * ⚠️ SECURITY: Requires authentication with TRADING_SECRET_TOKEN
 */
export class TradingBot {
    private executor: TradeExecutor;
    private strategy: SimpleArbStrategy;
    private isRunning: boolean = false;
    private isAuthenticated: boolean = false;

    // Secret token from environment variable
    private readonly secretToken: string;

    constructor(config: Partial<TradingConfig> = {}) {
        // Get secret token from environment
        this.secretToken = process.env.TRADING_SECRET_TOKEN || '';

        if (!this.secretToken) {
            console.warn('[TradingBot] ⚠️ TRADING_SECRET_TOKEN not set - trading disabled');
        }

        const mergedConfig = { ...DEFAULT_TRADING_CONFIG, ...config };

        this.executor = new TradeExecutor(mergedConfig);
        this.strategy = new SimpleArbStrategy(this.executor, {
            minSpread: mergedConfig.minSpreadPercent,
            maxSpread: mergedConfig.maxSpreadPercent,
            defaultSizeUsd: mergedConfig.maxPositionSizeUsd,
        });

        console.log('╔════════════════════════════════════════╗');
        console.log('║         TRADING BOT INITIALIZED        ║');
        console.log('╠════════════════════════════════════════╣');
        console.log(`║  Paper Mode: ${mergedConfig.paperMode ? 'YES ✅' : 'NO ⚠️ '}                     ║`);
        console.log(`║  Trading:    ${mergedConfig.enabled ? 'ENABLED' : 'DISABLED'}                  ║`);
        console.log(`║  Auth:       REQUIRED 🔐               ║`);
        console.log('╚════════════════════════════════════════╝');
    }

    /**
     * Authenticate with secret token
     * Must call this before start()
     */
    authenticate(token: string): boolean {
        if (!this.secretToken) {
            console.error('[TradingBot] ❌ No secret token configured');
            return false;
        }

        if (token !== this.secretToken) {
            console.error('[TradingBot] ❌ Invalid authentication token');
            return false;
        }

        this.isAuthenticated = true;
        console.log('[TradingBot] ✅ Authentication successful');
        return true;
    }

    /**
     * Start the trading bot
     * Requires prior authentication
     */
    start(): boolean {
        if (!this.isAuthenticated) {
            console.error('[TradingBot] ❌ Not authenticated - call authenticate() first');
            return false;
        }

        console.log('[TradingBot] Starting...');
        this.isRunning = true;
        this.strategy.start();
        console.log('[TradingBot] ✅ Bot is running');
        return true;
    }

    /**
     * Stop the trading bot
     */
    stop(): void {
        console.log('[TradingBot] Stopping...');
        this.isRunning = false;
        this.strategy.stop();
        console.log('[TradingBot] 🛑 Bot stopped');
    }

    /**
     * Process an arbitrage opportunity
     * Connect this to your ArbitrageDetector
     */
    async processOpportunity(opportunity: ArbitrageOpportunity): Promise<TradeResult | null> {
        if (!this.isRunning || !this.isAuthenticated) {
            return null;
        }
        return this.strategy.process(opportunity);
    }

    /**
     * Get trading statistics
     */
    getStats() {
        return {
            isRunning: this.isRunning,
            isAuthenticated: this.isAuthenticated,
            strategy: this.strategy.getStats(),
            activeTrades: this.executor.getActiveTrades(),
            tradeHistory: this.executor.getTradeHistory(10),
        };
    }

    /**
     * Get the trade executor for direct access
     */
    getExecutor(): TradeExecutor {
        return this.executor;
    }

    /**
     * Get the strategy for direct access
     */
    getStrategy(): SimpleArbStrategy {
        return this.strategy;
    }

    /**
     * Update trading configuration
     */
    updateConfig(config: Partial<TradingConfig>): void {
        this.executor.updateConfig(config);
        if (config.minSpreadPercent !== undefined) {
            this.strategy.updateConfig({ minSpread: config.minSpreadPercent });
        }
        if (config.maxSpreadPercent !== undefined) {
            this.strategy.updateConfig({ maxSpread: config.maxSpreadPercent });
        }
    }

    /**
     * Check if bot is authenticated
     */
    isAuth(): boolean {
        return this.isAuthenticated;
    }

    /**
     * Check if bot is running
     */
    isActive(): boolean {
        return this.isRunning;
    }
}
