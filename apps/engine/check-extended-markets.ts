import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lmogihpdoskyatbsppyb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb2dpaHBkb3NreWF0YnNwcHliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk5MDYzMywiZXhwIjoyMDgxNTY2NjMzfQ.Zeca1HF9kdJbk_0xF6GTTR_XP7YJf-ZVuB694AKuOqY';

async function main() {
    console.log('Checking Extended Exchange API for XAU...\n');

    // Fetch markets from Extended API
    const response = await fetch('https://api.starknet.extended.exchange/api/v1/info/markets');
    const data = await response.json();

    if (!data.data) {
        console.log('No data from Extended API');
        return;
    }

    // Search for XAU
    const xauMarkets = data.data.filter((m: any) =>
        m.assetName?.toUpperCase().includes('XAU') ||
        m.name?.toUpperCase().includes('XAU')
    );

    if (xauMarkets.length > 0) {
        console.log('=== XAU Markets found on Extended ===');
        xauMarkets.forEach((m: any) => {
            console.log(`  Name: ${m.name}, Asset: ${m.assetName}, Status: ${m.status}`);
        });
    } else {
        console.log('❌ XAU NOT FOUND on Extended Exchange');
    }

    // List all available assets
    console.log('\n=== All Active Markets on Extended ===');
    const activeMarkets = data.data.filter((m: any) => m.status === 'ACTIVE');
    const symbols = activeMarkets.map((m: any) => m.assetName || m.name.replace('-USD', ''));
    console.log(`Total: ${activeMarkets.length} markets`);
    console.log(`Symbols: ${symbols.join(', ')}`);
}

main().catch(console.error);
