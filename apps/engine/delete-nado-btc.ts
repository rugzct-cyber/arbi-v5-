import { createClient } from '@supabase/supabase-js';

// Direct values from .env
const supabaseUrl = 'https://lmogihpdoskyatbsppyb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb2dpaHBkb3NreWF0YnNwcHliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk5MDYzMywiZXhwIjoyMDgxNTY2NjM3fQ.Zeca1HF9kdJbk_0xF6GTTR_XP7YJf-ZVuB694AKuOqY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteNadoBtcBefore11h() {
    const cutoffTime = '2025-12-18T10:00:00.000Z'; // 11h Paris = 10h UTC

    console.log('🔍 First, checking what nado data exists...');

    // Check what symbols exist for nado
    const { data: nadoData, error: nadoError } = await supabase
        .from('prices')
        .select('symbol, timestamp')
        .eq('exchange', 'nado')
        .order('timestamp', { ascending: false })
        .limit(10);

    if (nadoError) {
        console.error('Error:', nadoError);
        return;
    }

    console.log('Nado records found:', nadoData?.length || 0);
    if (nadoData && nadoData.length > 0) {
        console.log('Latest symbols:', [...new Set(nadoData.map(d => d.symbol))]);
        console.log('Latest timestamp:', nadoData[0].timestamp);
    }

    // Count records to delete for BTC
    console.log(`\n🗑️ Counting BTC-USD from nado before ${cutoffTime}...`);

    const { data: toDelete, error: countError } = await supabase
        .from('prices')
        .select('id, timestamp')
        .eq('symbol', 'BTC-USD')
        .eq('exchange', 'nado')
        .lt('timestamp', cutoffTime);

    if (countError) {
        console.error('Count error:', countError);
        return;
    }

    console.log(`Found ${toDelete?.length || 0} records to delete`);

    if (!toDelete || toDelete.length === 0) {
        console.log('✅ No records to delete');
        return;
    }

    // Show what we're about to delete
    console.log('Records to delete:');
    for (const row of toDelete.slice(0, 5)) {
        console.log(`  ID: ${row.id}, Time: ${row.timestamp}`);
    }
    if (toDelete.length > 5) console.log(`  ... and ${toDelete.length - 5} more`);

    // Delete the records
    console.log('\n🗑️ Deleting...');
    const { error: deleteError } = await supabase
        .from('prices')
        .delete()
        .eq('symbol', 'BTC-USD')
        .eq('exchange', 'nado')
        .lt('timestamp', cutoffTime);

    if (deleteError) {
        console.error('Delete error:', deleteError);
        return;
    }

    console.log(`✅ Successfully deleted ${toDelete.length} records`);
}

deleteNadoBtcBefore11h().catch(console.error);
