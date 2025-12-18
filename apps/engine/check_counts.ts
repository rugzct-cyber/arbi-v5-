
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lmogihpdoskyatbsppyb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb2dpaHBkb3NreWF0YnNwcHliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk5MDYzMywiZXhwIjoyMDgxNTY2NjM3fQ.Zeca1HF9kdJbk_0xF6GTTR_XP7YJf-ZVuB694AKuOqY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
    console.log('📊 Analyzing Snapshots...\n');

    // 17:29 Local = 16:29 UTC
    console.log('--- Checking 17:29 Snapshot (16:29 UTC) ---');
    const { data: data1629, error: error1629 } = await supabase
        .from('prices')
        .select('timestamp, symbol')
        .gte('timestamp', '2025-12-18T16:25:00Z')
        .lt('timestamp', '2025-12-18T16:35:00Z');

    if (error1629) console.error('Error fetching 16:29 data:', error1629);
    else {
        console.log(`Total records found: ${data1629.length}`);
        if (data1629.length > 0) {
            // Group by timestamp minutes
            const counts: Record<string, number> = {};
            data1629.forEach(r => {
                const time = r.timestamp.substring(11, 16);
                counts[time] = (counts[time] || 0) + 1;
            });
            console.log('Counts per minute (UTC):', counts);

            // Limit output of symbols
            console.log(`First 10 symbols: ${data1629.slice(0, 10).map(r => r.symbol).join(', ')}...`);
        }
    }

    console.log('\n-------------------\n');

    // Latest Snapshot
    console.log('--- Checking Latest Snapshot ---');
    const { data: latest, error: errorLatest } = await supabase
        .from('prices')
        .select('timestamp')
        .order('timestamp', { ascending: false })
        .limit(300); // Fetch enough to cover one full snapshot

    if (errorLatest) console.error('Error fetching latest data:', errorLatest);
    else if (latest.length > 0) {
        // Find most recent timestamp
        const lastTime = latest[0].timestamp;
        const lastGroup = lastTime.substring(0, 16); // YYYY-MM-DDTHH:MM

        const countLast = latest.filter(r => r.timestamp.startsWith(lastGroup)).length;

        console.log(`Latest Snapshot Time: ${lastTime}`);
        console.log(`Records in this snapshot: ${countLast}`);
    } else {
        console.log('No recent data found.');
    }
}

main().catch(console.error);
