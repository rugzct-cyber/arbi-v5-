// Simple test for all DEXes
import WebSocket from 'ws';

async function test() {
    const results: string[] = [];
    results.push(`Time: ${new Date().toISOString()}\n`);

    // Paradex REST
    try {
        const res = await fetch('https://api.prod.paradex.trade/v1/bbo/ETH-USD-PERP');
        const data = await res.json();
        results.push(`PARADEX REST: Bid $${data.bid} | Ask $${data.ask}`);
    } catch (e) { results.push('PARADEX REST: FAILED'); }

    // Pacifica REST
    try {
        const res = await fetch('https://api.pacifica.fi/api/v1/book?symbol=ETH');
        const data = await res.json();
        results.push(`PACIFICA REST: Bid $${data.data.l[0][0].p} | Ask $${data.data.l[1][0].p}`);
    } catch (e) { results.push('PACIFICA REST: FAILED'); }

    // Hyperliquid REST
    try {
        const res = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'l2Book', coin: 'ETH' })
        });
        const data = await res.json();
        results.push(`HYPERLIQUID REST: Bid $${data.levels[0][0].px} | Ask $${data.levels[1][0].px}`);
    } catch (e) { results.push('HYPERLIQUID REST: FAILED'); }

    // Lighter REST
    try {
        const res = await fetch('https://mainnet.zklighter.elliot.ai/api/v1/orderbook?market_id=2');
        const data = await res.json();
        const bid = parseFloat(data.bids[0].price) / 1e8;
        const ask = parseFloat(data.asks[0].price) / 1e8;
        results.push(`LIGHTER REST: Bid $${bid.toFixed(2)} | Ask $${ask.toFixed(2)}`);
    } catch (e) { results.push('LIGHTER REST: FAILED'); }

    // Vest REST
    try {
        const res = await fetch('https://prod.vertexprotocol-backend.com/v2/orderbook?market=4&depth=1');
        const data = await res.json();
        results.push(`VEST REST: Bid $${data.bids[0][0]} | Ask $${data.asks[0][0]}`);
    } catch (e) { results.push('VEST REST: FAILED'); }

    // Extended REST
    try {
        const res = await fetch('https://api-v1.extended.exchange/depth?symbol=ETH-USDC&limit=1');
        const data = await res.json();
        results.push(`EXTENDED REST: Bid $${data.bids[0][0]} | Ask $${data.asks[0][0]}`);
    } catch (e) { results.push('EXTENDED REST: FAILED'); }

    // Ethereal REST
    try {
        const res = await fetch('https://api.ethereal.trade/v1/book?symbol=1');
        const data = await res.json();
        results.push(`ETHEREAL REST: Bid $${data.bids[0].price} | Ask $${data.asks[0].price}`);
    } catch (e) { results.push('ETHEREAL REST: FAILED'); }

    // Nado REST
    try {
        const res = await fetch('https://orderbook-mainnet.nado.xyz/market/ETH_USD/orderbook?depth=1');
        const data = await res.json();
        results.push(`NADO REST: Bid $${data.bids[0].price} | Ask $${data.asks[0].price}`);
    } catch (e) { results.push('NADO REST: FAILED'); }

    // Print all results
    console.log('\n========== DEX REST API RESULTS ==========\n');
    results.forEach(r => console.log(r));
    console.log('\n==========================================');
}

test();
