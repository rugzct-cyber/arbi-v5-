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
     * Insert a batch of prices - each price keeps its own timestamp
     */
    async insertBatch(prices: PriceData[]): Promise<void> {
        if (!this.connected || prices.length === 0) return;

        console.log(`📊 Inserting ${prices.length} prices (individual timestamps)`);

        const records = prices.map(price => ({
            timestamp: new Date(price.timestamp).toISOString(),  // Use price's own timestamp
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
