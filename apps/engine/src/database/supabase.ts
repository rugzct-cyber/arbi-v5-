import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { PriceData } from '@arbitrage/shared';

interface SupabaseConfig {
    url: string;
    serviceKey: string;
}

export class SupabasePriceClient {
    private client: SupabaseClient;
    private connected = false;

    constructor(config: SupabaseConfig) {
        this.client = createClient(config.url, config.serviceKey);
        this.connected = true;
        console.log(`✅ Connected to Supabase at ${config.url}`);
    }

    /**
     * Insert a batch of prices with a unified snapshot timestamp
     * All prices get the same timestamp for perfect synchronization
     */
    async insertBatch(prices: PriceData[]): Promise<void> {
        if (!this.connected || prices.length === 0) return;

        // Snapshot timestamp - same for all prices in this batch
        const snapshotTimestamp = new Date().toISOString();

        console.log(`📸 Snapshot: ${prices.length} prices @ ${snapshotTimestamp}`);

        const records = prices.map(price => ({
            timestamp: snapshotTimestamp,  // Unified snapshot timestamp
            exchange: price.exchange,
            symbol: price.symbol,
            bid: price.bid,
            ask: price.ask,
        }));

        const { error } = await this.client
            .from('prices')
            .insert(records);

        if (error) {
            console.error('❌ Supabase insert failed:', error.message);
        } else {
            console.log(`✅ Saved ${prices.length} prices to Supabase`);
        }
    }

    async close(): Promise<void> {
        this.connected = false;
        console.log('🔌 Supabase connection closed');
    }
}
