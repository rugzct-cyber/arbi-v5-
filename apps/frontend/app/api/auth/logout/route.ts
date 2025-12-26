import { NextResponse } from 'next/server';

/**
 * Logout API
 * 
 * POST /api/auth/logout
 * 
 * Clears auth cookies and returns success
 */
export async function POST() {
    const response = NextResponse.json({ success: true });

    // Clear auth cookies
    response.cookies.set('auth-token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
    });

    response.cookies.set('auth-level', '', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
    });

    console.log('[Auth] User logged out');
    return response;
}
