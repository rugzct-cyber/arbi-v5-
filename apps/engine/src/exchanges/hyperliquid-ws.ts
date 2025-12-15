import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

// Type definitions for Hyperliquid L2 Data
interface WsLevel {
    px: string; // Price
    sz: string; // Size
    n: number;  // Number of orders
}

interface WsBook {
    coin: string;
    levels: [WsLevel[], WsLevel[]]; // [Bids, Asks]
    time: number;
}

/**
 * Hyperliquid WebSocket Adapter
 * 
 * Uses l2Book channel to get real Bid/Ask prices.
 * Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions
 * 
 * L2 Format:
 * levels[0] = Bids (High to Low)
 * levels[1] = Asks (Low to High)
 */
export class HyperliquidWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'hyperliquid';
    readonly wsUrl = 'wss://api.hyperliquid.xyz/ws';

    private pingInterval: NodeJS.Timeout | null = null;

    // Target symbols for L2 subscription
    private readonly symbols = [
        'BTC',
        'ETH',
        'SOL',
        'ARB',
        'AVAX',
        'DOGE',
        'LINK',
        'OP',
        'MATIC',
        'SUI',
        'XYZ', // Special request
    ];

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.subscribeToL2Books();
        this.startPing();
    }

    /**
     * Subscribe to L2 Book for specific coins with delay to avoid rate limits
     */
    private async subscribeToL2Books(): Promise<void> {
        for (const coin of this.symbols) {
            this.send({
                method: 'subscribe',
                subscription: {
                    type: 'l2Book',
                    coin: coin,
                },
            });
            // Small delay to avoid burst rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`[${this.exchangeId}] Subscribed to L2 OrderBook for ${this.symbols.length} coins`);
    }

    /**
     * Keep connection alive with periodic pings
     */
    private startPing(): void {
        this.pingInterval = setInterval(() => {
            this.send({ method: 'ping' });
        }, 30000); // Ping every 30 seconds
    }

    protected onMessage(data: WebSocket.RawData): void {
        try {
            const message = JSON.parse(data.toString());

            // Handle channel data
            if (message.channel === 'l2Book' && message.data) {
                const bookData = message.data as WsBook;
                const coin = bookData.coin;

                // levels[0] is bids, levels[1] is asks
                const bids = bookData.levels[0];
                const asks = bookData.levels[1];

                if (bids && bids.length > 0 && asks && asks.length > 0) {
                    const bestBid = parseFloat(bids[0].px);
                    const bestAsk = parseFloat(asks[0].px);

                    if (bestBid > 0 && bestAsk > 0) {
                        const symbol = normalizeSymbol(coin);

                        this.emitPrice({
                            exchange: this.exchangeId,
                            symbol,
                            bid: bestBid,
                            ask: bestAsk,
                        });
                    }
                }
            }

            // Handle pong
            if (message.channel === 'pong') {
                return;
            }

            // Handle subscription confirmation
            if (message.channel === 'subscriptionResponse') {
                // console.log(`[${this.exchangeId}] Subscribed to ${message.data?.subscription?.coin}`);
                return;
            }

        } catch (error) {
            console.error(`[${this.exchangeId}] Parse error:`, error);
        }
    }

    async disconnect(): Promise<void> {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        await super.disconnect();
    }
}
