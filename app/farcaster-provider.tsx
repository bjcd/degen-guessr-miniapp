'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface FarcasterUser {
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
}

interface FarcasterContextType {
    isReady: boolean;
    user: FarcasterUser | null;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
    getEthereumProvider: () => Promise<any>;
}

const FarcasterContext = createContext<FarcasterContextType | undefined>(undefined);

export function FarcasterProvider({ children }: { children: ReactNode }) {
    const [isReady, setIsReady] = useState(false);
    const [user, setUser] = useState<FarcasterUser | null>(null);

    useEffect(() => {
        // Initialize Farcaster SDK
        const initFarcaster = async () => {
            try {
                // Check if we're in a Farcaster environment
                if (typeof window !== 'undefined' && (window as any).farcaster) {
                    // Call ready() to hide splash screen
                    await (window as any).farcaster.actions.ready();
                    setIsReady(true);
                } else {
                    // Fallback for development
                    setIsReady(true);
                }
            } catch (error) {
                console.error('Failed to initialize Farcaster SDK:', error);
                setIsReady(true); // Still show the app
            }
        };

        initFarcaster();
    }, []);

    const signIn = async () => {
        try {
            if (typeof window !== 'undefined' && (window as any).farcaster) {
                const result = await (window as any).farcaster.actions.signin();
                setUser(result);
            } else {
                // Mock sign in for development
                setUser({
                    fid: 12345,
                    username: 'testuser',
                    displayName: 'Test User',
                    pfpUrl: 'https://via.placeholder.com/100',
                });
            }
        } catch (error) {
            console.error('Sign in failed:', error);
        }
    };

    const signOut = async () => {
        try {
            if (typeof window !== 'undefined' && (window as any).farcaster) {
                await (window as any).farcaster.actions.signout();
            }
            setUser(null);
        } catch (error) {
            console.error('Sign out failed:', error);
        }
    };

    const getEthereumProvider = async () => {
        try {
            if (typeof window !== 'undefined' && (window as any).farcaster) {
                return await (window as any).farcaster.wallet.getEthereumProvider();
            } else {
                // Fallback for development
                return (window as any).ethereum;
            }
        } catch (error) {
            console.error('Failed to get Ethereum provider:', error);
            return null;
        }
    };

    return (
        <FarcasterContext.Provider
            value={{
                isReady,
                user,
                signIn,
                signOut,
                getEthereumProvider,
            }}
        >
            {children}
        </FarcasterContext.Provider>
    );
}

export function useFarcaster() {
    const context = useContext(FarcasterContext);
    if (context === undefined) {
        throw new Error('useFarcaster must be used within a FarcasterProvider');
    }
    return context;
}
