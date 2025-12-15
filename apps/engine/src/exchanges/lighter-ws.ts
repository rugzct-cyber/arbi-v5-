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

    // CORRECT market index to symbol mapping from Lighter API
    // Source: https://mainnet.zklighter.elliot.ai/api/v1/orderBooks
    private readonly marketSymbols: Record<number, string> = {
        0: 'ETH-USD',
        1: 'BTC-USD',
        2: 'SOL-USD',
        3: 'DOGE-USD',
        4: '1000PEPE-USD',
        5: 'WIF-USD',
        6: 'WLD-USD',
        7: 'XRP-USD',
        8: 'LINK-USD',
        9: 'AVAX-USD',
        10: 'NEAR-USD',
        11: 'DOT-USD',
        12: 'TON-USD',
        13: 'TAO-USD',
        14: 'POL-USD',
        15: 'TRUMP-USD',
        16: 'SUI-USD',
        17: '1000SHIB-USD',
        18: '1000BONK-USD',
        19: '1000FLOKI-USD',
        20: 'BERA-USD',
        21: 'FARTCOIN-USD',
        22: 'AI16Z-USD',
        23: 'POPCAT-USD',
        24: 'HYPE-USD',
        25: 'BNB-USD',
        26: 'JUP-USD',
        27: 'AAVE-USD',
        28: 'MKR-USD',
        29: 'ENA-USD',
        30: 'UNI-USD',
        31: 'APT-USD',
        32: 'SEI-USD',
        39: 'ADA-USD',
        42: 'SPX-USD',
        50: 'ARB-USD',
        55: 'OP-USD',
    };

    // Main markets to subscribe to (indices)
    private readonly subscribedMarkets = [0, 1, 2, 3, 7, 8, 9, 10, 16, 25, 30, 31, 39, 50, 55];

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
