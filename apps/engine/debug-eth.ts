
import 'dotenv/config'; // Loads .env from current dir
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    console.error('URL:', supabaseUrl);
    console.error('Key length:', supabaseKey?.length);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Querying Supabase for ETH-USD...');

    // Querying the last 100 records
    const { data: prices, error } = await supabase
        .from('prices')
        .select('*')
        .eq('symbol', 'ETH-USD')
        .order('timestamp', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Supabase Error:', error);
        return;
    }

    if (!prices || prices.length === 0) {
        console.log('No prices found for ETH-USD.');
        return;
    }

    // Group by snapshot timestamp
    // Since timestamp is the snapshot time, we can group by it directly
    const grouped = new Map<string, any[]>();

    prices.forEach(p => {
        if (!grouped.has(p.timestamp)) {
            grouped.set(p.timestamp, []);
        }
        grouped.get(p.timestamp).push(p);
    });

    // Get the latest 5 snapshots
    const snapshots = Array.from(grouped.entries()).slice(0, 5);

    console.log(`Found ${prices.length} records. Displaying last 5 snapshots:\n`);

    snapshots.forEach(([time, records], index) => {
        console.log(`--- SNAPSHOT ${index + 1}: ${time} ---`);
        const tableData = records.map(r => ({
            Exchange: r.exchange,
            ReceivedAt: r.received_at, // The exact time from the exchange
            LagMs: new Date(time).getTime() - new Date(r.received_at).getTime(),
            Bid: r.bid,
            Ask: r.ask
        }));
        console.table(tableData);
        console.log('\n');
    });
}

main();
