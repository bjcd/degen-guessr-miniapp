'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

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
    isFarcasterEnvironment: boolean;
}

const FarcasterContext = createContext<FarcasterContextType | undefined>(undefined);

export function FarcasterProvider({ children }: { children: ReactNode }) {
    const [isReady, setIsReady] = useState(false);
    const [user, setUser] = useState<FarcasterUser | null>(null);
    const [isFarcasterEnvironment, setIsFarcasterEnvironment] = useState(false);

    useEffect(() => {
        const initFarcaster = async () => {
            try {
                // Check if we're in a Farcaster environment
                const isInFarcaster = typeof window !== 'undefined' &&
                    (window.location !== window.parent.location ||
                        window.navigator.userAgent.includes('Farcaster') ||
                        window.location.search.includes('farcaster') ||
                        document.referrer.includes('farcaster') ||
                        (window as any).farcaster);

                setIsFarcasterEnvironment(isInFarcaster);

                if (isInFarcaster) {
                    // Initialize Farcaster SDK
                    try {
                        await sdk.actions.ready();
                    } catch (sdkError) {
                        console.warn('Farcaster SDK not available:', sdkError);
                    }
                }

                // Always set ready after a short delay to ensure proper initialization
                setTimeout(() => {
                    setIsReady(true);
                }, 100);
            } catch (error) {
                console.error('Failed to initialize Farcaster SDK:', error);
                setIsReady(true); // Still show the app
            }
        };

        initFarcaster();
    }, []);

    const signIn = async () => {
        try {
            if (isFarcasterEnvironment) {
                // Use real Farcaster authentication
                const { token } = await sdk.quickAuth.getToken();
                console.log('Farcaster token:', token);

                // For now, mock user data - in production you'd validate the token
                setUser({
                    fid: 12345,
                    username: 'farcasteruser',
                    displayName: 'Farcaster User',
                    pfpUrl: 'https://via.placeholder.com/150'
                });
            } else {
                // Mock sign in for development
                setUser({
                    fid: 12345,
                    username: 'degenuser',
                    displayName: 'Degen User',
                    pfpUrl: 'https://via.placeholder.com/150'
                });
            }
        } catch (error) {
            console.error('Sign in failed:', error);
        }
    };

    const signOut = async () => {
        try {
            setUser(null);
        } catch (error) {
            console.error('Sign out failed:', error);
        }
    };

    const getEthereumProvider = async () => {
        try {
            if (isFarcasterEnvironment && typeof window !== 'undefined') {
                // Try to get the real Ethereum provider from Farcaster
                return (window as any).ethereum || (window as any).farcaster?.ethereum;
            } else {
                // Fallback for development
                return (window as any).ethereum || {
                    request: async ({ method, params }: { method: string; params?: any[] }) => {
                        console.log('Mock provider request:', method, params);
                        return [];
                    }
                };
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
                isFarcasterEnvironment,
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