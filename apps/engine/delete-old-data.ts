import { createClient } from '@supabase/supabase-js';

// New API key
const SUPABASE_URL = 'https://lmogihpdoskyatbsppyb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb2dpaHBkb3NreWF0YnNwcHliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk5MDYzMywiZXhwIjoyMDgxNTY2NjMzfQ.Zeca1HF9kdJbk_0xF6GTTR_XP7YJf-ZVuB694AKuOqY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function deleteOldData() {
    // 17h40 le 18 décembre (heure France = UTC+1) = 16h40 UTC
    const cutoffTime = '2025-12-18T16:40:00Z';

    console.log(`🗑️ Suppression des données avant le 18 décembre 17h40 (France)...`);
    console.log(`   Cutoff UTC: ${cutoffTime}\n`);

    // First, count how many rows will be deleted
    const { count, error: countError } = await supabase
        .from('prices')
        .select('*', { count: 'exact', head: true })
        .lt('timestamp', cutoffTime);

    if (countError) {
        console.error('❌ Erreur comptage:', countError.message);
        return;
    }

    console.log(`📊 ${count} lignes à supprimer`);

    if (count === 0) {
        console.log('✅ Aucune donnée à supprimer');
        return;
    }

    // Confirm before deleting
    console.log(`\n⚠️ Suppression en cours...`);

    // Delete in batches (Supabase has limits)
    const { error: deleteError } = await supabase
        .from('prices')
        .delete()
        .lt('timestamp', cutoffTime);

    if (deleteError) {
        console.error('❌ Erreur suppression:', deleteError.message);
        return;
    }

    console.log(`✅ Suppression terminée!`);

    // Verify
    const { count: remaining } = await supabase
        .from('prices')
        .select('*', { count: 'exact', head: true });

    console.log(`📊 ${remaining} lignes restantes dans la base`);
}

deleteOldData().catch(console.error);
