/**
 * Exit Manager
 * 
 * Monitors active trades and executes exit strategies:
 * - Take Profit: Close when spread converges to target
 * - Stop Loss: Close if spread diverges too much
 * - Trailing Exit: Lock in profits as spread improves
 * - Time Exit: Close after max hold duration
 */

import type { ArbitrageTrade, TradeStatus } from './types.js';
import { TradePersistence } from './trade-persistence.js';

export interface ExitConfig {
    // Take profit when exit spread <= this value (e.g., -0.1 means close when short is cheaper than long)
    takeProfitSpread: number;

    // Stop loss when spread worsens by this amount from entry (e.g., 2.0 = close if spread goes +2% worse)
    stopLossSpread: number;

    // Enable trailing exit
    trailingEnabled: boolean;

    // Trailing: lock in profit after spread improves by this amount
    trailingActivation: number; // e.g., 0.5 = activate after 0.5% improvement

    // Trailing: close if spread retraces by this amount from best
    trailingDistance: number; // e.g., 0.3 = close if retraces 0.3% from best

    // Max time to hold position (ms), 0 = no limit
    maxHoldTimeMs: number;
}

interface TradeState {
    trade: ArbitrageTrade;
    bestSpread: number; // Best (lowest) spread seen since entry
    trailingActive: boolean;
    entryTime: number;
}

export const DEFAULT_EXIT_CONFIG: ExitConfig = {
    takeProfitSpread: 0, // Close when spread goes to 0 or negative
    stopLossSpread: 2.0, // Close if spread worsens by 2%
    trailingEnabled: true,
    trailingActivation: 0.3, // Activate after 0.3% improvement
    trailingDistance: 0.2, // Close if retraces 0.2% from best
    maxHoldTimeMs: 4 * 60 * 60 * 1000, // 4 hours max
};

export class ExitManager {
    private config: ExitConfig;
    private persistence: TradePersistence;
    private tradeStates: Map<string, TradeState> = new Map();
    private monitorInterval: NodeJS.Timeout | null = null;
    private onExitTrigger: ((trade: ArbitrageTrade, reason: string, currentSpread: number) => Promise<void>) | null = null;
    private getCurrentSpread: ((symbol: string, longExchange: string, shortExchange: string) => number | null) | null = null;

    constructor(config: Partial<ExitConfig> = {}, persistence: TradePersistence) {
        this.config = { ...DEFAULT_EXIT_CONFIG, ...config };
        this.persistence = persistence;
        console.log('[ExitManager] Initialized');
        console.log(`  - Take Profit: spread <= ${this.config.takeProfitSpread}%`);
        console.log(`  - Stop Loss: spread worsens by ${this.config.stopLossSpread}%`);
        console.log(`  - Trailing: ${this.config.trailingEnabled ? 'ON' : 'OFF'}`);
        console.log(`  - Max Hold: ${this.config.maxHoldTimeMs / 1000 / 60} minutes`);
    }

    /**
     * Set callback for when exit is triggered
     */
    setExitCallback(callback: (trade: ArbitrageTrade, reason: string, currentSpread: number) => Promise<void>): void {
        this.onExitTrigger = callback;
    }

    /**
     * Set function to get current spread
     */
    setSpreadProvider(provider: (symbol: string, longExchange: string, shortExchange: string) => number | null): void {
        this.getCurrentSpread = provider;
    }

    /**
     * Start monitoring trades for exit conditions
     */
    start(): void {
        if (this.monitorInterval) return;

        console.log('[ExitManager] Starting exit monitoring');
        this.monitorInterval = setInterval(() => this.checkAllExits(), 5000); // Check every 5s
    }

    /**
     * Stop monitoring
     */
    stop(): void {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        console.log('[ExitManager] Stopped');
    }

    /**
     * Register a trade for exit monitoring
     */
    registerTrade(trade: ArbitrageTrade): void {
        const state: TradeState = {
            trade,
            bestSpread: trade.entrySpread,
            trailingActive: false,
            entryTime: trade.executedAt || Date.now(),
        };
        this.tradeStates.set(trade.id, state);
        console.log(`[ExitManager] Monitoring trade ${trade.id} for exit (entry spread: ${trade.entrySpread.toFixed(3)}%)`);
    }

    /**
     * Unregister a trade (already closed)
     */
    unregisterTrade(tradeId: string): void {
        this.tradeStates.delete(tradeId);
    }

    /**
     * Check all trades for exit conditions
     */
    private async checkAllExits(): Promise<void> {
        if (this.tradeStates.size === 0) return;

        for (const [tradeId, state] of this.tradeStates) {
            try {
                await this.checkTradeExit(state);
            } catch (error) {
                console.error(`[ExitManager] Error checking exit for ${tradeId}:`, error);
            }
        }
    }

    /**
     * Check exit conditions for a single trade
     */
    private async checkTradeExit(state: TradeState): Promise<void> {
        const { trade } = state;

        // Skip if trade is not active
        if (trade.status !== 'ACTIVE') return;

        // Get current spread
        let currentSpread = trade.entrySpread; // Default to entry if no provider
        if (this.getCurrentSpread) {
            const spread = this.getCurrentSpread(trade.symbol, trade.longExchange, trade.shortExchange);
            if (spread !== null) {
                currentSpread = spread;
            }
        }

        // Update best spread seen
        if (currentSpread < state.bestSpread) {
            state.bestSpread = currentSpread;
            console.log(`[ExitManager] ${trade.id}: New best spread ${currentSpread.toFixed(3)}% (entry: ${trade.entrySpread.toFixed(3)}%)`);
        }

        // Check exit conditions
        const exitReason = this.evaluateExitConditions(state, currentSpread);

        if (exitReason) {
            console.log(`[ExitManager] 🚨 EXIT TRIGGERED for ${trade.id}: ${exitReason} (spread: ${currentSpread.toFixed(3)}%)`);

            // Update trade PnL estimate
            const spreadImprovement = trade.entrySpread - currentSpread;
            trade.exitSpread = currentSpread;
            trade.pnl = (trade.quantity * trade.entryPriceLong * spreadImprovement) / 100;

            // Trigger exit callback
            if (this.onExitTrigger) {
                await this.onExitTrigger(trade, exitReason, currentSpread);
            }

            // Remove from monitoring
            this.tradeStates.delete(trade.id);
        }
    }

    /**
     * Evaluate all exit conditions
     */
    private evaluateExitConditions(state: TradeState, currentSpread: number): string | null {
        const { trade } = state;
        const now = Date.now();

        // 1. Take Profit
        if (currentSpread <= this.config.takeProfitSpread) {
            return `Take Profit: spread ${currentSpread.toFixed(3)}% <= target ${this.config.takeProfitSpread}%`;
        }

        // 2. Stop Loss
        const spreadWorsening = currentSpread - trade.entrySpread;
        if (spreadWorsening >= this.config.stopLossSpread) {
            return `Stop Loss: spread worsened by ${spreadWorsening.toFixed(3)}% (limit: ${this.config.stopLossSpread}%)`;
        }

        // 3. Trailing Exit
        if (this.config.trailingEnabled) {
            const spreadImprovement = trade.entrySpread - state.bestSpread;

            // Activate trailing if improved enough
            if (!state.trailingActive && spreadImprovement >= this.config.trailingActivation) {
                state.trailingActive = true;
                console.log(`[ExitManager] ${trade.id}: Trailing activated (improvement: ${spreadImprovement.toFixed(3)}%)`);
            }

            // Check trailing stop
            if (state.trailingActive) {
                const retracement = currentSpread - state.bestSpread;
                if (retracement >= this.config.trailingDistance) {
                    return `Trailing Exit: retraced ${retracement.toFixed(3)}% from best ${state.bestSpread.toFixed(3)}%`;
                }
            }
        }

        // 4. Time Exit
        if (this.config.maxHoldTimeMs > 0) {
            const holdTime = now - state.entryTime;
            if (holdTime >= this.config.maxHoldTimeMs) {
                const holdMinutes = Math.round(holdTime / 1000 / 60);
                return `Time Exit: held for ${holdMinutes} minutes (max: ${this.config.maxHoldTimeMs / 1000 / 60} min)`;
            }
        }

        return null; // No exit triggered
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<ExitConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current config
     */
    getConfig(): ExitConfig {
        return { ...this.config };
    }

    /**
     * Get all trade states (for debugging/display)
     */
    getTradeStates(): Array<{ tradeId: string; bestSpread: number; trailingActive: boolean; holdTimeMs: number }> {
        return Array.from(this.tradeStates.entries()).map(([id, state]) => ({
            tradeId: id,
            bestSpread: state.bestSpread,
            trailingActive: state.trailingActive,
            holdTimeMs: Date.now() - state.entryTime,
        }));
    }
}
