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
            console.log('Initializing Farcaster provider...');
            try {
                // Always call sdk.actions.ready() first to dismiss splash screen
                try {
                    console.log('Calling sdk.actions.ready()...');
                    await sdk.actions.ready();
                    console.log('Farcaster SDK ready - splash screen hidden');
                } catch (sdkError) {
                    console.warn('Farcaster SDK not available:', sdkError);
                }

                // Check if we're in a Farcaster environment
                const isInFarcaster = typeof window !== 'undefined' &&
                    (window.location !== window.parent.location ||
                        window.navigator.userAgent.includes('Farcaster') ||
                        window.location.search.includes('farcaster') ||
                        document.referrer.includes('farcaster') ||
                        (window as any).farcaster);

                console.log('Is in Farcaster environment:', isInFarcaster);
                setIsFarcasterEnvironment(isInFarcaster);

                // Always set ready after a short delay to ensure proper initialization
                console.log('Setting timeout to mark as ready...');
                setTimeout(() => {
                    console.log('Setting Farcaster provider ready');
                    setIsReady(true);
                }, 100);
            } catch (error) {
                console.error('Failed to initialize Farcaster SDK:', error);
                console.log('Setting ready due to error');
                setIsReady(true); // Still show the app
            }
        };

        initFarcaster();
    }, []);

    const signIn = async () => {
        try {
            if (isFarcasterEnvironment) {
                // Get real Farcaster auth token
                console.log('Authenticating with Farcaster...');
                const { token } = await sdk.quickAuth.getToken();
                console.log('Farcaster token received');

                // Fetch user context
                const context = await sdk.context;
                const userProfile = context.user;

                console.log('Farcaster user profile:', userProfile);

                setUser({
                    fid: userProfile.fid,
                    username: userProfile.username || 'Unknown',
                    displayName: userProfile.displayName || 'Farcaster User',
                    pfpUrl: userProfile.pfpUrl || 'https://via.placeholder.com/150'
                });

                console.log('Authenticated Farcaster user:', userProfile);
            } else {
                // Mock for web app (no change to existing behavior)
                console.log('Web app mode: Using mock authentication');
                setUser({
                    fid: 0,
                    username: 'webuser',
                    displayName: 'Web User',
                    pfpUrl: 'https://via.placeholder.com/150'
                });
            }
        } catch (error) {
            console.error('Sign in failed:', error);
            // Fallback to mock data if Farcaster auth fails
            setUser({
                fid: 0,
                username: 'guest',
                displayName: 'Guest User',
                pfpUrl: 'https://via.placeholder.com/150'
            });
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
                // Use Farcaster's embedded wallet provider
                console.log('Attempting to get Farcaster embedded wallet...');
                try {
                    const fcProvider = await sdk.wallet.ethProvider;
                    if (fcProvider) {
                        console.log('Using Farcaster embedded wallet');
                        return fcProvider;
                    }
                } catch (fcError) {
                    console.warn('Farcaster wallet not available:', fcError);
                }

                // Fallback to window.ethereum if Farcaster wallet not available
                if ((window as any).ethereum) {
                    console.log('Using window.ethereum as fallback');
                    return (window as any).ethereum;
                }
            } else {
                // Use browser wallet (MetaMask, etc.) for web app
                if (typeof window !== 'undefined' && (window as any).ethereum) {
                    console.log('Using browser wallet');
                    return (window as any).ethereum;
                }
            }

            throw new Error('No wallet provider found');
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