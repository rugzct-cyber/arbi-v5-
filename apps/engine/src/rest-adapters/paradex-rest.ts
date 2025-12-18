import { BaseRESTAdapter, type RESTAdapterConfig } from './base-rest-adapter.js';
import type { PriceData } from '@arbitrage/shared';
import { normalizeSymbol } from '@arbitrage/shared';

interface OrderbookResponse {
    market: string;
    bids: Array<[string, string]>; // [price, size]
    asks: Array<[string, string]>; // [price, size]
}

/**
 * Paradex REST Adapter
 * 
 * Uses GET https://api.prod.paradex.trade/v1/orderbook/{market}?depth=1
 * Markets are formatted as SYMBOL-USD-PERP (e.g., BTC-USD-PERP)
 * 
 * Response: { bids: [["88255.2", "0.437"]], asks: [["88259.5", "0.01"]] }
 */
export class ParadexRESTAdapter extends BaseRESTAdapter {
    readonly exchangeId = 'paradex';
    private readonly apiUrl = 'https://api.prod.paradex.trade/v1/orderbook';

    constructor(config?: Partial<RESTAdapterConfig>) {
        super({
            // Complete list from WebSocket adapter
            symbols: config?.symbols || [
                // Tier 1 - Major tokens
                'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'AVAX', 'SUI', 'LINK', 'LTC',
                // Tier 2 - Popular alts
                'ARB', 'OP', 'APT', 'NEAR', 'DOT', 'TON', 'TAO', 'TIA',
                'AAVE', 'UNI', 'ENA', 'SEI', 'WIF', 'JUP', 'HYPE', 'BERA',
                // Tier 3 - Trending tokens
                'PEPE', 'BONK', 'WLD', 'TRUMP', 'FARTCOIN', 'PENGU', 'ONDO',
                'PENDLE', 'LDO', 'ATOM', 'ADA',
                // Tier 4 - Additional tokens
                'AERO', 'APEX', 'ASTER', 'AVNT', 'CAKE', 'CRV', 'EIGEN', 'GOAT', 'GRASS', 'IP',
                'KAITO', 'LINEA', 'MNT', 'MON', 'MOODENG', 'POPCAT', 'PUMP', 'RESOLV', 'S',
                'SNX', 'STRK', 'TRX', 'VIRTUAL', 'WLFI', 'XPL', 'ZEC', 'ZORA', 'ZRO',
                // Tier 5 - More tokens
                '0G', 'AIXBT', 'BCH', 'FIL', 'GMX', 'DYDX', 'HBAR', 'ICP', 'INIT', 'INJ', 'JTO',
                'OM', 'ORDI', 'PAXG', 'POL', 'PYTH', 'RUNE', 'XLM', 'XMR', 'ZK',
                'MELANIA', 'MORPHO', 'USUAL', 'VVV', 'WCT', 'MEGA',
                // Tier 6 - User requested tokens
                'CC', 'MET', 'FF', 'SYRUP', 'DOLO', 'PROVE', 'STBL', 'MYX', 'SPX', 'ETHFI',
                'QNT', 'BAT', 'CLANKER', 'DASH', 'HYPER', 'FLOW', 'WOO', 'YB',
            ],
        });
    }

    private formatMarket(symbol: string): string {
        return `${symbol}-USD-PERP`;
    }

    async fetchPrices(): Promise<PriceData[]> {
        const prices: PriceData[] = [];

        const fetchPromises = this.config.symbols.map(async (symbol, index) => {
            await new Promise(resolve => setTimeout(resolve, index * 50));

            try {
                const market = this.formatMarket(symbol);
                const response = await fetch(`${this.apiUrl}/${market}?depth=1`);

                if (!response.ok) {
                    if (response.status !== 404) {
                        console.error(`[${this.exchangeId}] REST error for ${symbol}: ${response.status}`);
                    }
                    return null;
                }

                const data: OrderbookResponse = await response.json();

                // Format: bids: [["price", "size"]], asks: [["price", "size"]]
                if (data.bids?.length > 0 && data.asks?.length > 0) {
                    const bestBid = parseFloat(data.bids[0][0]);
                    const bestAsk = parseFloat(data.asks[0][0]);

                    if (bestBid > 0 && bestAsk > 0) {
                        return this.createPriceData(normalizeSymbol(symbol), bestBid, bestAsk);
                    }
                }
            } catch (error) {
                console.error(`[${this.exchangeId}] REST fetch error for ${symbol}:`, error);
            }
            return null;
        });

        const results = await Promise.all(fetchPromises);
        for (const result of results) {
            if (result) prices.push(result);
        }

        console.log(`[${this.exchangeId}] REST fetched ${prices.length}/${this.config.symbols.length} prices`);
        return prices;
    }
}
