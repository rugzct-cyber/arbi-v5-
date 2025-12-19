import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lmogihpdoskyatbsppyb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb2dpaHBkb3NreWF0YnNwcHliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk5MDYzMywiZXhwIjoyMDgxNTY2NjMzfQ.Zeca1HF9kdJbk_0xF6GTTR_XP7YJf-ZVuB694AKuOqY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function queryBera9h() {
    // 9h le 19 décembre (France = UTC+1) = 8h UTC
    const startTime = '2025-12-19T07:30:00Z'; // 8h30 France
    const endTime = '2025-12-19T09:30:00Z';   // 10h30 France

    console.log('🔍 BERA sur Paradex et Vest - 19 décembre entre 8h30 et 10h30 (France)\n');

    const { data, error } = await supabase
        .from('prices')
        .select('*')
        .eq('symbol', 'BERA-USD')
        .in('exchange', ['paradex', 'vest'])
        .gte('timestamp', startTime)
        .lte('timestamp', endTime)
        .order('timestamp', { ascending: true });

    if (error) {
        console.error('❌ Erreur:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('❌ Aucune donnée BERA trouvée pour cette période');
        return;
    }

    console.log(`✅ Trouvé ${data.length} entrées:\n`);

    // Group by timestamp
    const byTimestamp = new Map<string, any[]>();
    data.forEach(row => {
        const key = row.timestamp;
        if (!byTimestamp.has(key)) byTimestamp.set(key, []);
        byTimestamp.get(key)!.push(row);
    });

    // Display data
    byTimestamp.forEach((rows, timestamp) => {
        const time = new Date(timestamp).toLocaleTimeString('fr-FR', {
            timeZone: 'Europe/Paris',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        console.log(`📊 ${time}:`);
        rows.forEach(row => {
            console.log(`   ${row.exchange.padEnd(10)} Bid: ${row.bid?.toFixed(4)} | Ask: ${row.ask?.toFixed(4)}`);
        });

        // Calculate spread if both exchanges present
        const paradex = rows.find(r => r.exchange === 'paradex');
        const vest = rows.find(r => r.exchange === 'vest');
        if (paradex && vest) {
            const spread = ((vest.bid - paradex.ask) / paradex.ask * 100);
            const flag = Math.abs(spread) > 3 ? ' ⚠️ ANOMALIE' : '';
            console.log(`   📈 Spread: ${spread.toFixed(4)}%${flag}`);
        }
        console.log('');
    });
}

queryBera9h().catch(console.error);
