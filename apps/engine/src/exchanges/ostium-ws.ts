import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

export class OstiumWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'ostium';
    readonly wsUrl = 'wss://api.ostium.io/ws';

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.subscribeToFeeds();
    }

    private subscribeToFeeds(): void {
        // Ostium focuses on RWA/forex pairs but may have crypto
        this.send({
            action: 'subscribe',
            feeds: ['BTC-USD', 'ETH-USD', 'XAU-USD', 'EUR-USD'],
        });

        console.log(`[${this.exchangeId}] Subscribed to price feeds`);
    }

    protected onMessage(data: WebSocket.RawData): void {
        try {
            const message = JSON.parse(data.toString());

            if (message.type === 'price' && message.data) {
                const { feed, bid, ask } = message.data;
                const symbol = normalizeSymbol(feed);

                if (bid && ask) {
                    this.emitPrice({
                        exchange: this.exchangeId,
                        symbol,
                        bid: parseFloat(bid),
                        ask: parseFloat(ask),
                    });
                }
            }
        } catch (error) {
            console.error(`[${this.exchangeId}] Parse error:`, error);
        }
    }
}
