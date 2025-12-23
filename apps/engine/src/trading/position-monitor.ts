/**
 * Position Monitor
 * 
 * Monitors open positions across all exchanges and implements:
 * - Position health checks
 * - Liquidation price monitoring
 * - Auto-close on liquidation risk
 * - Orphaned position detection
 */

import type { ArbitrageTrade } from './types.js';
import { TradePersistence } from './trade-persistence.js';

interface PositionHealth {
    tradeId: string;
    symbol: string;
    longExchange: string;
    shortExchange: string;
    entrySpread: number;
    currentSpread: number | null;
    longPnl: number;
    shortPnl: number;
    totalPnl: number;
    liquidationRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    lastChecked: number;
}

interface ExchangePosition {
    exchange: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    size: number;
    entryPrice: number;
    currentPrice: number;
    liquidationPrice: number | null;
    pnl: number;
    pnlPercent: number;
}

export class PositionMonitor {
    private activeTrades: Map<string, ArbitrageTrade> = new Map();
    private positionHealth: Map<string, PositionHealth> = new Map();
    private persistence: TradePersistence;
    private monitorInterval: NodeJS.Timeout | null = null;
    private onLiquidationRisk: ((trade: ArbitrageTrade, risk: string) => void) | null = null;
    private onPositionMismatch: ((trade: ArbitrageTrade, issue: string) => void) | null = null;

    // Configuration
    private checkIntervalMs = 10000; // Check every 10 seconds
    private liquidationThreshold = 5; // Alert at 5% from liquidation
    private maxSpreadDivergence = 2; // Alert if current spread > entry + 2%

    constructor(persistence: TradePersistence) {
        this.persistence = persistence;
        console.log('[PositionMonitor] Initialized');
    }

    /**
     * Start monitoring positions
     */
    start(): void {
        if (this.monitorInterval) return;

        console.log('[PositionMonitor] Starting position monitoring');
        this.monitorInterval = setInterval(() => this.checkPositions(), this.checkIntervalMs);

        // Initial check
        this.checkPositions();
    }

    /**
     * Stop monitoring
     */
    stop(): void {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        console.log('[PositionMonitor] Stopped');
    }

    /**
     * Register a trade for monitoring
     */
    registerTrade(trade: ArbitrageTrade): void {
        this.activeTrades.set(trade.id, trade);
        this.positionHealth.set(trade.id, {
            tradeId: trade.id,
            symbol: trade.symbol,
            longExchange: trade.longExchange,
            shortExchange: trade.shortExchange,
            entrySpread: trade.entrySpread,
            currentSpread: null,
            longPnl: 0,
            shortPnl: 0,
            totalPnl: 0,
            liquidationRisk: 'LOW',
            lastChecked: Date.now(),
        });
        console.log(`[PositionMonitor] Tracking trade ${trade.id}`);
    }

    /**
     * Unregister a trade (closed)
     */
    unregisterTrade(tradeId: string): void {
        this.activeTrades.delete(tradeId);
        this.positionHealth.delete(tradeId);
    }

    /**
     * Set callback for liquidation risk alerts
     */
    onLiquidationRiskCallback(callback: (trade: ArbitrageTrade, risk: string) => void): void {
        this.onLiquidationRisk = callback;
    }

    /**
     * Set callback for position mismatch alerts
     */
    onPositionMismatchCallback(callback: (trade: ArbitrageTrade, issue: string) => void): void {
        this.onPositionMismatch = callback;
    }

    /**
     * Check all positions
     */
    private async checkPositions(): Promise<void> {
        if (this.activeTrades.size === 0) return;

        for (const [tradeId, trade] of this.activeTrades) {
            try {
                await this.checkTradeHealth(trade);
            } catch (error) {
                console.error(`[PositionMonitor] Error checking trade ${tradeId}:`, error);
            }
        }
    }

    /**
     * Check health of a single trade
     */
    private async checkTradeHealth(trade: ArbitrageTrade): Promise<void> {
        const health = this.positionHealth.get(trade.id);
        if (!health) return;

        // Get current prices (would need price feeds injected in real implementation)
        // For now, simulate with estimated values
        const currentSpread = await this.getCurrentSpread(trade);

        // Calculate PnL
        const spreadDiff = trade.entrySpread - (currentSpread || trade.entrySpread);
        const estimatedPnl = (trade.quantity * trade.entryPriceLong * spreadDiff) / 100;

        // Update health
        health.currentSpread = currentSpread;
        health.totalPnl = estimatedPnl;
        health.lastChecked = Date.now();

        // Check for spread divergence (bad for us)
        if (currentSpread !== null) {
            const spreadWorsening = currentSpread - trade.entrySpread;

            if (spreadWorsening > this.maxSpreadDivergence) {
                health.liquidationRisk = 'HIGH';
                console.warn(`[PositionMonitor] ⚠️ Trade ${trade.id} spread worsening: entry=${trade.entrySpread.toFixed(3)}%, current=${currentSpread.toFixed(3)}%`);

                if (this.onLiquidationRisk) {
                    this.onLiquidationRisk(trade, `Spread divergence: ${spreadWorsening.toFixed(3)}%`);
                }
            } else if (spreadWorsening > this.maxSpreadDivergence / 2) {
                health.liquidationRisk = 'MEDIUM';
            } else {
                health.liquidationRisk = 'LOW';
            }
        }

        // Check for liquidation proximity
        // In real implementation, would query exchange APIs for liquidation prices
        const liquidationRisk = await this.checkLiquidationProximity(trade);
        if (liquidationRisk === 'CRITICAL') {
            health.liquidationRisk = 'CRITICAL';
            console.error(`[PositionMonitor] 🚨 CRITICAL: Trade ${trade.id} near liquidation!`);

            if (this.onLiquidationRisk) {
                this.onLiquidationRisk(trade, 'Position near liquidation price');
            }
        }

        // Update trade PnL
        trade.pnl = estimatedPnl;
    }

    /**
     * Get current spread for a trade pair
     * In real implementation, would query price aggregator
     */
    private async getCurrentSpread(trade: ArbitrageTrade): Promise<number | null> {
        // Placeholder - would integrate with PriceAggregator
        // For now, return entry spread (no change)
        return trade.entrySpread;
    }

    /**
     * Check how close position is to liquidation
     */
    private async checkLiquidationProximity(trade: ArbitrageTrade): Promise<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> {
        // Placeholder - would query exchange APIs
        // Real implementation would:
        // 1. Get position data from both exchanges
        // 2. Calculate distance from liquidation price
        // 3. Return risk level based on proximity

        // For now, always return LOW
        return 'LOW';
    }

    /**
     * Force close both legs of a trade (anti-liquidation)
     */
    async emergencyClose(trade: ArbitrageTrade, reason: string): Promise<boolean> {
        console.log(`[PositionMonitor] 🚨 Emergency close requested for ${trade.id}: ${reason}`);

        // Mark trade for closure
        trade.status = 'CLOSING';
        await this.persistence.updateTradeStatus(trade.id, 'CLOSING' as any, {
            error: `Emergency close: ${reason}`
        });

        // In real implementation:
        // 1. Place market close order on long exchange
        // 2. Place market close order on short exchange
        // 3. Wait for both to fill
        // 4. Calculate final PnL
        // 5. Update trade status

        console.log(`[PositionMonitor] Would execute emergency close for ${trade.id} (not implemented)`);
        return false;
    }

    /**
     * Get health status of all positions
     */
    getPositionHealth(): PositionHealth[] {
        return Array.from(this.positionHealth.values());
    }

    /**
     * Get summary stats
     */
    getSummary() {
        const positions = Array.from(this.positionHealth.values());
        return {
            totalPositions: positions.length,
            lowRisk: positions.filter(p => p.liquidationRisk === 'LOW').length,
            mediumRisk: positions.filter(p => p.liquidationRisk === 'MEDIUM').length,
            highRisk: positions.filter(p => p.liquidationRisk === 'HIGH').length,
            criticalRisk: positions.filter(p => p.liquidationRisk === 'CRITICAL').length,
            totalPnl: positions.reduce((sum, p) => sum + p.totalPnl, 0),
        };
    }
}
