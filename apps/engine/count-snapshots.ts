
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_KEY || ''
);

async function main() {
    console.log('📊 Checking snapshot counts around 16:29 UTC (17:29 Local)...\n');

    // Check a window from 16:00 UTC to 17:30 UTC (covering the transition)
    const { data, error } = await supabase
        .from('prices')
        .select('timestamp', { count: 'exact' })
        .gte('timestamp', '2025-12-18T16:00:00Z')
        .lt('timestamp', '2025-12-18T17:30:00Z')
        .order('timestamp', { ascending: true });

    if (error) {
        console.error('Error:', error);
        return;
    }

    // Group by timestamp (snapshot)
    const snapshots = new Map<string, number>();
    data.forEach(row => {
        // Round to minute to group slight variations if any, though they should be identical
        const time = row.timestamp.substring(11, 16); // HH:MM
        snapshots.set(time, (snapshots.get(time) || 0) + 1);
    });

    console.log('UTC Time | Record Count');
    console.log('---------|-------------');
    for (const [time, count] of snapshots) {
        console.log(`${time}    | ${count}`);
    }

    // Also check the most recent ones (around 19:15 UTC / 20:15 Local)
    console.log('\n📊 Recent snapshots (UTC)...');
    const { data: recent, error: recentError } = await supabase
        .from('prices')
        .select('timestamp')
        .gte('timestamp', '2025-12-18T19:00:00Z')
        .order('timestamp', { ascending: true });

    if (!recentError) {
        const recentSnaps = new Map<string, number>();
        recent.forEach(row => {
            const time = row.timestamp.substring(11, 16);
            recentSnaps.set(time, (recentSnaps.get(time) || 0) + 1);
        });

        for (const [time, count] of recentSnaps) {
            console.log(`${time}    | ${count}`);
        }
    }
}

main().catch(console.error);
