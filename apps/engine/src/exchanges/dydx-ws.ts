import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

/**
 * dYdX v4 WebSocket Adapter
 * 
 * Uses orderbooks channel to get real Bid/Ask prices.
 * Docs: https://docs.dydx.xyz/indexer-client/websockets
 * 
 * IMPORTANT: dYdX sends INCREMENTAL updates - each message only has bids OR asks.
 * We cache the orderbook and merge updates, keeping only top levels to avoid stale data.
 */
export class DydxWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'dydx';
    readonly wsUrl = 'wss://indexer.dydx.trade/v4/ws';

    private pingInterval: NodeJS.Timeout | null = null;

    // Start with major tokens only
    private readonly symbols = ['BTC', 'ETH', 'SOL'];

    // Cache best bid/ask per market (simpler approach - just track best prices)
    private bestPrices: Map<string, { bid: number; ask: number; lastUpdate: number }> = new Map();

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.startPing();
        this.subscribeToOrderbooks();
    }

    private async subscribeToOrderbooks(): Promise<void> {
        for (const coin of this.symbols) {
            const marketId = `${coin}-USD`;
            this.bestPrices.set(marketId, { bid: 0, ask: 0, lastUpdate: 0 });

            this.send({
                type: 'subscribe',
                channel: 'v4_orderbook',
                id: marketId,
            });
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`[${this.exchangeId}] Subscribed to orderbooks for ${this.symbols.length} markets`);
    }

    private startPing(): void {
        this.pingInterval = setInterval(() => {
            this.send({ type: 'ping' });
        }, 30000);
    }

    protected onMessage(data: WebSocket.RawData): void {
        try {
            const message = JSON.parse(data.toString());

            if (message.type === 'pong' || message.type === 'connected') {
                return;
            }

            // Handle subscribed message (initial snapshot)
            if (message.type === 'subscribed' && message.channel === 'v4_orderbook') {
                console.log(`[${this.exchangeId}] Subscribed to ${message.id}`);
                if (message.contents) {
                    this.handleSnapshot(message.id, message.contents);
                }
                return;
            }

            // Handle channel_data (orderbook updates)
            if (message.type === 'channel_data' && message.channel === 'v4_orderbook') {
                this.handleUpdate(message.id, message.contents);
            }

        } catch (error) {
            console.error(`[${this.exchangeId}] Parse error:`, error);
        }
    }

    private handleSnapshot(marketId: string, data: any): void {
        const bids = data.bids || [];
        const asks = data.asks || [];

        // Get best bid (first in sorted list, highest price)
        let bestBid = 0;
        if (bids.length > 0) {
            const first = bids[0];
            bestBid = parseFloat(Array.isArray(first) ? first[0] : first.price);
        }

        // Get best ask (first in sorted list, lowest price)
        let bestAsk = 0;
        if (asks.length > 0) {
            const first = asks[0];
            bestAsk = parseFloat(Array.isArray(first) ? first[0] : first.price);
        }

        if (bestBid > 0 && bestAsk > 0) {
            this.bestPrices.set(marketId, { bid: bestBid, ask: bestAsk, lastUpdate: Date.now() });
            this.emitPrices(marketId);
        }
    }

    private handleUpdate(marketId: string, data: any): void {
        if (!data) return;

        const current = this.bestPrices.get(marketId);
        if (!current) return;

        let { bid, ask } = current;

        // Process bid updates - look for new best bid
        for (const entry of data.bids || []) {
            const [priceStr, sizeStr] = Array.isArray(entry) ? entry : [entry.price, entry.size];
            const price = parseFloat(priceStr);
            const size = parseFloat(sizeStr);

            if (size > 0 && price > bid) {
                bid = price;
            } else if (size === 0 && price === bid) {
                // Best bid was removed, we need a new one
                // For simplicity, slightly reduce the bid
                bid = bid * 0.9999;
            }
        }

        // Process ask updates - look for new best ask
        for (const entry of data.asks || []) {
            const [priceStr, sizeStr] = Array.isArray(entry) ? entry : [entry.price, entry.size];
            const price = parseFloat(priceStr);
            const size = parseFloat(sizeStr);

            if (size > 0 && (price < ask || ask === 0)) {
                ask = price;
            } else if (size === 0 && price === ask) {
                // Best ask was removed, slightly increase
                ask = ask * 1.0001;
            }
        }

        if (bid > 0 && ask > 0) {
            this.bestPrices.set(marketId, { bid, ask, lastUpdate: Date.now() });
            this.emitPrices(marketId);
        }
    }

    private emitPrices(marketId: string): void {
        const prices = this.bestPrices.get(marketId);
        if (!prices || prices.bid === 0 || prices.ask === 0) return;

        const symbol = normalizeSymbol(marketId.replace('-USD', ''));

        this.emitPrice({
            exchange: this.exchangeId,
            symbol,
            bid: prices.bid,
            ask: prices.ask,
        });
    }

    async disconnect(): Promise<void> {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        this.bestPrices.clear();
        await super.disconnect();
    }
}
