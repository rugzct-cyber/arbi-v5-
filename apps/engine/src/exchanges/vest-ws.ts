import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

/**
 * Vest Exchange WebSocket Adapter
 * 
 * Docs: https://docs.vestmarkets.com/vest-api#public-ws-endpoints
 * 
 * URL: wss://ws-prod.hz.vestmarkets.com/ws-api?version=1.0
 * 
 * Subscribe format:
 * { "method": "SUBSCRIBE", "params": ["BTC-PERP@depth", ...], "id": 1 }
 * 
 * Response format (Depth):
 * { "channel": "BTC-PERP@depth", "data": { "bids": [["price", "qty"], ...], "asks": [["price", "qty"], ...] } }
 */
export class VestWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'vest';
    readonly wsUrl = 'wss://ws-prod.hz.vestmarkets.com/ws-api?version=1.0';

    // Vest symbols filtered to only those present on other exchanges
    // Common with: Hyperliquid, Paradex, Pacifica, Lighter
    // Crypto - Tier 1 & 2
    'BTC-PERP', 'ETH-PERP', 'SOL-PERP', 'XRP-PERP', 'BNB-PERP', 'DOGE-PERP', 'AVAX-PERP', 'SUI-PERP',
    'LINK-PERP', 'LTC-PERP', 'ARB-PERP', 'OP-PERP', 'APT-PERP', 'NEAR-PERP', 'DOT-PERP', 'TON-PERP',
    'TAO-PERP', 'TIA-PERP', 'AAVE-PERP', 'UNI-PERP', 'ENA-PERP', 'SEI-PERP', 'WIF-PERP', 'JUP-PERP',
    'HYPE-PERP', 'BERA-PERP', 'RENDER-PERP', 'INJ-PERP', 'RUNE-PERP', 'LD-PERP', 'MKR-PERP', 'FIL-PERP',
    'ATOM-PERP', 'ADA-PERP', 'TRX-PERP', 'MATIC-PERP', 'SHIB-PERP', 'BCH-PERP', 'ICP-PERP', 'ETC-PERP',

    // Crypto - Trending & Memes
    'PEPE-PERP', 'BONK-PERP', 'WLD-PERP', 'TRUMP-PERP', 'FARTCOIN-PERP', 'PENGU-PERP', 'ONDO-PERP',
    'PENDLE-PERP', 'LDO-PERP', 'AERO-PERP', 'APEX-PERP', 'ASTER-PERP', 'AVNT-PERP', 'CAKE-PERP',
    'CRV-PERP', 'EIGEN-PERP', 'GOAT-PERP', 'GRASS-PERP', 'IP-PERP', 'KAITO-PERP', 'LINEA-PERP',
    'MNT-PERP', 'MON-PERP', 'MOODENG-PERP', 'POPCAT-PERP', 'PUMP-PERP', 'RESOLV-PERP', 'S-PERP',
    'SNX-PERP', 'STRK-PERP', 'VIRTUAL-PERP', 'WLFI-PERP', 'XPL-PERP', 'ZEC-PERP', 'ZORA-PERP',
    'ZRO-PERP', '4-PERP', '0G-PERP', 'AIXBT-PERP', 'GMX-PERP', 'DYDX-PERP', 'HBAR-PERP', 'INIT-PERP',
    'JTO-PERP', 'OM-PERP', 'ORDI-PERP', 'PAXG-PERP', 'POL-PERP', 'PYTH-PERP', 'XLM-PERP', 'XMR-PERP',
    'ZK-PERP', 'kBONK-PERP', 'kFLOKI-PERP', 'kPEPE-PERP', 'kSHIB-PERP', 'MELANIA-PERP', 'MORPHO-PERP',
    'USUAL-PERP', 'VVV-PERP', 'WCT-PERP', '2Z-PERP', 'SPX-PERP', '1000PEPE-PERP', '1000BONK-PERP',
    '1000FLOKI-PERP', '1000SHIB-PERP', 'CLANKER-PERP', 'QNT-PERP', 'BAT-PERP', 'DASH-PERP', 'FLOW-PERP',
    'WOO-PERP', 'YB-PERP', 'MYX-PERP', 'SKY-PERP', 'CRO-PERP', 'NMR-PERP', '1000TOSHI-PERP', 'STABLE-PERP',
    'CC-PERP', 'MET-PERP', 'USELESS-PERP', 'DOLO-PERP', 'SYRUP-PERP', 'EDEN-PERP', 'FF-PERP', 'MEGA-PERP',
    'PROVE-PERP', 'ETHFI-PERP', 'AI16Z-PERP',

    // Stocks (Tokenized) - From Lighter/Vest overlap
    'AAPL-PERP', 'TSLA-PERP', 'NVDA-PERP', 'MSFT-PERP', 'GOOGL-PERP', 'AMZN-PERP', 'META-PERP',
    'PLTR-PERP', 'HOOD-PERP', 'COIN-PERP', 'AMD-PERP', 'NFLX-PERP', 'GME-PERP', 'AMC-PERP', 'MSTR-PERP',

    // Forex & Commodities
    'EURUSD-PERP', 'GBPUSD-PERP', 'USDJPY-PERP', 'USDCHF-PERP', 'USDCAD-PERP', 'AUDUSD-PERP',
    'NZDUSD-PERP', 'USDKRW-PERP', 'XAU-PERP', 'XAG-PERP',

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.subscribeToDepth();
    }

    // Override connect to add headers
    async connect(): Promise<void> {
        if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
            return;
        }

        this.isConnecting = true;

        return new Promise((resolve, reject) => {
            try {
                // Add headers to mimic browser/legitimate client
                this.ws = new WebSocket(this.wsUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Origin': 'https://vestmarkets.com',
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache',
                    }
                });

                this.ws.on('open', () => {
                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    this.onOpen();
                    this.config.onConnected();
                    resolve();
                });

                this.ws.on('message', (data) => {
                    try {
                        this.onMessage(data);
                    } catch (error) {
                        console.error(`[${this.exchangeId}] Message parse error:`, error);
                    }
                });

                this.ws.on('error', (error) => {
                    if (error.message.includes('530') || error.message.includes('403')) {
                        console.error(`[${this.exchangeId}] Connection rejected (${error.message}). Site might be frozen or blocking.`);
                    }
                    this.isConnecting = false;
                    this.config.onError(error);
                    reject(error);
                });

                this.ws.on('close', () => {
                    this.isConnecting = false;
                    this.config.onDisconnected();
                    this.scheduleReconnect();
                });

            } catch (error) {
                this.isConnecting = false;
                reject(error);
            }
        });
    }

    private subscribeToDepth(): void {
        // Channel name: {symbol}@depth
        const channels = this.symbols.map(s => `${s}@depth`);

        this.send({
            method: 'SUBSCRIBE',
            params: channels,
            id: Math.floor(Date.now() / 1000)
        });

        console.log(`[${this.exchangeId}] Subscribed to ${channels.length} depth channels`);
    }

    protected onMessage(data: WebSocket.RawData): void {
        try {
            // Debug log for raw message to verify subscription success
            // console.log(`[${this.exchangeId}] Raw:`, data.toString().substring(0, 300));

            const message = JSON.parse(data.toString());

            if (message.channel && message.channel.endsWith('@depth') && message.data) {
                const channel = message.channel;
                const market = channel.split('@')[0];
                const symbol = normalizeSymbol(market.replace('-PERP', ''));

                const { bids, asks } = message.data;

                if (bids && bids.length > 0 && asks && asks.length > 0) {
                    const bestBid = parseFloat(bids[0][0]);
                    const bestAsk = parseFloat(asks[0][0]);

                    if (bestBid > 0 && bestAsk > 0) {
                        // console.log(`[${this.exchangeId}] Price: ${symbol} ${bestBid} ${bestAsk}`);
                        this.emitPrice({
                            exchange: this.exchangeId,
                            symbol,
                            bid: bestBid,
                            ask: bestAsk,
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`[${this.exchangeId}] Parse error:`, error);
        }
    }
}
