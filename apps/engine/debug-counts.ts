
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env manually from current directory
const envPath = path.resolve(process.cwd(), '.env');
console.log(`Reading env from: ${envPath}`);

try {
    const envText = fs.readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};

    envText.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            if (key && value) env[key] = value;
        }
    });

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
        console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
        process.exit(1);
    }

    console.log(`URL: ${env.SUPABASE_URL}`);
    // Show first/last chars of key to verify
    console.log(`Key: ${env.SUPABASE_SERVICE_KEY.substring(0, 10)}...${env.SUPABASE_SERVICE_KEY.substring(env.SUPABASE_SERVICE_KEY.length - 10)}`);

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    async function run() {
        console.log('\n📊 Querying Database...');

        // 17:29 Local = 16:29 UTC
        // Look for snapshot between 16:28 and 16:35 UTC
        const { data: snapshot1729, error: error1729 } = await supabase
            .from('prices')
            .select('timestamp')
            .gte('timestamp', '2025-12-18T16:28:00Z')
            .lt('timestamp', '2025-12-18T16:35:00Z');

        if (error1729) {
            console.error('Error querying 17:29:', error1729.message);
        } else {
            console.log(`\n📅 SNAPSHOT 17:29 Local (16:29 UTC)`);
            console.log(`Total Records: ${snapshot1729.length}`);

            // Group by minute
            const counts: Record<string, number> = {};
            snapshot1729.forEach(r => {
                const min = r.timestamp.substring(11, 16);
                counts[min] = (counts[min] || 0) + 1;
            });
            console.log('Counts per minute:', counts);
        }

        // Latest Snapshot
        const { data: latest, error: errorLatest } = await supabase
            .from('prices')
            .select('timestamp')
            .order('timestamp', { ascending: false })
            .limit(500);

        if (errorLatest) {
            console.error('Error querying latest:', errorLatest.message);
        } else if (latest.length > 0) {
            const lastTime = latest[0].timestamp;
            // Get all records with same minute as last record
            const lastMinute = lastTime.substring(0, 16);
            const count = latest.filter(r => r.timestamp.startsWith(lastMinute)).length;

            console.log(`\n📅 LATEST SNAPSHOT (${lastTime})`);
            console.log(`Total Records: ${count}`);
        } else {
            console.log('\n❌ No recent records found.');
        }
    }

    run();

} catch (e: any) {
    console.error('Error reading .env or running script:', e.message);
}
