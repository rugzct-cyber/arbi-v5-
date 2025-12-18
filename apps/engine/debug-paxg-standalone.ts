
import { createClient } from '@supabase/supabase-js';

// Hardcoded from apps/engine/.env to bypass env loading issues
const SUPABASE_URL = 'https://lmogihpdoskyatbsppyb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb2dpaHBkb3NreWF0YnNwcHliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk5MDYzMywiZXhwIjoyMDgxNTY2NjM3fQ.Zeca1HF9kdJbk_0xF6GTTR_XP7YJf-ZVuB694AKuOqY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log('🔍 Querying PAXG prices around 2025-12-18T00:59:00.262...');

    const { data: prices, error } = await supabase
        .from('prices')
        .select('*')
        .eq('symbol', 'PAXG-USD')
        .gte('timestamp', '2025-12-18T00:59:00.260Z')
        .lte('timestamp', '2025-12-18T00:59:00.265Z'); // Tight window for exact snapshot match

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${prices?.length} prices.`);
    if (prices) {
        console.table(prices.map(p => ({
            exchange: p.exchange,
            bid: p.bid,
            ask: p.ask,
            received_at: p.received_at
        })));

        // Analyze Lighter vs Vest
        const vest = prices.find(p => p.exchange === 'vest');
        const lighter = prices.find(p => p.exchange === 'lighter');

        if (vest && lighter) {
            console.log('\n--- Analysis ---');
            console.log(`Vest Bid: ${vest.bid}`);
            console.log(`Lighter Ask: ${lighter.ask}`);

            // Formula from SpreadChart logic
            // spread = ((bid - ask) / ask) * 100
            const spread = ((vest.bid - lighter.ask) / lighter.ask) * 100;
            console.log(`Spread (Bid_Vest - Ask_Lighter) / Ask_Lighter: ${spread.toFixed(4)}%`);
        }
    }
}

main();
