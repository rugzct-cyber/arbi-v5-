import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

export class EdgeXWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'edgex';
    readonly wsUrl = 'wss://api.edgex.exchange/ws';

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.subscribeToTickers();
    }

    private subscribeToTickers(): void {
        this.send({
            op: 'subscribe',
            channel: 'ticker',
            instIds: ['BTC-USD-PERP', 'ETH-USD-PERP', 'SOL-USD-PERP'],
        });

        console.log(`[${this.exchangeId}] Subscribed to tickers`);
    }

    protected onMessage(data: WebSocket.RawData): void {
        try {
            const message = JSON.parse(data.toString());

            if (message.channel === 'ticker' && message.data) {
                const { instId, bidPx, askPx } = message.data;
                const symbol = normalizeSymbol(instId.replace('-USD-PERP', ''));

                if (bidPx && askPx) {
                    this.emitPrice({
                        exchange: this.exchangeId,
                        symbol,
                        bid: parseFloat(bidPx),
                        ask: parseFloat(askPx),
                    });
                }
            }
        } catch (error) {
            console.error(`[${this.exchangeId}] Parse error:`, error);
        }
    }
}
