// Test script to compare REST and WebSocket data from ALL DEXes for ETH
import WebSocket from 'ws';

interface TestResult {
    exchange: string;
    restBid: number | null;
    restAsk: number | null;
    wsBid: number | null;
    wsAsk: number | null;
    diff: string;
}

const results: TestResult[] = [];

// ============== REST API Tests ==============

async function testParadexREST(): Promise<{ bid: number; ask: number } | null> {
    try {
        const res = await fetch('https://api.prod.paradex.trade/v1/bbo/ETH-USD-PERP');
        const data = await res.json();
        return { bid: parseFloat(data.bid), ask: parseFloat(data.ask) };
    } catch (e) { return null; }
}

async function testVestREST(): Promise<{ bid: number; ask: number } | null> {
    try {
        const res = await fetch('https://prod.vertexprotocol-backend.com/v2/orderbook?market=4&depth=1');
        const data = await res.json();
        if (data.bids?.[0] && data.asks?.[0]) {
            return { bid: parseFloat(data.bids[0][0]), ask: parseFloat(data.asks[0][0]) };
        }
        return null;
    } catch (e) { return null; }
}

async function testHyperliquidREST(): Promise<{ bid: number; ask: number } | null> {
    try {
        const res = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'l2Book', coin: 'ETH' })
        });
        const data = await res.json();
        if (data.levels?.[0]?.[0] && data.levels?.[1]?.[0]) {
            return { bid: parseFloat(data.levels[0][0].px), ask: parseFloat(data.levels[1][0].px) };
        }
        return null;
    } catch (e) { return null; }
}

async function testPacificaREST(): Promise<{ bid: number; ask: number } | null> {
    try {
        const res = await fetch('https://api.pacifica.fi/api/v1/book?symbol=ETH');
        const data = await res.json();
        if (data.success && data.data?.l?.[0]?.[0] && data.data?.l?.[1]?.[0]) {
            return { bid: parseFloat(data.data.l[0][0].p), ask: parseFloat(data.data.l[1][0].p) };
        }
        return null;
    } catch (e) { return null; }
}

async function testLighterREST(): Promise<{ bid: number; ask: number } | null> {
    try {
        const res = await fetch('https://mainnet.zklighter.elliot.ai/api/v1/orderbook?market_id=2');
        const data = await res.json();
        if (data.bids?.[0] && data.asks?.[0]) {
            return {
                bid: parseFloat(data.bids[0].price) / 1e8,
                ask: parseFloat(data.asks[0].price) / 1e8
            };
        }
        return null;
    } catch (e) { return null; }
}

async function testExtendedREST(): Promise<{ bid: number; ask: number } | null> {
    try {
        const res = await fetch('https://api-v1.extended.exchange/depth?symbol=ETH-USDC&limit=1');
        const data = await res.json();
        if (data.bids?.[0] && data.asks?.[0]) {
            return { bid: parseFloat(data.bids[0][0]), ask: parseFloat(data.asks[0][0]) };
        }
        return null;
    } catch (e) { return null; }
}

async function testEtherealREST(): Promise<{ bid: number; ask: number } | null> {
    try {
        const res = await fetch('https://api.ethereal.trade/v1/book?symbol=1');
        const data = await res.json();
        if (data.bids?.[0] && data.asks?.[0]) {
            return { bid: parseFloat(data.bids[0].price), ask: parseFloat(data.asks[0].price) };
        }
        return null;
    } catch (e) { return null; }
}

async function testNadoREST(): Promise<{ bid: number; ask: number } | null> {
    try {
        const res = await fetch('https://orderbook-mainnet.nado.xyz/market/ETH_USD/orderbook?depth=1');
        const data = await res.json();
        if (data.bids?.[0] && data.asks?.[0]) {
            return { bid: parseFloat(data.bids[0].price), ask: parseFloat(data.asks[0].price) };
        }
        return null;
    } catch (e) { return null; }
}

// ============== WebSocket Tests ==============

function testWebSocket(
    name: string,
    url: string,
    onOpen: (ws: WebSocket) => void,
    parser: (msg: any) => { bid: number; ask: number } | null
): Promise<{ bid: number; ask: number } | null> {
    return new Promise((resolve) => {
        try {
            const ws = new WebSocket(url);
            const timeout = setTimeout(() => {
                ws.close();
                resolve(null);
            }, 8000);

            ws.on('open', () => onOpen(ws));
            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    const result = parser(msg);
                    if (result) {
                        clearTimeout(timeout);
                        ws.close();
                        resolve(result);
                    }
                } catch (e) { }
            });
            ws.on('error', () => {
                clearTimeout(timeout);
                resolve(null);
            });
        } catch (e) {
            resolve(null);
        }
    });
}

async function testParadexWS(): Promise<{ bid: number; ask: number } | null> {
    return testWebSocket(
        'paradex',
        'wss://ws.prod.paradex.trade/v1',
        (ws) => {
            ws.send(JSON.stringify({
                jsonrpc: '2.0',
                method: 'subscribe',
                params: { channel: 'bbo.ETH-USD-PERP' },
                id: 1
            }));
        },
        (msg) => {
            if (msg.params?.channel === 'bbo.ETH-USD-PERP' && msg.params?.data) {
                return { bid: parseFloat(msg.params.data.bid), ask: parseFloat(msg.params.data.ask) };
            }
            return null;
        }
    );
}

async function testPacificaWS(): Promise<{ bid: number; ask: number } | null> {
    return testWebSocket(
        'pacifica',
        'wss://ws.pacifica.fi/ws',
        (ws) => {
            ws.send(JSON.stringify({ method: 'subscribe', params: { source: 'bbo', symbol: 'ETH' } }));
        },
        (msg) => {
            if (msg.channel === 'bbo' && msg.data?.s === 'ETH') {
                return { bid: parseFloat(msg.data.b), ask: parseFloat(msg.data.a) };
            }
            return null;
        }
    );
}

async function testHyperliquidWS(): Promise<{ bid: number; ask: number } | null> {
    return testWebSocket(
        'hyperliquid',
        'wss://api.hyperliquid.xyz/ws',
        (ws) => {
            ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'l2Book', coin: 'ETH' } }));
        },
        (msg) => {
            if (msg.channel === 'l2Book' && msg.data?.coin === 'ETH') {
                const levels = msg.data.levels;
                if (levels?.[0]?.[0] && levels?.[1]?.[0]) {
                    return { bid: parseFloat(levels[0][0].px), ask: parseFloat(levels[1][0].px) };
                }
            }
            return null;
        }
    );
}

// ============== Main Test ==============

async function runAllTests() {
    console.log('🧪 Testing ALL DEXes - REST vs WebSocket for ETH...\n');
    console.log(`Time: ${new Date().toISOString()}\n`);
    console.log('='.repeat(80));

    const exchanges = [
        { name: 'Paradex', rest: testParadexREST, ws: testParadexWS },
        { name: 'Pacifica', rest: testPacificaREST, ws: testPacificaWS },
        { name: 'Hyperliquid', rest: testHyperliquidREST, ws: testHyperliquidWS },
        { name: 'Lighter', rest: testLighterREST, ws: null },
        { name: 'Vest', rest: testVestREST, ws: null },
        { name: 'Extended', rest: testExtendedREST, ws: null },
        { name: 'Ethereal', rest: testEtherealREST, ws: null },
        { name: 'Nado', rest: testNadoREST, ws: null },
    ];

    for (const ex of exchanges) {
        console.log(`\n📊 ${ex.name.toUpperCase()}`);
        console.log('-'.repeat(40));

        const restResult = await ex.rest();
        const wsResult = ex.ws ? await ex.ws() : null;

        if (restResult) {
            console.log(`   REST  → Bid: $${restResult.bid.toFixed(2)} | Ask: $${restResult.ask.toFixed(2)}`);
        } else {
            console.log(`   REST  → ❌ Failed`);
        }

        if (ex.ws) {
            if (wsResult) {
                console.log(`   WS    → Bid: $${wsResult.bid.toFixed(2)} | Ask: $${wsResult.ask.toFixed(2)}`);
                if (restResult) {
                    const diff = Math.abs(restResult.bid - wsResult.bid);
                    console.log(`   DIFF  → $${diff.toFixed(2)} (${(diff / restResult.bid * 100).toFixed(4)}%)`);
                }
            } else {
                console.log(`   WS    → ❌ Failed or timeout`);
            }
        } else {
            console.log(`   WS    → (not tested)`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ All tests complete!');
}

runAllTests().then(() => process.exit(0)).catch(console.error);
