
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import dotenv from 'dotenv';

// Load env from apps/engine/.env
dotenv.config({ path: path.resolve(process.cwd(), 'apps/engine/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Querying Supabase for ETH-USD...');

    const { data: prices, error } = await supabase
        .from('prices')
        .select('*')
        .eq('symbol', 'ETH-USD') // Try ETH-USD first
        .order('timestamp', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Error querying data:', error);
        return;
    }

    if (!prices || prices.length === 0) {
        console.log('No ETH-USD prices found. Trying ETH...');
        // Fallback or just report empty
    }

    // Group by snapshot timestamp
    const snapshots = new Map<string, any[]>();
    prices.forEach(p => {
        if (!snapshots.has(p.timestamp)) {
            snapshots.set(p.timestamp, []);
        }
        snapshots.get(p.timestamp).push(p);
    });

    // Get last 5 snapshots
    const lastSnapshots = Array.from(snapshots.entries())
        .slice(0, 5);

    console.log('\n--- Last 5 Snapshots for ETH ---');

    lastSnapshots.forEach(([timestamp, records]) => {
        console.log(`\nSnapshot Time: ${timestamp}`);
        console.table(records.map(r => ({
            Exchange: r.exchange,
            ReceivedAt: r.received_at,
            GlobalTime: timestamp,
            Bid: r.bid,
            Ask: r.ask
        })));
    });
}

main();
