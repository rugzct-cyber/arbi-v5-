import type { PriceData } from '@arbitrage/shared';
import type { BaseRESTAdapter } from './base-rest-adapter.js';
import { HyperliquidRESTAdapter } from './hyperliquid-rest.js';
import { ParadexRESTAdapter } from './paradex-rest.js';
import { LighterRESTAdapter } from './lighter-rest.js';
import { PacificaRESTAdapter } from './pacifica-rest.js';
import { EtherealRESTAdapter } from './ethereal-rest.js';
import { ExtendedRESTAdapter } from './extended-rest.js';
import { VestRESTAdapter } from './vest-rest.js';
import { NadoRESTAdapter } from './nado-rest.js';
import type { SupabasePriceClient } from '../database/supabase.js';

export interface RESTPollerConfig {
    supabase: SupabasePriceClient;
    intervalMs?: number; // Default: 5 minutes
}

/**
 * REST Poller Service
 * 
 * Fetches prices from all REST adapters in parallel at synchronized intervals.
 * All prices are collected at the same timestamp for accurate DB snapshots.
 */
export class RESTPoller {
    private adapters: BaseRESTAdapter[] = [];
    private supabase: SupabasePriceClient;
    private intervalMs: number;
    private intervalHandle: NodeJS.Timeout | null = null;

    constructor(config: RESTPollerConfig) {
        this.supabase = config.supabase;
        this.intervalMs = config.intervalMs || 5 * 60 * 1000; // 5 minutes

        // Initialize all REST adapters
        this.adapters.push(new HyperliquidRESTAdapter());
        this.adapters.push(new ParadexRESTAdapter());
        this.adapters.push(new LighterRESTAdapter());
        this.adapters.push(new PacificaRESTAdapter());
        this.adapters.push(new EtherealRESTAdapter());
        this.adapters.push(new ExtendedRESTAdapter());
        this.adapters.push(new VestRESTAdapter());
        this.adapters.push(new NadoRESTAdapter());

        console.log(`📡 REST Poller initialized with ${this.adapters.length} adapters`);
    }

    /**
     * Start polling at aligned 5-minute intervals (xx:00, xx:05, xx:10, etc.)
     */
    start(): void {
        // Calculate delay until next aligned interval
        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const ms = now.getMilliseconds();

        const nextAligned = Math.ceil((minutes + 1) / 5) * 5;
        const minutesUntilNext = (nextAligned - minutes - 1 + 60) % 60 || 5;
        const msUntilNext = (minutesUntilNext * 60 - seconds) * 1000 - ms;

        console.log(`⏰ Next REST snapshot in ${Math.round(msUntilNext / 1000)}s at :${String(nextAligned % 60).padStart(2, '0')}`);

        // Initial fetch after 30 seconds for testing
        setTimeout(async () => {
            console.log('🚀 Initial REST snapshot (30s after startup)...');
            await this.fetchAndSave();

            // Then start aligned polling
            setTimeout(() => {
                this.fetchAndSave(); // First aligned fetch
                this.intervalHandle = setInterval(() => this.fetchAndSave(), this.intervalMs);
            }, msUntilNext);
        }, 30000);
    }

    /**
     * Fetch prices from all adapters and save to database
     */
    async fetchAndSave(): Promise<void> {
        const startTime = Date.now();
        console.log(`📊 [${new Date(startTime).toISOString()}] REST polling all exchanges...`);

        try {
            // Fetch from all adapters in parallel
            const results = await Promise.allSettled(
                this.adapters.map(adapter => adapter.fetchPrices())
            );

            // Collect all prices
            const allPrices: PriceData[] = [];
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    allPrices.push(...result.value);
                } else {
                    console.error('REST adapter error:', result.reason);
                }
            }

            if (allPrices.length === 0) {
                console.log('⚠️ No prices fetched from REST APIs');
                return;
            }

            // Save to database
            await this.supabase.insertBatch(allPrices);
            const duration = Date.now() - startTime;
            console.log(`✅ Saved ${allPrices.length} REST prices to Supabase (took ${duration}ms)`);
        } catch (error) {
            console.error('❌ REST polling failed:', error);
        }
    }

    stop(): void {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
    }
}

// Re-export adapters
export { BaseRESTAdapter } from './base-rest-adapter.js';
export { HyperliquidRESTAdapter } from './hyperliquid-rest.js';
export { ParadexRESTAdapter } from './paradex-rest.js';
export { LighterRESTAdapter } from './lighter-rest.js';
export { PacificaRESTAdapter } from './pacifica-rest.js';
export { EtherealRESTAdapter } from './ethereal-rest.js';
export { ExtendedRESTAdapter } from './extended-rest.js';
export { VestRESTAdapter } from './vest-rest.js';
export { NadoRESTAdapter } from './nado-rest.js';

