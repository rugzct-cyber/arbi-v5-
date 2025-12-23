/**
 * Scaled Order Executor
 * 
 * Splits large orders into smaller chunks to:
 * - Reduce market impact
 * - Get better average prices
 * - Implement TWAP (Time-Weighted Average Price)
 */

import type { Order, TradeSide, OrderStatus } from './types.js';
import type { OrderExecutor } from './trade-executor.js';

export interface ScaleConfig {
    // Maximum size per chunk (USD)
    maxChunkSize: number;

    // Delay between chunks (ms)
    chunkDelayMs: number;

    // Enable TWAP (spread execution over time)
    twapEnabled: boolean;

    // TWAP duration (ms) - total time to execute all chunks
    twapDurationMs: number;

    // Abort if price moves against us by this %
    maxSlippagePercent: number;
}

export const DEFAULT_SCALE_CONFIG: ScaleConfig = {
    maxChunkSize: 500, // $500 per chunk
    chunkDelayMs: 1000, // 1 second between chunks
    twapEnabled: false,
    twapDurationMs: 60000, // 1 minute TWAP
    maxSlippagePercent: 0.5, // Abort if price moves 0.5%
};

export interface ChunkResult {
    chunkIndex: number;
    order: Order | null;
    success: boolean;
    error?: string;
}

export interface ScaledExecutionResult {
    success: boolean;
    totalSize: number;
    executedSize: number;
    avgPrice: number;
    chunks: ChunkResult[];
    aborted: boolean;
    abortReason?: string;
}

export class ScaledOrderExecutor {
    private config: ScaleConfig;

    constructor(config: Partial<ScaleConfig> = {}) {
        this.config = { ...DEFAULT_SCALE_CONFIG, ...config };
        console.log('[ScaledOrderExecutor] Initialized');
        console.log(`  - Max chunk: $${this.config.maxChunkSize}`);
        console.log(`  - Delay: ${this.config.chunkDelayMs}ms`);
        console.log(`  - TWAP: ${this.config.twapEnabled ? 'ON' : 'OFF'}`);
    }

    /**
     * Execute a large order in chunks
     */
    async executeScaled(
        executor: OrderExecutor,
        symbol: string,
        side: TradeSide,
        totalSizeUsd: number,
        referencePrice: number,
        onProgress?: (completed: number, total: number) => void
    ): Promise<ScaledExecutionResult> {
        // Calculate number of chunks
        const numChunks = Math.ceil(totalSizeUsd / this.config.maxChunkSize);
        const chunkSize = totalSizeUsd / numChunks;

        console.log(`[ScaledOrderExecutor] Executing $${totalSizeUsd} in ${numChunks} chunks of $${chunkSize.toFixed(2)}`);

        // Calculate delay between chunks
        let delayMs = this.config.chunkDelayMs;
        if (this.config.twapEnabled && numChunks > 1) {
            delayMs = this.config.twapDurationMs / (numChunks - 1);
        }

        const chunks: ChunkResult[] = [];
        let executedSize = 0;
        let totalValue = 0;
        let aborted = false;
        let abortReason: string | undefined;

        for (let i = 0; i < numChunks; i++) {
            if (aborted) break;

            const chunkSizeUsd = i === numChunks - 1
                ? totalSizeUsd - executedSize // Last chunk gets remainder
                : chunkSize;

            const quantity = chunkSizeUsd / referencePrice;

            try {
                console.log(`[ScaledOrderExecutor] Chunk ${i + 1}/${numChunks}: ${side} ${quantity.toFixed(6)} @ ~$${referencePrice}`);

                const order = await executor.placeOrder(symbol, side === 'LONG' ? 'BUY' : 'SELL', quantity);

                if (order.status === 'FILLED') {
                    executedSize += chunkSizeUsd;
                    totalValue += order.filledQuantity * order.price;

                    chunks.push({
                        chunkIndex: i,
                        order,
                        success: true,
                    });

                    // Check for slippage abort
                    const currentSlippage = Math.abs((order.price - referencePrice) / referencePrice);
                    if (currentSlippage > this.config.maxSlippagePercent / 100) {
                        aborted = true;
                        abortReason = `Slippage exceeded: ${(currentSlippage * 100).toFixed(2)}% > ${this.config.maxSlippagePercent}%`;
                        console.warn(`[ScaledOrderExecutor] ${abortReason}`);
                    }
                } else {
                    chunks.push({
                        chunkIndex: i,
                        order,
                        success: false,
                        error: `Order not filled: ${order.status}`,
                    });

                    // Abort on failed chunk
                    aborted = true;
                    abortReason = `Chunk ${i + 1} failed: ${order.status}`;
                }

                // Report progress
                if (onProgress) {
                    onProgress(i + 1, numChunks);
                }

                // Wait before next chunk (except for last one)
                if (i < numChunks - 1 && !aborted) {
                    await this.sleep(delayMs);
                }

            } catch (error) {
                chunks.push({
                    chunkIndex: i,
                    order: null,
                    success: false,
                    error: String(error),
                });

                aborted = true;
                abortReason = `Chunk ${i + 1} error: ${error}`;
            }
        }

        const avgPrice = executedSize > 0 ? totalValue / (executedSize / referencePrice) : referencePrice;

        console.log(`[ScaledOrderExecutor] Completed: $${executedSize.toFixed(2)}/$${totalSizeUsd} @ avg $${avgPrice.toFixed(2)}`);

        return {
            success: !aborted && executedSize >= totalSizeUsd * 0.99, // 99% threshold
            totalSize: totalSizeUsd,
            executedSize,
            avgPrice,
            chunks,
            aborted,
            abortReason,
        };
    }

    /**
     * Execute both legs of an arbitrage trade with scaling
     */
    async executeArbitrageScaled(
        longExecutor: OrderExecutor,
        shortExecutor: OrderExecutor,
        symbol: string,
        totalSizeUsd: number,
        longPrice: number,
        shortPrice: number
    ): Promise<{ long: ScaledExecutionResult; short: ScaledExecutionResult; success: boolean }> {
        // Execute long side first
        console.log(`[ScaledOrderExecutor] Executing LONG leg on ${longExecutor.exchangeId}`);
        const longResult = await this.executeScaled(longExecutor, symbol, 'LONG', totalSizeUsd / 2, longPrice);

        if (!longResult.success) {
            return {
                long: longResult,
                short: { success: false, totalSize: 0, executedSize: 0, avgPrice: 0, chunks: [], aborted: true, abortReason: 'Long leg failed' },
                success: false,
            };
        }

        // Execute short side
        console.log(`[ScaledOrderExecutor] Executing SHORT leg on ${shortExecutor.exchangeId}`);
        const shortResult = await this.executeScaled(shortExecutor, symbol, 'SHORT', totalSizeUsd / 2, shortPrice);

        return {
            long: longResult,
            short: shortResult,
            success: longResult.success && shortResult.success,
        };
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<ScaleConfig>): void {
        this.config = { ...this.config, ...config };
    }
}
