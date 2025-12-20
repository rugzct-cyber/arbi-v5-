/**
 * Trade Executor
 * Executes arbitrage trades on exchanges
 * 
 * This is the core trading component that:
 * 1. Receives arbitrage opportunities
 * 2. Validates with RiskManager
 * 3. Optionally verifies spread via REST
 * 4. Executes orders on both exchanges
 * 5. Tracks and reports trade status
 */

import type {
    TradingConfig,
    ArbitrageTrade,
    Order,
    TradeResult,
    TradeStatus
} from './types.js';
import { RiskManager } from './risk-manager.js';
import { WalletManager } from './wallet-manager.js';
import { DEFAULT_TRADING_CONFIG } from './types.js';

export class TradeExecutor {
    private config: TradingConfig;
    private riskManager: RiskManager;
    private walletManager: WalletManager;
    private tradeHistory: ArbitrageTrade[] = [];

    // Exchange-specific order executors (to be implemented per exchange)
    private orderExecutors: Map<string, OrderExecutor> = new Map();

    constructor(config: Partial<TradingConfig> = {}) {
        this.config = { ...DEFAULT_TRADING_CONFIG, ...config };
        this.riskManager = new RiskManager(this.config);
        this.walletManager = new WalletManager();

        console.log('[TradeExecutor] Initialized');
        console.log(`  - Paper Mode: ${this.config.paperMode}`);
        console.log(`  - Trading Enabled: ${this.config.enabled}`);
        console.log(`  - Min Spread: ${this.config.minSpreadPercent}%`);
        console.log(`  - Max Position: $${this.config.maxPositionSizeUsd}`);
    }

    /**
     * Attempt to execute an arbitrage trade
     */
    async execute(
        symbol: string,
        longExchange: string,
        shortExchange: string,
        spreadPercent: number,
        sizeUsd: number
    ): Promise<TradeResult> {
        console.log(`[TradeExecutor] Evaluating trade: ${symbol} Long ${longExchange} / Short ${shortExchange} @ ${spreadPercent.toFixed(3)}%`);

        // 1. Risk check
        const riskCheck = this.riskManager.checkTrade(
            symbol,
            longExchange,
            shortExchange,
            spreadPercent,
            sizeUsd
        );

        if (!riskCheck.allowed) {
            console.log(`[TradeExecutor] Risk check failed: ${riskCheck.reason}`);
            return { success: false, error: riskCheck.reason };
        }

        const adjustedSize = riskCheck.adjustedSize || sizeUsd;
        console.log(`[TradeExecutor] Risk check passed. Size: $${adjustedSize}`);

        // 2. Verify spread with REST (optional but recommended)
        if (this.config.verifyWithRest) {
            const verified = await this.verifySpreadWithRest(symbol, longExchange, shortExchange, spreadPercent);
            if (!verified) {
                return { success: false, error: 'Spread verification failed via REST' };
            }
        }

        // 3. Create trade record
        const trade: ArbitrageTrade = {
            id: `trade-${Date.now()}-${symbol}`,
            symbol,
            longExchange,
            shortExchange,
            entryPriceLong: 0, // Will be filled by order
            entryPriceShort: 0,
            quantity: 0, // Will be calculated
            entrySpread: spreadPercent,
            status: 'PENDING' as TradeStatus,
            createdAt: Date.now(),
        };

        // 4. Execute orders (paper mode or real)
        if (this.config.paperMode) {
            return await this.executePaperTrade(trade, adjustedSize);
        } else {
            return await this.executeRealTrade(trade, adjustedSize);
        }
    }

    /**
     * Execute a paper trade (simulation)
     */
    private async executePaperTrade(trade: ArbitrageTrade, sizeUsd: number): Promise<TradeResult> {
        console.log(`[TradeExecutor] 📝 PAPER TRADE: ${trade.symbol}`);

        // Simulate execution with current prices
        trade.status = 'COMPLETED';
        trade.executedAt = Date.now();
        trade.quantity = sizeUsd / 1000; // Simplified - assume $1000/unit
        trade.entryPriceLong = 1000; // Placeholder
        trade.entryPriceShort = 1000 * (1 + trade.entrySpread / 100);

        // Register with risk manager
        this.riskManager.registerTrade(trade);
        this.tradeHistory.push(trade);

        console.log(`[TradeExecutor] ✅ Paper trade executed: ${trade.id}`);
        return { success: true, trade };
    }

    /**
     * Execute a real trade on exchanges
     * ⚠️ This is where real money is at stake!
     */
    private async executeRealTrade(trade: ArbitrageTrade, sizeUsd: number): Promise<TradeResult> {
        console.log(`[TradeExecutor] 💰 REAL TRADE: ${trade.symbol}`);

        // Check wallet balances
        if (!this.walletManager.hasBalance(trade.longExchange, sizeUsd / 2)) {
            return { success: false, error: `Insufficient balance on ${trade.longExchange}` };
        }
        if (!this.walletManager.hasBalance(trade.shortExchange, sizeUsd / 2)) {
            return { success: false, error: `Insufficient balance on ${trade.shortExchange}` };
        }

        // Lock balances
        this.walletManager.lockBalance(trade.longExchange, sizeUsd / 2);
        this.walletManager.lockBalance(trade.shortExchange, sizeUsd / 2);

        trade.status = 'EXECUTING';

        try {
            // TODO: Implement actual order execution per exchange
            // This requires exchange-specific SDKs

            // For now, return error indicating not implemented
            return {
                success: false,
                error: 'Real trading not yet implemented - use paperMode: true'
            };
        } catch (error) {
            // Release locked balances on failure
            this.walletManager.releaseBalance(trade.longExchange, sizeUsd / 2);
            this.walletManager.releaseBalance(trade.shortExchange, sizeUsd / 2);

            trade.status = 'FAILED';
            trade.error = String(error);

            return { success: false, error: String(error), trade };
        }
    }

    /**
     * Verify spread using REST API before executing
     */
    private async verifySpreadWithRest(
        symbol: string,
        longExchange: string,
        shortExchange: string,
        expectedSpread: number
    ): Promise<boolean> {
        try {
            // Call our verify-spread API
            const url = `http://localhost:3000/api/verify-spread?symbol=${symbol}&exchange1=${longExchange}&exchange2=${shortExchange}`;
            const response = await fetch(url);

            if (!response.ok) {
                console.warn(`[TradeExecutor] REST verification failed: ${response.status}`);
                return false;
            }

            const data = await response.json();
            const restSpread = parseFloat(data.bestStrategy?.spread?.replace('%', '') || '0');

            // Allow some variance (0.1% tolerance)
            const spreadDiff = Math.abs(restSpread - expectedSpread);
            if (spreadDiff > 0.1) {
                console.warn(`[TradeExecutor] Spread mismatch: WS=${expectedSpread.toFixed(3)}%, REST=${restSpread.toFixed(3)}%`);
                return false;
            }

            console.log(`[TradeExecutor] ✅ Spread verified via REST: ${restSpread.toFixed(3)}%`);
            return true;
        } catch (error) {
            console.error(`[TradeExecutor] REST verification error:`, error);
            return false;
        }
    }

    /**
     * Get trade history
     */
    getTradeHistory(limit = 100): ArbitrageTrade[] {
        return this.tradeHistory.slice(-limit);
    }

    /**
     * Get active trades
     */
    getActiveTrades(): ArbitrageTrade[] {
        return this.riskManager.getActiveTrades();
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<TradingConfig>): void {
        this.config = { ...this.config, ...config };
        this.riskManager.updateConfig(config);
    }

    /**
     * Get risk manager (for external access)
     */
    getRiskManager(): RiskManager {
        return this.riskManager;
    }

    /**
     * Get wallet manager (for configuration)
     */
    getWalletManager(): WalletManager {
        return this.walletManager;
    }
}

/**
 * Interface for exchange-specific order execution
 * Each exchange will implement this
 */
interface OrderExecutor {
    exchangeId: string;
    placeOrder(symbol: string, side: 'BUY' | 'SELL', quantity: number, price?: number): Promise<Order>;
    cancelOrder(orderId: string): Promise<boolean>;
    getOrderStatus(orderId: string): Promise<Order>;
}
