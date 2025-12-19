import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lmogihpdoskyatbsppyb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb2dpaHBkb3NreWF0YnNwcHliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk5MDYzMywiZXhwIjoyMDgxNTY2NjMzfQ.Zeca1HF9kdJbk_0xF6GTTR_XP7YJf-ZVuB694AKuOqY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkParadex9h() {
    // 9h le 19 décembre (France = UTC+1) = 8h UTC
    const targetTime = '2025-12-19T08:00:00Z'; // 9h France
    const endTime = '2025-12-19T08:05:00Z';    // 9h05 France

    console.log('🔍 Tous les tokens Paradex à 9h00 (19 décembre)\n');

    const { data, error } = await supabase
        .from('prices')
        .select('*')
        .eq('exchange', 'paradex')
        .gte('timestamp', targetTime)
        .lte('timestamp', endTime)
        .order('symbol', { ascending: true });

    if (error) {
        console.error('❌ Erreur:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('❌ Aucune donnée');
        return;
    }

    console.log(`📊 ${data.length} tokens Paradex à 9h00:\n`);
    console.log('Token'.padEnd(12) + 'Bid'.padEnd(15) + 'Ask'.padEnd(15) + 'Spread Interne'.padEnd(15) + 'Status');
    console.log('-'.repeat(70));

    let anomalyCount = 0;

    data.forEach(row => {
        const internalSpread = row.ask > 0 ? ((row.ask - row.bid) / row.bid * 100) : 0;
        const isAnomaly = internalSpread > 3; // > 3% de spread interne = suspect

        if (isAnomaly) anomalyCount++;

        const symbol = row.symbol.replace('-USD', '').padEnd(12);
        const bid = row.bid?.toFixed(4).padEnd(15);
        const ask = row.ask?.toFixed(4).padEnd(15);
        const spread = `${internalSpread.toFixed(2)}%`.padEnd(15);
        const status = isAnomaly ? '⚠️ ANOMALIE' : '✅';

        console.log(`${symbol}${bid}${ask}${spread}${status}`);
    });

    console.log('-'.repeat(70));
    console.log(`\n📈 Résumé: ${anomalyCount} anomalies sur ${data.length} tokens`);
}

checkParadex9h().catch(console.error);
