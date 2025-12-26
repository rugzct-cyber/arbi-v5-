import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Auth Status Check API
 * 
 * GET /api/auth/status
 * 
 * Returns current auth status based on cookies.
 * Checks both Supabase and env variable for valid codes.
 */

async function isTokenValidInSupabase(token: string): Promise<boolean> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return false;
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase
            .from('invitation_codes')
            .select('code')
            .eq('code', token)
            .eq('is_active', true)
            .single();

        return !error && !!data;
    } catch {
        return false;
    }
}

function isTokenValidInEnv(token: string): boolean {
    const invitationCodes = process.env.INVITATION_CODES || '';
    const validCodes = invitationCodes.split(',').map(c => c.trim()).filter(Boolean);
    return validCodes.includes(token);
}

export async function GET(request: NextRequest) {
    const authToken = request.cookies.get('auth-token')?.value;
    const authLevel = request.cookies.get('auth-level')?.value;

    if (!authToken) {
        return NextResponse.json({
            authenticated: false
        });
    }

    // Check if token is valid in Supabase OR env variable
    const isValidInSupabase = await isTokenValidInSupabase(authToken);
    const isValidInEnv = isTokenValidInEnv(authToken);

    if (!isValidInSupabase && !isValidInEnv) {
        // Token no longer valid anywhere, clear cookies
        const response = NextResponse.json({
            authenticated: false
        });

        response.cookies.set('auth-token', '', { maxAge: 0, path: '/' });
        response.cookies.set('auth-level', '', { maxAge: 0, path: '/' });

        return response;
    }

    return NextResponse.json({
        authenticated: true,
        level: authLevel || 'guest'
    });
}
