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

            // Check if we're in a Farcaster environment
            const isInFarcaster = typeof window !== 'undefined' &&
                (window.location !== window.parent.location ||
                    window.navigator.userAgent.includes('Farcaster') ||
                    window.location.search.includes('farcaster') ||
                    document.referrer.includes('farcaster') ||
                    (window as any).farcaster);

            console.log('Is in Farcaster environment:', isInFarcaster);
            setIsFarcasterEnvironment(isInFarcaster);

            // Always call sdk.actions.ready() to dismiss splash screen
            try {
                console.log('Calling sdk.actions.ready()...');
                await sdk.actions.ready();
                console.log('Farcaster SDK ready - splash screen hidden');
            } catch (sdkError) {
                console.warn('Farcaster SDK not available:', sdkError);
            }

            // Set ready immediately after calling sdk.actions.ready()
            console.log('Setting Farcaster provider ready');
            setIsReady(true);
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
        // Strategy 1: In Farcaster environment, use SDK wallet
        if (isFarcasterEnvironment && typeof window !== 'undefined') {
            console.log('In Farcaster environment - attempting to use SDK wallet...');

            try {
                // Access Farcaster's embedded wallet via SDK
                const fcProvider = await sdk.wallet.getEthereumProvider();

                if (fcProvider) {
                    console.log('✓ Successfully got Farcaster embedded wallet');
                    return fcProvider;
                } else {
                    console.warn('⚠ Farcaster wallet provider returned null');
                }
            } catch (fcError) {
                console.error('✗ Error accessing Farcaster wallet:', fcError);
                // This is expected if wallet capability isn't granted
            }

            // Fallback: Try injected wallet (for desktop Farcaster with extensions)
            if ((window as any).ethereum) {
                console.log('↪ Falling back to injected wallet in Farcaster environment');
                return (window as any).ethereum;
            }

            // No wallet available in Farcaster
            throw new Error('No wallet available. Please grant wallet access in Farcaster settings.');
        }

        // Strategy 2: In regular browser, use injected wallet
        else {
            if (typeof window !== 'undefined' && (window as any).ethereum) {
                console.log('✓ Using browser injected wallet (MetaMask, Coinbase, etc.)');
                return (window as any).ethereum;
            }

            throw new Error('No wallet found. Please install MetaMask or another Web3 wallet.');
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