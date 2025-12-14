import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

/**
 * Hyperliquid WebSocket Adapter
 * 
 * Uses the allMids subscription to get mid prices for all coins in a single connection.
 * Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions
 * 
 * Message format:
 * - Subscribe: { "method": "subscribe", "subscription": { "type": "allMids" } }
 * - Response: { "channel": "allMids", "data": { "mids": { "BTC": "43000.5", "ETH": "2300.1", ... } } }
 */
export class HyperliquidWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'hyperliquid';
    readonly wsUrl = 'wss://api.hyperliquid.xyz/ws';

    private pingInterval: NodeJS.Timeout | null = null;

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.subscribeToAllMids();
        this.startPing();
    }

    /**
     * Subscribe to allMids - gets mid prices for ALL coins in one subscription
     */
    private subscribeToAllMids(): void {
        this.send({
            method: 'subscribe',
            subscription: {
                type: 'allMids',
            },
        });

        console.log(`[${this.exchangeId}] Subscribed to allMids`);
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

            // Handle subscription confirmation
            if (message.channel === 'subscriptionResponse') {
                console.log(`[${this.exchangeId}] Subscription confirmed:`, message.data?.subscription?.type);
                return;
            }

            // Handle pong
            if (message.channel === 'pong') {
                return;
            }

            // Handle allMids updates - this is the main data feed
            if (message.channel === 'allMids' && message.data?.mids) {
                const mids = message.data.mids as Record<string, string>;

                for (const [coin, midPriceStr] of Object.entries(mids)) {
                    const midPrice = parseFloat(midPriceStr);

                    if (midPrice > 0) {
                        const symbol = normalizeSymbol(coin);

                        // Mid price is the average of bid and ask
                        // We use a tiny spread (0.01%) to create synthetic bid/ask from mid
                        const spreadFactor = 0.0001;
                        const halfSpread = midPrice * spreadFactor / 2;

                        this.emitPrice({
                            exchange: this.exchangeId,
                            symbol,
                            bid: midPrice - halfSpread,
                            ask: midPrice + halfSpread,
                        });
                    }
                }
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
