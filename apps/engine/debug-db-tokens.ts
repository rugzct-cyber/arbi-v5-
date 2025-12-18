/**
 * Debug script to compare tokens before and after REST transition
 * Run with: npx tsx debug-db-tokens.ts
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_KEY || ''
);

async function main() {
    console.log('📊 Comparing tokens before/after 17:29...\n');

    // Get tokens BEFORE 17:29 (16:29 to 17:29 = 1 hour before transition)
    const { data: beforeData, error: beforeErr } = await supabase
        .from('prices')
        .select('exchange, symbol')
        .gte('timestamp', '2025-12-18T16:29:00Z')
        .lt('timestamp', '2025-12-18T17:29:00Z');

    if (beforeErr) {
        console.error('Error fetching before data:', beforeErr);
        return;
    }

    // Get tokens AFTER 17:29 (17:29 to 19:00 = after transition)
    const { data: afterData, error: afterErr } = await supabase
        .from('prices')
        .select('exchange, symbol')
        .gte('timestamp', '2025-12-18T17:29:00Z')
        .lt('timestamp', '2025-12-18T20:00:00Z');

    if (afterErr) {
        console.error('Error fetching after data:', afterErr);
        return;
    }

    // Build unique exchange+symbol sets
    const beforeSet = new Set<string>();
    const afterSet = new Set<string>();

    for (const row of beforeData || []) {
        beforeSet.add(`${row.exchange}:${row.symbol}`);
    }

    for (const row of afterData || []) {
        afterSet.add(`${row.exchange}:${row.symbol}`);
    }

    console.log(`Before 17:29: ${beforeSet.size} unique exchange:symbol pairs`);
    console.log(`After 17:29: ${afterSet.size} unique exchange:symbol pairs\n`);

    // Find missing pairs
    const missing: string[] = [];
    for (const pair of beforeSet) {
        if (!afterSet.has(pair)) {
            missing.push(pair);
        }
    }

    console.log(`\n❌ MISSING AFTER 17:29 (${missing.length} pairs):`);
    missing.sort().forEach(pair => console.log(`  - ${pair}`));

    // Group by exchange
    const byExchange = new Map<string, string[]>();
    for (const pair of missing) {
        const [exchange, symbol] = pair.split(':');
        if (!byExchange.has(exchange)) byExchange.set(exchange, []);
        byExchange.get(exchange)!.push(symbol);
    }

    console.log('\n📋 Grouped by exchange:');
    for (const [exchange, symbols] of byExchange) {
        console.log(`  ${exchange}: ${symbols.join(', ')}`);
    }
}

main().catch(console.error);
