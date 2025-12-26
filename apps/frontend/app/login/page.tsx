'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const result = await login(code);

        if (result.success) {
            router.push('/');
        } else {
            setError(result.error || 'Code invalide');
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0a0b0d 0%, #1a1d26 50%, #0f1015 100%)',
            padding: '1rem',
        }}>
            {/* Background effects */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)',
                pointerEvents: 'none',
            }} />

            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '420px',
            }}>
                {/* Card */}
                <div style={{
                    background: 'linear-gradient(180deg, rgba(26, 29, 38, 0.95) 0%, rgba(18, 20, 26, 0.98) 100%)',
                    borderRadius: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '3rem 2.5rem',
                    boxShadow: '0 25px 100px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                }}>
                    {/* Logo */}
                    <div style={{
                        textAlign: 'center',
                        marginBottom: '2.5rem',
                    }}>
                        <div style={{
                            fontSize: '3rem',
                            marginBottom: '1rem',
                        }}>⚡</div>
                        <h1 style={{
                            fontSize: '1.75rem',
                            fontWeight: 700,
                            color: '#f1f1f1',
                            margin: 0,
                            letterSpacing: '-0.02em',
                        }}>Arbitrage v5</h1>
                        <p style={{
                            color: '#71717a',
                            fontSize: '0.9rem',
                            marginTop: '0.5rem',
                        }}>Entrez votre code d'invitation</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="Code d'invitation..."
                                autoFocus
                                autoComplete="off"
                                style={{
                                    width: '100%',
                                    padding: '1rem 1.25rem',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: error ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                    color: '#f1f1f1',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'all 0.2s ease',
                                    boxSizing: 'border-box',
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = error ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.1)';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        {/* Error message */}
                        {error && (
                            <div style={{
                                padding: '0.75rem 1rem',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                borderRadius: '10px',
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                            }}>
                                <span style={{ fontSize: '1rem' }}>⚠️</span>
                                <span style={{ color: '#f87171', fontSize: '0.875rem' }}>{error}</span>
                            </div>
                        )}

                        {/* Submit button */}
                        <button
                            type="submit"
                            disabled={!code.trim() || isLoading}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: code.trim() && !isLoading
                                    ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                                    : 'rgba(255, 255, 255, 0.05)',
                                border: 'none',
                                borderRadius: '12px',
                                color: code.trim() && !isLoading ? 'white' : '#71717a',
                                fontSize: '1rem',
                                fontWeight: 600,
                                cursor: code.trim() && !isLoading ? 'pointer' : 'not-allowed',
                                transition: 'all 0.2s ease',
                                boxShadow: code.trim() && !isLoading
                                    ? '0 4px 20px rgba(99, 102, 241, 0.3)'
                                    : 'none',
                            }}
                        >
                            {isLoading ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <span style={{
                                        width: '16px',
                                        height: '16px',
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: 'white',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite',
                                    }} />
                                    Vérification...
                                </span>
                            ) : (
                                'Accéder au Dashboard'
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p style={{
                    textAlign: 'center',
                    color: '#52525b',
                    fontSize: '0.8rem',
                    marginTop: '2rem',
                }}>
                    Accès sur invitation uniquement
                </p>
            </div>

            <style jsx global>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
