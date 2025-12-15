import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

/**
 * Paradex WebSocket Adapter
 * 
 * Docs: https://docs.paradex.trade/ws/general-information/introduction
 * 
 * URL: wss://ws.api.prod.paradex.trade/v1
 * 
 * Uses BBO (Best Bid Offer) channel to get real bid/ask prices.
 * 
 * Subscribe format (JSON-RPC):
 * { "jsonrpc": "2.0", "method": "subscribe", "params": { "channel": "bbo.{MARKET}" }, "id": 1 }
 */
export class ParadexWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'paradex';
    readonly wsUrl = 'wss://ws.api.prod.paradex.trade/v1';

    private messageId = 1;

    // Unified list of common tokens across all exchanges
    private readonly markets = [
        // Tier 1 - Major tokens (all exchanges)
        'BTC-USD-PERP', 'ETH-USD-PERP', 'SOL-USD-PERP', 'XRP-USD-PERP', 'BNB-USD-PERP',
        'DOGE-USD-PERP', 'AVAX-USD-PERP', 'SUI-USD-PERP', 'LINK-USD-PERP',
        // Tier 2 - Popular alts (most exchanges)
        'ARB-USD-PERP', 'OP-USD-PERP', 'APT-USD-PERP', 'NEAR-USD-PERP', 'DOT-USD-PERP',
        'TON-USD-PERP', 'TAO-USD-PERP', 'TIA-USD-PERP', 'AAVE-USD-PERP', 'UNI-USD-PERP',
        'ENA-USD-PERP', 'SEI-USD-PERP', 'WIF-USD-PERP', 'JUP-USD-PERP', 'HYPE-USD-PERP', 'BERA-USD-PERP',
        // Tier 3 - Trending tokens (multiple exchanges)
        'PEPE-USD-PERP', 'BONK-USD-PERP', 'WLD-USD-PERP', 'TRUMP-USD-PERP', 'FARTCOIN-USD-PERP',
        'PENGU-USD-PERP', 'ONDO-USD-PERP', 'PENDLE-USD-PERP', 'LDO-USD-PERP', 'ATOM-USD-PERP', 'ADA-USD-PERP',
    ];

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.subscribeToBBO();
    }

    private subscribeToBBO(): void {
        // Subscribe to BBO for each market
        for (const market of this.markets) {
            this.send({
                jsonrpc: '2.0',
                method: 'subscribe',
                params: {
                    channel: `bbo.${market}`,
                },
                id: this.messageId++,
            });
        }

        console.log(`[${this.exchangeId}] Subscribed to BBO for ${this.markets.length} markets`);
    }

    protected onMessage(data: WebSocket.RawData): void {
        try {
            const message = JSON.parse(data.toString());

            // Handle subscription confirmation
            if (message.result?.channel) {
                return;
            }

            // Handle BBO updates
            // Format: { "method": "subscription", "params": { "channel": "bbo.BTC-USD-PERP", "data": { "bid": "88500", "ask": "88510", ... } } }
            if (message.method === 'subscription' && message.params?.channel?.startsWith('bbo.') && message.params?.data) {
                const { bid, ask, bid_size, ask_size } = message.params.data;

                // Extract market from channel "bbo.BTC-USD-PERP"
                const market = message.params.channel.replace('bbo.', '');

                if (bid && ask) {
                    const bidPrice = parseFloat(bid);
                    const askPrice = parseFloat(ask);

                    if (bidPrice > 0 && askPrice > 0) {
                        // Normalize symbol: "BTC-USD-PERP" -> "BTC-USD"
                        const symbol = normalizeSymbol(market.replace('-PERP', ''));

                        this.emitPrice({
                            exchange: this.exchangeId,
                            symbol,
                            bid: bidPrice,
                            ask: askPrice,
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`[${this.exchangeId}] Parse error:`, error);
        }
    }
}
