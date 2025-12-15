import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

/**
 * Lighter (zkLighter) WebSocket Adapter
 * 
 * Docs: https://apidocs.lighter.xyz/docs/websocket-reference
 * 
 * URL: wss://mainnet.zklighter.elliot.ai/stream
 * 
 * Uses order_book channel to get real bid/ask prices.
 * 
 * Subscribe format:
 * { "type": "subscribe", "channel": "order_book/{MARKET_INDEX}" }
 */
export class LighterWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'lighter';
    readonly wsUrl = 'wss://mainnet.zklighter.elliot.ai/stream';

    // COMPLETE market index to symbol mapping from Lighter API
    // Source: https://mainnet.zklighter.elliot.ai/api/v1/orderBooks
    private readonly marketSymbols: Record<number, string> = {
        0: 'ETH-USD', 1: 'BTC-USD', 2: 'SOL-USD', 3: 'DOGE-USD', 4: '1000PEPE-USD',
        5: 'WIF-USD', 6: 'WLD-USD', 7: 'XRP-USD', 8: 'LINK-USD', 9: 'AVAX-USD',
        10: 'NEAR-USD', 11: 'DOT-USD', 12: 'TON-USD', 13: 'TAO-USD', 14: 'POL-USD',
        15: 'TRUMP-USD', 16: 'SUI-USD', 17: '1000SHIB-USD', 18: '1000BONK-USD', 19: '1000FLOKI-USD',
        20: 'BERA-USD', 21: 'FARTCOIN-USD', 23: 'POPCAT-USD', 24: 'HYPE-USD', 25: 'BNB-USD',
        26: 'JUP-USD', 27: 'AAVE-USD', 29: 'ENA-USD', 30: 'UNI-USD', 31: 'APT-USD',
        32: 'SEI-USD', 33: 'KAITO-USD', 34: 'IP-USD', 35: 'LTC-USD', 36: 'CRV-USD',
        37: 'PENDLE-USD', 38: 'ONDO-USD', 39: 'ADA-USD', 40: 'S-USD', 41: 'VIRTUAL-USD',
        42: 'SPX-USD', 43: 'TRX-USD', 44: 'SYRUP-USD', 45: 'PUMP-USD', 46: 'LDO-USD',
        47: 'PENGU-USD', 48: 'PAXG-USD', 49: 'EIGEN-USD', 50: 'ARB-USD', 51: 'RESOLV-USD',
        52: 'GRASS-USD', 53: 'ZORA-USD', 55: 'OP-USD', 56: 'ZK-USD', 57: 'PROVE-USD',
        58: 'BCH-USD', 59: 'HBAR-USD', 60: 'ZRO-USD', 61: 'GMX-USD', 62: 'DYDX-USD',
        63: 'MNT-USD', 64: 'ETHFI-USD', 65: 'AERO-USD', 66: 'USELESS-USD', 67: 'TIA-USD',
        68: 'MORPHO-USD', 69: 'VVV-USD', 70: 'YZY-USD', 71: 'XPL-USD', 72: 'WLFI-USD',
        73: 'CRO-USD', 74: 'NMR-USD', 75: 'DOLO-USD', 76: 'LINEA-USD', 77: 'XMR-USD',
        78: 'PYTH-USD', 79: 'SKY-USD', 80: 'MYX-USD', 81: '1000TOSHI-USD', 82: 'AVNT-USD',
        83: 'ASTER-USD', 84: '0G-USD', 85: 'STBL-USD', 86: 'APEX-USD', 87: 'FF-USD',
        88: '2Z-USD', 89: 'EDEN-USD', 90: 'ZEC-USD', 91: 'MON-USD', 92: 'XAU-USD',
        93: 'XAG-USD', 94: 'MEGA-USD', 95: 'MET-USD', 96: 'EURUSD-USD', 97: 'GBPUSD-USD',
        98: 'USDJPY-USD', 99: 'USDCHF-USD', 100: 'USDCAD-USD', 101: 'CC-USD', 102: 'ICP-USD',
        103: 'FIL-USD', 104: 'STRK-USD', 105: 'USDKRW-USD', 106: 'AUDUSD-USD', 107: 'NZDUSD-USD',
        108: 'HOOD-USD', 109: 'COIN-USD', 110: 'NVDA-USD', 111: 'PLTR-USD', 112: 'TSLA-USD',
        113: 'AAPL-USD', 114: 'AMZN-USD', 115: 'MSFT-USD', 116: 'GOOGL-USD', 117: 'META-USD',
        118: 'STABLE-USD', 119: 'XLM-USD',
    };

    // Main markets to subscribe to (all active perp markets)
    private readonly subscribedMarkets = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
        20, 21, 23, 24, 25, 26, 27, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
        40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 55, 56, 57, 58,
        59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76,
        77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94,
        95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110,
        111, 112, 113, 114, 115, 116, 117, 118, 119
    ];

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.subscribeToOrderBooks();
    }

    private subscribeToOrderBooks(): void {
        // Subscribe to order books for selected markets
        for (const marketIndex of this.subscribedMarkets) {
            this.send({
                type: 'subscribe',
                channel: `order_book/${marketIndex}`,
            });
        }

        console.log(`[${this.exchangeId}] Subscribed to order books for ${this.subscribedMarkets.length} markets`);
    }

    protected onMessage(data: WebSocket.RawData): void {
        try {
            const message = JSON.parse(data.toString());

            // Handle order_book updates
            if (message.type === 'update/order_book' && message.order_book) {
                this.processOrderBook(message);
            }
        } catch (error) {
            console.error(`[${this.exchangeId}] Parse error:`, error);
        }
    }

    private processOrderBook(message: any): void {
        const { channel, order_book } = message;

        // Extract market_id from channel "order_book:0"
        const match = channel.match(/order_book:(\d+)/);
        if (!match) return;

        const marketId = parseInt(match[1]);
        const symbol = this.marketSymbols[marketId];

        if (!symbol) return;

        const { asks, bids } = order_book;

        // Get best bid and best ask
        if (asks?.length > 0 && bids?.length > 0) {
            const bestAsk = parseFloat(asks[0].price);
            const bestBid = parseFloat(bids[0].price);

            if (bestBid > 0 && bestAsk > 0) {
                this.emitPrice({
                    exchange: this.exchangeId,
                    symbol: normalizeSymbol(symbol),
                    bid: bestBid,
                    ask: bestAsk,
                });
            }
        }
    }
}
