'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type AuthLevel = 'admin' | 'guest' | null;

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    level: AuthLevel;
    login: (code: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [level, setLevel] = useState<AuthLevel>(null);

    // Check auth status on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch('/api/auth/status');
                const data = await response.json();

                setIsAuthenticated(data.authenticated);
                setLevel(data.level || null);
            } catch (error) {
                console.error('[Auth] Status check failed:', error);
                setIsAuthenticated(false);
                setLevel(null);
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = useCallback(async (code: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });

            const data = await response.json();

            if (data.success) {
                setIsAuthenticated(true);
                setLevel(data.level);
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Code invalide' };
            }
        } catch (error) {
            console.error('[Auth] Login failed:', error);
            return { success: false, error: 'Erreur de connexion' };
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('[Auth] Logout error:', error);
        } finally {
            setIsAuthenticated(false);
            setLevel(null);
        }
    }, []);

    return (
        <AuthContext.Provider value={{ isAuthenticated, isLoading, level, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
