import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lmogihpdoskyatbsppyb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb2dpaHBkb3NreWF0YnNwcHliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk5MDYzMywiZXhwIjoyMDgxNTY2NjMzfQ.Zeca1HF9kdJbk_0xF6GTTR_XP7YJf-ZVuB694AKuOqY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Tokens requested by user
const userTokens = [
    'APEX', 'AERO', 'FARTCOIN', 'MNT', 'S', 'UNI', 'GOAT', 'AVNT', 'JUP', 'LDO',
    'GRASS', 'INIT', 'SNX', 'CRV', 'WLD', 'PENGU', 'NEAR', 'LINEA', 'APT', 'WIF',
    'BERA', 'XPL', 'TIA', 'WLFI', 'VIRTUAL', 'HYPE', 'STRK', 'AAVE', 'MELANIA',
    'TON', 'IP', 'AVAX', 'KAITO', 'ZRO', 'SUI', 'MOODENG', 'DOGE', 'ETH', 'XRP',
    'LINK', 'LTC', 'TAO', 'SEI', 'TRX', 'ARB', 'SOL', 'CAKE', 'OP', 'TRUMP',
    'ADA', 'PENDLE', 'ENA', 'BTC', 'EIGEN', 'MON', 'BNB', 'ASTER', 'PUMP', 'ONDO',
    'RESOLV', 'ZEC', 'POPCAT', 'MEGA', 'ZORA'
];

async function checkTokenCoverage() {
    console.log('🔍 Vérification de la couverture des tokens...\n');

    // Get recent data (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('prices')
        .select('symbol, exchange')
        .gte('timestamp', oneHourAgo);

    if (error) {
        console.error('❌ Erreur:', error.message);
        return;
    }

    // Group by exchange
    const tokensByExchange = new Map<string, Set<string>>();
    data?.forEach(row => {
        if (!tokensByExchange.has(row.exchange)) {
            tokensByExchange.set(row.exchange, new Set());
        }
        tokensByExchange.get(row.exchange)!.add(row.symbol.replace('-USD', ''));
    });

    console.log('📊 Tokens par exchange (dernière heure):\n');

    tokensByExchange.forEach((tokens, exchange) => {
        console.log(`${exchange}: ${tokens.size} tokens`);
    });

    // Check specifically for Hyperliquid and Extended
    const hyperliquidTokens = tokensByExchange.get('hyperliquid') || new Set();
    const extendedTokens = tokensByExchange.get('extended') || new Set();

    console.log('\n📈 Tokens manquants pour Hyperliquid:');
    const missingHL: string[] = [];
    userTokens.forEach(t => {
        if (!hyperliquidTokens.has(t)) {
            missingHL.push(t);
        }
    });
    console.log(missingHL.length > 0 ? missingHL.join(', ') : 'Aucun');

    console.log('\n📈 Tokens manquants pour Extended:');
    const missingExt: string[] = [];
    userTokens.forEach(t => {
        if (!extendedTokens.has(t)) {
            missingExt.push(t);
        }
    });
    console.log(missingExt.length > 0 ? missingExt.join(', ') : 'Aucun');

    // List tokens present in both
    console.log('\n✅ Tokens présents dans les deux (Hyperliquid & Extended):');
    const inBoth: string[] = [];
    userTokens.forEach(t => {
        if (hyperliquidTokens.has(t) && extendedTokens.has(t)) {
            inBoth.push(t);
        }
    });
    console.log(inBoth.join(', '));
    console.log(`\nTotal: ${inBoth.length}/${userTokens.length} tokens`);
}

checkTokenCoverage().catch(console.error);
