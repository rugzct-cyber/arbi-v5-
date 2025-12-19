import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lmogihpdoskyatbsppyb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb2dpaHBkb3NreWF0YnNwcHliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk5MDYzMywiZXhwIjoyMDgxNTY2NjMzfQ.Zeca1HF9kdJbk_0xF6GTTR_XP7YJf-ZVuB694AKuOqY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function deleteParadexAnomalies() {
    console.log('🔍 Recherche des anomalies Paradex aux heures problématiques...\n');

    // Times with known issues (UTC)
    const problemTimes = [
        { start: '2025-12-19T08:00:00Z', end: '2025-12-19T08:05:00Z', name: '9h00 (19/12)' },
        { start: '2025-12-18T21:25:00Z', end: '2025-12-18T21:30:00Z', name: '22h25 (18/12)' },
    ];

    let totalDeleted = 0;

    for (const time of problemTimes) {
        console.log(`\n📅 Vérification ${time.name}...`);

        const { data, error } = await supabase
            .from('prices')
            .select('id, symbol, bid, ask')
            .eq('exchange', 'paradex')
            .gte('timestamp', time.start)
            .lte('timestamp', time.end);

        if (error) {
            console.error('❌ Erreur:', error.message);
            continue;
        }

        if (!data || data.length === 0) {
            console.log('   Aucune donnée');
            continue;
        }

        // Find anomalies
        const anomalyIds: number[] = [];
        data.forEach(row => {
            if (row.bid > 0 && row.ask > 0) {
                const internalSpread = ((row.ask - row.bid) / row.bid) * 100;
                if (internalSpread > 3) {
                    anomalyIds.push(row.id);
                }
            }
        });

        console.log(`   ${data.length} entrées, ${anomalyIds.length} anomalies`);

        if (anomalyIds.length > 0) {
            const { error: deleteError } = await supabase
                .from('prices')
                .delete()
                .in('id', anomalyIds);

            if (deleteError) {
                console.error('   ❌ Erreur suppression:', deleteError.message);
            } else {
                console.log(`   ✅ ${anomalyIds.length} anomalies supprimées`);
                totalDeleted += anomalyIds.length;
            }
        }
    }

    // Also scan all data for any remaining anomalies
    console.log('\n🔍 Scan complet de toutes les données Paradex...');

    let page = 0;
    const PAGE_SIZE = 1000;
    let scanned = 0;

    while (page < 50) { // Max 50 pages
        const { data, error } = await supabase
            .from('prices')
            .select('id, bid, ask')
            .eq('exchange', 'paradex')
            .order('id', { ascending: true })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) break;
        if (!data || data.length === 0) break;

        scanned += data.length;

        const anomalyIds: number[] = [];
        data.forEach(row => {
            if (row.bid > 0 && row.ask > 0) {
                const internalSpread = ((row.ask - row.bid) / row.bid) * 100;
                if (internalSpread > 3) {
                    anomalyIds.push(row.id);
                }
            }
        });

        if (anomalyIds.length > 0) {
            const { error: deleteError } = await supabase
                .from('prices')
                .delete()
                .in('id', anomalyIds);

            if (!deleteError) {
                totalDeleted += anomalyIds.length;
                console.log(`   Page ${page + 1}: supprimé ${anomalyIds.length} anomalies`);
            }
        }

        page++;
    }

    console.log(`\n📊 Total scanné: ${scanned} lignes`);
    console.log(`✅ Total supprimé: ${totalDeleted} anomalies`);
}

deleteParadexAnomalies().catch(console.error);
