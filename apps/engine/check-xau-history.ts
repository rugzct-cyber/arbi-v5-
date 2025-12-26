import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lmogihpdoskyatbsppyb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb2dpaHBkb3NreWF0YnNwcHliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk5MDYzMywiZXhwIjoyMDgxNTY2NjMzfQ.Zeca1HF9kdJbk_0xF6GTTR_XP7YJf-ZVuB694AKuOqY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
    console.log('Checking XAU-USD history...');

    // Check Extended XAU data
    console.log('\n=== Extended XAU-USD ===');
    const { count: extendedCount } = await supabase
        .from('prices')
        .select('*', { count: 'exact', head: true })
        .eq('symbol', 'XAU-USD')
        .eq('exchange', 'extended');

    console.log('Total records:', extendedCount ?? 0);

    if (extendedCount && extendedCount > 0) {
        const { data: extLatest } = await supabase
            .from('prices')
            .select('timestamp, bid, ask')
            .eq('symbol', 'XAU-USD')
            .eq('exchange', 'extended')
            .order('timestamp', { ascending: false })
            .limit(3);
        console.log('Latest:', extLatest);
    }

    // Check Lighter XAU data  
    console.log('\n=== Lighter XAU-USD ===');
    const { count: lighterCount } = await supabase
        .from('prices')
        .select('*', { count: 'exact', head: true })
        .eq('symbol', 'XAU-USD')
        .eq('exchange', 'lighter');

    console.log('Total records:', lighterCount ?? 0);

    if (lighterCount && lighterCount > 0) {
        const { data: lightLatest } = await supabase
            .from('prices')
            .select('timestamp, bid, ask')
            .eq('symbol', 'XAU-USD')
            .eq('exchange', 'lighter')
            .order('timestamp', { ascending: false })
            .limit(3);
        console.log('Latest:', lightLatest);

        const { data: lightOldest } = await supabase
            .from('prices')
            .select('timestamp')
            .eq('symbol', 'XAU-USD')
            .eq('exchange', 'lighter')
            .order('timestamp', { ascending: true })
            .limit(1);
        console.log('Oldest:', lightOldest?.[0]?.timestamp);
    }

    // Symbols on Extended
    console.log('\n=== Symbols on Extended ===');
    const { data: extSymbols } = await supabase
        .from('prices')
        .select('symbol')
        .eq('exchange', 'extended')
        .order('timestamp', { ascending: false })
        .limit(200);
    if (extSymbols) {
        const unique = [...new Set(extSymbols.map(r => r.symbol))];
        console.log(unique.join(', '));
    }

    // Symbols on Lighter
    console.log('\n=== Symbols on Lighter ===');
    const { data: lightSymbols } = await supabase
        .from('prices')
        .select('symbol')
        .eq('exchange', 'lighter')
        .order('timestamp', { ascending: false })
        .limit(200);
    if (lightSymbols) {
        const unique = [...new Set(lightSymbols.map(r => r.symbol))];
        console.log(unique.join(', '));
    }
}

main().catch(console.error);
