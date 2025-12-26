import { NextRequest, NextResponse } from 'next/server';

/**
 * Auth Status Check API
 * 
 * GET /api/auth/status
 * 
 * Returns current auth status based on cookies
 */
export async function GET(request: NextRequest) {
    const authToken = request.cookies.get('auth-token')?.value;
    const authLevel = request.cookies.get('auth-level')?.value;

    if (!authToken) {
        return NextResponse.json({
            authenticated: false
        });
    }

    // Verify the token is still valid
    const invitationCodes = process.env.INVITATION_CODES || '';
    const validCodes = invitationCodes.split(',').map(c => c.trim()).filter(Boolean);

    if (!validCodes.includes(authToken)) {
        // Token no longer valid, clear cookies
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
