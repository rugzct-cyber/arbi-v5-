import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Invitation Code Verification API
 * 
 * POST /api/auth/verify
 * Body: { code: string }
 * 
 * Checks Supabase first, then falls back to INVITATION_CODES env variable.
 * Returns: { success: true, level: 'admin' | 'guest' } or { error: string }
 */

interface CodeVerificationResult {
    valid: boolean;
    level?: 'admin' | 'guest';
    error?: string;
}

async function verifyCodeInSupabase(code: string): Promise<CodeVerificationResult | null> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return null; // Supabase not configured, skip
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Query invitation code
        const { data, error } = await supabase
            .from('invitation_codes')
            .select('id, code, level, is_active, used_count, max_uses, expires_at')
            .eq('code', code)
            .eq('is_active', true)
            .single();

        if (error || !data) {
            return null; // Code not found in Supabase
        }

        // Check expiration
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
            return { valid: false, error: 'Code expiré' };
        }

        // Check max uses
        if (data.max_uses !== null && data.used_count >= data.max_uses) {
            return { valid: false, error: 'Code épuisé (limite d\'utilisations atteinte)' };
        }

        // Increment usage counter
        await supabase
            .from('invitation_codes')
            .update({ used_count: (data.used_count || 0) + 1 })
            .eq('id', data.id);

        console.log(`[Auth] Code verified via Supabase: ${code} (level: ${data.level})`);
        return { valid: true, level: data.level as 'admin' | 'guest' };

    } catch (error) {
        console.error('[Auth] Supabase verification error:', error);
        return null; // Fall back to env
    }
}

function verifyCodeInEnv(code: string): CodeVerificationResult | null {
    const invitationCodes = process.env.INVITATION_CODES || '';
    const validCodes = invitationCodes.split(',').map(c => c.trim()).filter(Boolean);

    if (validCodes.length === 0) {
        return null;
    }

    if (validCodes.includes(code)) {
        const level = code.toLowerCase().includes('admin') ? 'admin' : 'guest';
        console.log(`[Auth] Code verified via ENV: ${code} (level: ${level})`);
        return { valid: true, level: level as 'admin' | 'guest' };
    }

    return null;
}

export async function POST(request: NextRequest) {
    try {
        const { code } = await request.json();

        if (!code || typeof code !== 'string') {
            return NextResponse.json(
                { error: 'Code d\'invitation requis' },
                { status: 400 }
            );
        }

        const trimmedCode = code.trim();

        // 1. Try Supabase first
        const supabaseResult = await verifyCodeInSupabase(trimmedCode);

        if (supabaseResult) {
            if (!supabaseResult.valid) {
                return NextResponse.json(
                    { error: supabaseResult.error },
                    { status: 401 }
                );
            }
            // Valid code from Supabase
            return createAuthResponse(trimmedCode, supabaseResult.level!);
        }

        // 2. Fallback to environment variable
        const envResult = verifyCodeInEnv(trimmedCode);

        if (envResult?.valid) {
            return createAuthResponse(trimmedCode, envResult.level!);
        }

        // 3. Code not found anywhere
        return NextResponse.json(
            { error: 'Code d\'invitation invalide' },
            { status: 401 }
        );

    } catch (error) {
        console.error('[Auth] Verification error:', error);
        return NextResponse.json(
            { error: 'Erreur interne' },
            { status: 500 }
        );
    }
}

function createAuthResponse(code: string, level: 'admin' | 'guest') {
    const response = NextResponse.json({
        success: true,
        level
    });

    // Set auth cookie (30 days expiry)
    response.cookies.set('auth-token', code, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
    });

    // Also set level cookie for client-side access
    response.cookies.set('auth-level', level, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
    });

    console.log(`[Auth] User authenticated with level: ${level}`);
    return response;
}
