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
        'kBONK', 'kFLOKI', 'kPEPE', 'kSHIB', 'MELANIA', 'MORPHO', 'USUAL', 'VVV', 'WCT', 'MEGA',
    ];

    constructor(config?: Partial<RESTAdapterConfig>) {
        super({ symbols: config?.symbols || [] });
    }

    async fetchPrices(): Promise<PriceData[]> {
        const prices: PriceData[] = [];

        const fetchPromises = this.coins.map(async (coin, i) => {
            // Stagger requests to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, i * 30));

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

                // Format: levels[0] = bids, levels[1] = asks
                if (data.levels && data.levels[0]?.length > 0 && data.levels[1]?.length > 0) {
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

        const results = await Promise.all(fetchPromises);
        for (const result of results) {
            if (result) prices.push(result);
        }

        console.log(`[${this.exchangeId}] REST fetched ${prices.length}/${this.coins.length} prices`);
        return prices;
    }
}
