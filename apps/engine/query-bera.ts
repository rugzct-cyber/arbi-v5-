import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lmogihpdoskyatbsppyb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb2dpaHBkb3NreWF0YnNwcHliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk5MDYzMywiZXhwIjoyMDgxNTY2NjMzfQ.Zeca1HF9kdJbk_0xF6GTTR_XP7YJf-ZVuB694AKuOqY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function queryBera() {
    console.log('🔍 Recherche de toutes les données BERA sur Paradex et Vest...\n');

    // Get BERA data for Paradex and Vest
    const { data, error } = await supabase
        .from('prices')
        .select('*')
        .eq('symbol', 'BERA-USD')
        .in('exchange', ['paradex', 'vest'])
        .order('timestamp', { ascending: true })
        .limit(100);

    if (error) {
        console.error('❌ Erreur:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('❌ Aucune donnée BERA trouvée');

        // Check what symbols exist
        const { data: symbols } = await supabase
            .from('prices')
            .select('symbol')
            .limit(100);

        if (symbols) {
            const uniqueSymbols = [...new Set(symbols.map(s => s.symbol))];
            console.log('\nSymboles disponibles:', uniqueSymbols.join(', '));
        }
        return;
    }

    console.log(`✅ Trouvé ${data.length} entrées BERA:\n`);

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
        const date = new Date(timestamp).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });

        console.log(`📊 ${date} ${time}:`);
        rows.forEach(row => {
            console.log(`   ${row.exchange.padEnd(10)} Bid: ${row.bid?.toFixed(4) || 'N/A'} | Ask: ${row.ask?.toFixed(4) || 'N/A'}`);
        });

        // Calculate spread if both exchanges present
        const paradex = rows.find(r => r.exchange === 'paradex');
        const vest = rows.find(r => r.exchange === 'vest');
        if (paradex && vest && paradex.ask && vest.bid) {
            const spread = ((vest.bid - paradex.ask) / paradex.ask * 100);
            console.log(`   📈 Spread: ${spread.toFixed(4)}%`);
        }
        console.log('');
    });
}

queryBera().catch(console.error);
