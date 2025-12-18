/**
 * Test script to verify all 8 REST API endpoints
 * Run with: npx tsx test-rest-apis.ts
 */

async function testHyperliquid() {
    console.log('\n📊 Testing HYPERLIQUID...');
    try {
        const res = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'l2Book', coin: 'BTC' }),
        });
        const data = await res.json();
        const bid = parseFloat(data.levels[0][0].px);
        const ask = parseFloat(data.levels[1][0].px);
        console.log(`✅ Hyperliquid BTC: Bid ${bid} / Ask ${ask}`);
    } catch (e: any) {
        console.log(`❌ Hyperliquid: ${e.message}`);
    }
}

async function testParadex() {
    console.log('\n📊 Testing PARADEX...');
    try {
        const res = await fetch('https://api.prod.paradex.trade/v1/orderbook/BTC-USD-PERP?depth=1');
        const data = await res.json();
        console.log(`✅ Paradex BTC: Bid ${data.bids?.[0]?.[0]} / Ask ${data.asks?.[0]?.[0]}`);
    } catch (e: any) {
        console.log(`❌ Paradex: ${e.message}`);
    }
}

async function testLighter() {
    console.log('\n📊 Testing LIGHTER...');
    try {
        const res = await fetch('https://mainnet.zklighter.elliot.ai/api/v1/orderBookOrders?market_id=1&limit=5');
        const data = await res.json();
        console.log(`✅ Lighter BTC: Bid ${data.bids?.[0]?.price} / Ask ${data.asks?.[0]?.price}`);
    } catch (e: any) {
        console.log(`❌ Lighter: ${e.message}`);
    }
}

async function testPacifica() {
    console.log('\n📊 Testing PACIFICA...');
    try {
        const res = await fetch('https://api.pacifica.fi/api/v1/book?symbol=BTC');
        const data = await res.json();
        console.log(`✅ Pacifica BTC: Bid ${data.data?.l?.[0]?.[0]?.p} / Ask ${data.data?.l?.[1]?.[0]?.p}`);
    } catch (e: any) {
        console.log(`❌ Pacifica: ${e.message}`);
    }
}

async function testVest() {
    console.log('\n📊 Testing VEST...');
    try {
        const res = await fetch('https://server-prod.hz.vestmarkets.com/v2/depth?symbol=BTC-PERP&limit=5', {
            headers: { 'xrestservermm': 'restserver0' },
        });
        const data = await res.json();
        console.log(`✅ Vest BTC: Bid ${data.bids?.[0]?.[0]} / Ask ${data.asks?.[0]?.[0]}`);
    } catch (e: any) {
        console.log(`❌ Vest: ${e.message}`);
    }
}

async function testExtended() {
    console.log('\n📊 Testing EXTENDED...');
    try {
        const res = await fetch('https://api.starknet.extended.exchange/api/v1/info/markets');
        const data = await res.json();
        const btc = data.data?.find((m: any) => m.assetName === 'BTC');
        console.log(`✅ Extended BTC: Bid ${btc?.marketStats?.bidPrice} / Ask ${btc?.marketStats?.askPrice}`);
    } catch (e: any) {
        console.log(`❌ Extended: ${e.message}`);
    }
}

async function testNado() {
    console.log('\n📊 Testing NADO...');
    try {
        const res = await fetch('https://gateway.prod.nado.xyz/v2/orderbook?ticker_id=BTC-PERP_USDT0&depth=5');
        const data = await res.json();
        console.log(`✅ Nado BTC: Bid ${data.bids?.[0]?.[0]} / Ask ${data.asks?.[0]?.[0]}`);
    } catch (e: any) {
        console.log(`❌ Nado: ${e.message}`);
    }
}

async function testEthereal() {
    console.log('\n📊 Testing ETHEREAL...');
    try {
        // First get products
        const prodRes = await fetch('https://api.ethereal.trade/v1/product');
        const prodData = await prodRes.json();
        const btc = prodData.data?.find((p: any) => p.baseTokenName === 'BTC');

        if (btc) {
            const res = await fetch(`https://api.ethereal.trade/v1/product/market-price?productIds=${btc.id}`);
            const data = await res.json();
            const market = data.data?.[0];
            console.log(`✅ Ethereal BTC: Bid ${market?.bestBidPrice} / Ask ${market?.bestAskPrice}`);
        } else {
            console.log('⚠️ Ethereal: No BTC product');
        }
    } catch (e: any) {
        console.log(`❌ Ethereal: ${e.message}`);
    }
}

async function main() {
    console.log('🚀 Testing all 8 REST APIs...\n');
    console.log('================================');

    await testHyperliquid();
    await testParadex();
    await testLighter();
    await testPacifica();
    await testVest();
    await testExtended();
    await testNado();
    await testEthereal();

    console.log('\n================================');
    console.log('✅ Test complete!');
}

main();
