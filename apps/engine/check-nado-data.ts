import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseKey?.length);

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNadoData() {
    console.log('🔍 Checking all nado data in database...');

    // Get all unique symbols for nado
    const { data, error } = await supabase
        .from('prices')
        .select('symbol, exchange, timestamp')
        .eq('exchange', 'nado')
        .order('timestamp', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Nado data found:', data?.length, 'records');
    if (data) {
        for (const row of data) {
            console.log(`  ${row.symbol} @ ${row.timestamp}`);
        }
    }
}

checkNadoData().catch(console.error);
