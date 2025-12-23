/**
 * Script to check the date range of data in Supabase
 * Run with: npx tsx check-data-range.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_KEY || ''
);

async function main() {
    console.log('📊 Checking data range in Supabase...\n');

    // Get the earliest record
    const { data: earliest, error: earliestErr } = await supabase
        .from('prices')
        .select('timestamp')
        .order('timestamp', { ascending: true })
        .limit(1);

    if (earliestErr) {
        console.error('Error:', earliestErr);
        return;
    }

    // Get the latest record
    const { data: latest, error: latestErr } = await supabase
        .from('prices')
        .select('timestamp')
        .order('timestamp', { ascending: false })
        .limit(1);

    if (latestErr) {
        console.error('Error:', latestErr);
        return;
    }

    console.log('📅 Data Range:');
    console.log(`   Earliest: ${earliest?.[0]?.timestamp || 'No data'}`);
    console.log(`   Latest:   ${latest?.[0]?.timestamp || 'No data'}`);

    // Count records per day for the last 10 days
    console.log('\n📈 Records per day (last 10 days):\n');

    const now = new Date();
    for (let i = 0; i < 10; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date.setHours(0, 0, 0, 0)).toISOString();
        const dayEnd = new Date(date.setHours(23, 59, 59, 999)).toISOString();

        const { count, error } = await supabase
            .from('prices')
            .select('*', { count: 'exact', head: true })
            .gte('timestamp', dayStart)
            .lt('timestamp', dayEnd);

        const dateStr = date.toISOString().split('T')[0];
        console.log(`   ${dateStr}: ${count || 0} records`);
    }

    // Total count
    const { count: total } = await supabase
        .from('prices')
        .select('*', { count: 'exact', head: true });

    console.log(`\n📦 Total records in database: ${total}`);
}

main().catch(console.error);
