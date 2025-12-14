import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

export class XyzWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'xyz';
    readonly wsUrl = 'wss://api.xyz.exchange/ws';

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.subscribeToMarkets();
    }

    private subscribeToMarkets(): void {
        this.send({
            type: 'subscribe',
            channel: 'book',
            markets: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
        });

        console.log(`[${this.exchangeId}] Subscribed to orderbooks`);
    }

    protected onMessage(data: WebSocket.RawData): void {
        try {
            const message = JSON.parse(data.toString());

            if (message.channel === 'book' && message.data) {
                const { market, bids, asks } = message.data;
                const symbol = normalizeSymbol(market);

                if (bids?.length > 0 && asks?.length > 0) {
                    this.emitPrice({
                        exchange: this.exchangeId,
                        symbol,
                        bid: parseFloat(bids[0].price),
                        ask: parseFloat(asks[0].price),
                    });
                }
            }
        } catch (error) {
            console.error(`[${this.exchangeId}] Parse error:`, error);
        }
    }
}
