// Test script to compare REST and WebSocket data from Pacifica
import WebSocket from 'ws';

const REST_URL = 'https://api.pacifica.fi/api/v1/book?symbol=ETH';
const WS_URL = 'wss://ws.pacifica.fi/ws';

async function testBothSources() {
    console.log('🧪 Testing Pacifica REST vs WebSocket for ETH...\n');
    console.log(`Time: ${new Date().toISOString()}\n`);

    // 1. Fetch REST data
    console.log('📡 Fetching REST API...');
    const restResponse = await fetch(REST_URL);
    const restData = await restResponse.json();

    if (restData.success && restData.data?.l) {
        const bids = restData.data.l[0];
        const asks = restData.data.l[1];
        const restBid = parseFloat(bids[0].p);
        const restAsk = parseFloat(asks[0].p);
        console.log(`✅ REST Results:`);
        console.log(`   Best Bid: $${restBid}`);
        console.log(`   Best Ask: $${restAsk}`);
        console.log(`   Spread: ${((restAsk - restBid) / restBid * 100).toFixed(4)}%\n`);
    }

    // 2. Connect to WebSocket and get BBO
    console.log('🔌 Connecting to WebSocket...');

    return new Promise<void>((resolve) => {
        const ws = new WebSocket(WS_URL);

        ws.on('open', () => {
            console.log('   Connected! Subscribing to ETH BBO...');
            ws.send(JSON.stringify({
                method: 'subscribe',
                params: {
                    source: 'bbo',
                    symbol: 'ETH'
                }
            }));
        });

        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());

            if (message.channel === 'bbo' && message.data?.s === 'ETH') {
                const wsBid = parseFloat(message.data.b);
                const wsAsk = parseFloat(message.data.a);
                console.log(`✅ WebSocket BBO Results:`);
                console.log(`   Best Bid: $${wsBid}`);
                console.log(`   Best Ask: $${wsAsk}`);
                console.log(`   Spread: ${((wsAsk - wsBid) / wsBid * 100).toFixed(4)}%\n`);
                console.log(`   Timestamp: ${new Date(message.data.t).toISOString()}`);

                ws.close();
                resolve();
            }
        });

        ws.on('error', (err) => {
            console.error('WebSocket error:', err);
            resolve();
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            console.log('⚠️ WebSocket timeout - no BBO received');
            ws.close();
            resolve();
        }, 10000);
    });
}

testBothSources().then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
});
