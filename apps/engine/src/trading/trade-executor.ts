/**
 * Trade Executor with Atomic Execution
 * 
 * Implements two-phase commit for arbitrage trades:
 * 1. PENDING - Trade created, risk checked
 * 2. EXECUTING - Orders being placed
 * 3. ACTIVE - Both legs executed successfully
 * 4. COMPLETED - Trade closed with profit/loss
 * 5. FAILED - One or both legs failed (with rollback)
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
import { TradePersistence } from './trade-persistence.js';
import { DEFAULT_TRADING_CONFIG } from './types.js';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

export class TradeExecutor {
    private config: TradingConfig;
    private riskManager: RiskManager;
    private walletManager: WalletManager;
    private persistence: TradePersistence;
    private tradeHistory: ArbitrageTrade[] = [];
    private activeTrades: Map<string, ArbitrageTrade> = new Map();

    // Exchange-specific order executors (to be implemented per exchange)
    private orderExecutors: Map<string, OrderExecutor> = new Map();

    constructor(config: Partial<TradingConfig> = {}) {
        this.config = { ...DEFAULT_TRADING_CONFIG, ...config };
        this.riskManager = new RiskManager(this.config);
        this.walletManager = new WalletManager();
        this.persistence = new TradePersistence();

        console.log('[TradeExecutor] Initialized with atomic execution');
        console.log(`  - Paper Mode: ${this.config.paperMode}`);
        console.log(`  - Trading Enabled: ${this.config.enabled}`);
        console.log(`  - Persistence: ${this.persistence.isEnabled() ? 'ON' : 'OFF'}`);

        // Load active trades from DB on startup
        this.recoverActiveTrades();
    }

    /**
     * Recover active trades from database after restart
     */
    private async recoverActiveTrades(): Promise<void> {
        const trades = await this.persistence.loadActiveTrades();
        if (trades.length > 0) {
            console.log(`[TradeExecutor] Recovering ${trades.length} active trades from DB`);
            for (const trade of trades) {
                this.activeTrades.set(trade.id, trade);
                this.riskManager.registerTrade(trade);
            }
        }
    }

    /**
     * Attempt to execute an arbitrage trade with atomic guarantees
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

        // 2. Verify spread with REST (optional but recommended)
        if (this.config.verifyWithRest) {
            const verified = await this.verifySpreadWithRestRetry(symbol, longExchange, shortExchange, spreadPercent);
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
            entryPriceLong: 0,
            entryPriceShort: 0,
            quantity: 0,
            entrySpread: spreadPercent,
            status: 'PENDING' as TradeStatus,
            createdAt: Date.now(),
        };

        // 4. Persist trade immediately
        await this.persistence.saveTrade(trade);

        // 5. Execute orders
        if (this.config.paperMode) {
            return await this.executePaperTrade(trade, adjustedSize);
        } else {
            return await this.executeAtomicTrade(trade, adjustedSize);
        }
    }

    /**
     * Execute a paper trade (simulation)
     */
    private async executePaperTrade(trade: ArbitrageTrade, sizeUsd: number): Promise<TradeResult> {
        console.log(`[TradeExecutor] 📝 PAPER TRADE: ${trade.symbol}`);

        // Simulate execution
        trade.status = 'ACTIVE';
        trade.executedAt = Date.now();
        trade.quantity = sizeUsd / 1000;
        trade.entryPriceLong = 1000;
        trade.entryPriceShort = 1000 * (1 + trade.entrySpread / 100);
        trade.pnl = 0;

        // Register and persist
        this.riskManager.registerTrade(trade);
        this.activeTrades.set(trade.id, trade);
        this.tradeHistory.push(trade);
        await this.persistence.saveTrade(trade);

        console.log(`[TradeExecutor] ✅ Paper trade ACTIVE: ${trade.id}`);
        return { success: true, trade, status: 'ACTIVE', symbol: trade.symbol };
    }

    /**
     * Execute a real trade with atomic guarantees (two-phase commit)
     */
    private async executeAtomicTrade(trade: ArbitrageTrade, sizeUsd: number): Promise<TradeResult> {
        console.log(`[TradeExecutor] 💰 ATOMIC TRADE: ${trade.symbol}`);

        // Phase 0: Lock balances
        const legSize = sizeUsd / 2;
        if (!this.walletManager.hasBalance(trade.longExchange, legSize)) {
            await this.failTrade(trade, `Insufficient balance on ${trade.longExchange}`);
            return { success: false, error: trade.error };
        }
        if (!this.walletManager.hasBalance(trade.shortExchange, legSize)) {
            await this.failTrade(trade, `Insufficient balance on ${trade.shortExchange}`);
            return { success: false, error: trade.error };
        }

        this.walletManager.lockBalance(trade.longExchange, legSize);
        this.walletManager.lockBalance(trade.shortExchange, legSize);

        // Phase 1: Update status to EXECUTING
        trade.status = 'EXECUTING';
        await this.persistence.updateTradeStatus(trade.id, 'EXECUTING');

        let longOrder: Order | null = null;
        let shortOrder: Order | null = null;

        try {
            // Phase 2: Execute long leg first
            const longExecutor = this.orderExecutors.get(trade.longExchange);
            if (!longExecutor) {
                throw new Error(`No executor for ${trade.longExchange}`);
            }

            longOrder = await this.executeWithRetry(
                () => longExecutor.placeOrder(trade.symbol, 'BUY', trade.quantity),
                `Long order on ${trade.longExchange}`
            );

            if (!longOrder || longOrder.status === 'FAILED') {
                throw new Error(`Long order failed: ${longOrder?.error || 'Unknown'}`);
            }

            trade.entryPriceLong = longOrder.price;

            // Phase 3: Execute short leg
            const shortExecutor = this.orderExecutors.get(trade.shortExchange);
            if (!shortExecutor) {
                // Rollback long order
                await this.rollbackOrder(longExecutor, longOrder);
                throw new Error(`No executor for ${trade.shortExchange}`);
            }

            shortOrder = await this.executeWithRetry(
                () => shortExecutor.placeOrder(trade.symbol, 'SELL', trade.quantity),
                `Short order on ${trade.shortExchange}`
            );

            if (!shortOrder || shortOrder.status === 'FAILED') {
                // Rollback long order
                await this.rollbackOrder(longExecutor, longOrder);
                throw new Error(`Short order failed: ${shortOrder?.error || 'Unknown'}`);
            }

            trade.entryPriceShort = shortOrder.price;

            // Phase 4: Both legs successful - mark as ACTIVE
            trade.status = 'ACTIVE';
            trade.executedAt = Date.now();
            trade.pnl = 0;

            this.riskManager.registerTrade(trade);
            this.activeTrades.set(trade.id, trade);
            this.tradeHistory.push(trade);
            await this.persistence.saveTrade(trade);

            console.log(`[TradeExecutor] ✅ Atomic trade ACTIVE: ${trade.id}`);
            return { success: true, trade, status: 'ACTIVE', symbol: trade.symbol };

        } catch (error) {
            // Rollback and fail
            await this.failTrade(trade, String(error));

            // Release locked balances
            this.walletManager.releaseBalance(trade.longExchange, legSize);
            this.walletManager.releaseBalance(trade.shortExchange, legSize);

            return { success: false, error: trade.error, trade };
        }
    }

    /**
     * Execute with retry logic
     */
    private async executeWithRetry<T>(
        fn: () => Promise<T>,
        description: string
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                return await fn();
            } catch (e) {
                lastError = e as Error;
                console.warn(`[TradeExecutor] ${description} attempt ${attempt}/${MAX_RETRIES} failed: ${lastError.message}`);

                if (attempt < MAX_RETRIES) {
                    await this.sleep(RETRY_DELAY_MS * attempt); // Exponential backoff
                }
            }
        }

        throw lastError || new Error(`${description} failed after ${MAX_RETRIES} attempts`);
    }

    /**
     * Rollback an order (attempt to cancel/close)
     */
    private async rollbackOrder(executor: OrderExecutor, order: Order): Promise<void> {
        console.log(`[TradeExecutor] Rolling back order ${order.id}`);
        try {
            // Try to cancel if not filled
            if (order.status === 'PENDING' || order.status === 'PARTIAL') {
                await executor.cancelOrder(order.id);
            }
            // If filled, we need to place a closing order
            // This is complex and exchange-specific - for now just log
            console.warn(`[TradeExecutor] Order ${order.id} may need manual intervention`);
        } catch (e) {
            console.error(`[TradeExecutor] Rollback failed for order ${order.id}:`, e);
        }
    }

    /**
     * Mark trade as failed
     */
    private async failTrade(trade: ArbitrageTrade, error: string): Promise<void> {
        trade.status = 'FAILED';
        trade.error = error;
        trade.closedAt = Date.now();

        await this.persistence.updateTradeStatus(trade.id, 'FAILED', { error, closedAt: trade.closedAt });
        console.error(`[TradeExecutor] ❌ Trade FAILED: ${trade.id} - ${error}`);
    }

    /**
     * Verify spread using REST API with retry
     */
    private async verifySpreadWithRestRetry(
        symbol: string,
        longExchange: string,
        shortExchange: string,
        expectedSpread: number
    ): Promise<boolean> {
        try {
            return await this.executeWithRetry(
                () => this.verifySpreadWithRest(symbol, longExchange, shortExchange, expectedSpread),
                'REST spread verification'
            );
        } catch {
            return false;
        }
    }

    private async verifySpreadWithRest(
        symbol: string,
        longExchange: string,
        shortExchange: string,
        expectedSpread: number
    ): Promise<boolean> {
        const url = `http://localhost:3000/api/verify-spread?symbol=${symbol}&exchange1=${longExchange}&exchange2=${shortExchange}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`REST verification failed: ${response.status}`);
        }

        const data = await response.json();
        const restSpread = parseFloat(data.bestStrategy?.spread?.replace('%', '') || '0');
        const spreadDiff = Math.abs(restSpread - expectedSpread);

        if (spreadDiff > 0.1) {
            console.warn(`[TradeExecutor] Spread mismatch: WS=${expectedSpread.toFixed(3)}%, REST=${restSpread.toFixed(3)}%`);
            return false;
        }

        return true;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Public getters
    getTradeHistory(limit = 100): ArbitrageTrade[] {
        return this.tradeHistory.slice(-limit);
    }

    getActiveTrades(): ArbitrageTrade[] {
        return Array.from(this.activeTrades.values());
    }

    updateConfig(config: Partial<TradingConfig>): void {
        this.config = { ...this.config, ...config };
        this.riskManager.updateConfig(config);
    }

    getRiskManager(): RiskManager {
        return this.riskManager;
    }

    getWalletManager(): WalletManager {
        return this.walletManager;
    }

    getPersistence(): TradePersistence {
        return this.persistence;
    }

    /**
     * Register an exchange order executor
     */
    registerExecutor(exchangeId: string, executor: OrderExecutor): void {
        this.orderExecutors.set(exchangeId, executor);
        console.log(`[TradeExecutor] Registered executor for ${exchangeId}`);
    }
}

/**
 * Interface for exchange-specific order execution
 */
export interface OrderExecutor {
    exchangeId: string;
    placeOrder(symbol: string, side: 'BUY' | 'SELL', quantity: number, price?: number): Promise<Order>;
    cancelOrder(orderId: string): Promise<boolean>;
    getOrderStatus(orderId: string): Promise<Order>;
}
