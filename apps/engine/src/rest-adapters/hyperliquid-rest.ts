import { BaseRESTAdapter, type RESTAdapterConfig } from './base-rest-adapter.js';
import type { PriceData } from '@arbitrage/shared';
import { normalizeSymbol } from '@arbitrage/shared';

/**
 * Hyperliquid REST Adapter
 * 
 * Uses POST https://api.hyperliquid.xyz/info
 * Body: { "type": "l2Book", "coin": "BTC" }
 * 
 * Response: { levels: [[{ px, sz, n }], [{ px, sz, n }]] }
 * levels[0] = bids, levels[1] = asks
 */
export class HyperliquidRESTAdapter extends BaseRESTAdapter {
    readonly exchangeId = 'hyperliquid';
    private readonly apiUrl = 'https://api.hyperliquid.xyz/info';

    // Complete list from WebSocket adapter
    private readonly coins = [
        // Tier 1 - Major tokens
        'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'AVAX', 'SUI', 'LINK', 'LTC',
        // Tier 2 - Popular alts
        'ARB', 'OP', 'APT', 'NEAR', 'DOT', 'TON', 'TAO', 'TIA',
        'AAVE', 'UNI', 'ENA', 'SEI', 'WIF', 'JUP', 'HYPE', 'BERA',
        // Tier 3 - Trending tokens
        'PEPE', 'BONK', 'WLD', 'TRUMP', 'FARTCOIN', 'PENGU', 'ONDO',
        'PENDLE', 'LDO', 'CRV', 'GMX', 'DYDX', 'TRX', 'ATOM', 'ADA',
        // Tier 4 - Additional tokens
        'AERO', 'APEX', 'ASTER', 'AVNT', 'CAKE', 'EIGEN', 'GOAT', 'GRASS', 'IP',
        'KAITO', 'LINEA', 'MNT', 'MON', 'MOODENG', 'POPCAT', 'PUMP', 'RESOLV', 'S',
        'SNX', 'STRK', 'VIRTUAL', 'WLFI', 'XPL', 'ZEC', 'ZORA', 'ZRO',
        // Tier 5 - More tokens
        '0G', 'AIXBT', 'BCH', 'FIL', 'HBAR', 'ICP', 'INIT', 'INJ', 'JTO',
        'OM', 'ORDI', 'PAXG', 'POL', 'PYTH', 'RUNE', 'XLM', 'XMR', 'ZK',
        'kBONK', 'kFLOKI', 'kPEPE', 'kSHIB', 'MELANIA', 'MORPHO', 'USUAL', 'VVV', 'WCT', 'MEGA', 'LIT',
    ];

    constructor(config?: Partial<RESTAdapterConfig>) {
        super({ symbols: config?.symbols || [] });
    }

    // Batch size for parallel requests (conservative to avoid rate limits)
    private readonly BATCH_SIZE = 5;
    private readonly BATCH_DELAY_MS = 500;

    async fetchPrices(): Promise<PriceData[]> {
        const prices: PriceData[] = [];

        // Split coins into chunks for parallel processing
        const chunks: string[][] = [];
        for (let i = 0; i < this.coins.length; i += this.BATCH_SIZE) {
            chunks.push(this.coins.slice(i, i + this.BATCH_SIZE));
        }

        // Process chunks sequentially, items within each chunk in parallel
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex];

            const chunkPromises = chunk.map(async (coin) => {
                try {
                    const response = await fetch(this.apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'l2Book', coin }),
                    });

                    if (!response.ok) {
                        if (response.status !== 404) {
                            console.error(`[${this.exchangeId}] REST error for ${coin}: ${response.status}`);
                        }
                        return null;
                    }

                    const data = await response.json();

                    // Null check to prevent crashes
                    if (data?.levels && data.levels[0]?.length > 0 && data.levels[1]?.length > 0) {
                        const bestBid = parseFloat(data.levels[0][0].px);
                        const bestAsk = parseFloat(data.levels[1][0].px);

                        if (bestBid > 0 && bestAsk > 0) {
                            return this.createPriceData(normalizeSymbol(coin), bestBid, bestAsk);
                        }
                    }
                } catch (error) {
                    console.error(`[${this.exchangeId}] REST fetch error for ${coin}:`, error);
                }
                return null;
            });

            const chunkResults = await Promise.all(chunkPromises);
            for (const result of chunkResults) {
                if (result) prices.push(result);
            }

            // Delay between batches (except for last batch)
            if (chunkIndex < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY_MS));
            }
        }

        console.log(`[${this.exchangeId}] REST fetched ${prices.length}/${this.coins.length} prices (${chunks.length} batches)`);
        return prices;
    }
}
