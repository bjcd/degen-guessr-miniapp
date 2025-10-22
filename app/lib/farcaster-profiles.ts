// Farcaster profile utilities for fetching user data by wallet address

export interface FarcasterProfile {
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
    walletAddress: string;
}

// Cache to avoid repeated API calls
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CachedProfile {
    profile: FarcasterProfile | null;
    timestamp: number;
}

const profileCache = new Map<string, CachedProfile>();

// Current user profile from SDK context (if available)
let currentUserProfile: FarcasterProfile | null = null;

/**
 * Set the current user's profile from SDK context
 */
export function setCurrentUserProfile(user: any, walletAddress: string): void {
    console.log('🔧 setCurrentUserProfile called with:', { user, walletAddress });
    if (user && user.fid) {
        currentUserProfile = {
            fid: user.fid,
            username: user.username || 'unknown',
            displayName: user.displayName || user.username || 'Unknown User',
            pfpUrl: user.pfpUrl || 'https://via.placeholder.com/150',
            walletAddress: walletAddress,
        };
        console.log('✅ Set current user profile from SDK context:', currentUserProfile);
    } else {
        console.log('❌ Failed to set current user profile:', { user, walletAddress, hasFid: user?.fid });
    }
}

/**
 * Get the current user's profile from SDK context
 */
export function getCurrentUserProfile(): FarcasterProfile | null {
    return currentUserProfile;
}

/**
 * Fetch Farcaster profile data for a wallet address
 * Uses SDK context for current user (instant), server API for other users
 * Returns null if no Farcaster profile found (shows as wallet address)
 */
export async function fetchFarcasterProfile(walletAddress: string): Promise<FarcasterProfile | null> {
    console.log('🔍 fetchFarcasterProfile called for:', walletAddress);
    console.log('🔍 currentUserProfile:', currentUserProfile);
    
    // Check if this is the current user first (use SDK context for instant response)
    if (currentUserProfile && currentUserProfile.walletAddress.toLowerCase() === walletAddress.toLowerCase()) {
        console.log('✅ Using current user profile from SDK context for:', walletAddress);
        return currentUserProfile;
    }

    // Check cache first for other users
    const cached = profileCache.get(walletAddress) as CachedProfile | undefined;
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('Using cached Farcaster profile for:', walletAddress);
        return cached.profile;
    }

    // Try to fetch profile for other users via server API
    try {
        console.log('🔍 Fetching Farcaster profile via server API for wallet:', walletAddress);

        const response = await fetch('/api/fc/users-by-address', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ addresses: [walletAddress] }),
        });

        if (!response.ok) {
            console.log('❌ Server API error for wallet:', walletAddress, 'Status:', response.status);
            profileCache.set(walletAddress, { profile: null, timestamp: Date.now() });
            return null;
        }

        const { result } = await response.json();
        console.log('🔍 Server API response for', walletAddress, ':', result);
        
        const addressData = result.find((r: any) => r.address.toLowerCase() === walletAddress.toLowerCase());
        console.log('🔍 Address data for', walletAddress, ':', addressData);

        if (!addressData || !addressData.users || addressData.users.length === 0) {
            console.log('❌ No Farcaster profile found for wallet:', walletAddress);
            profileCache.set(walletAddress, { profile: null, timestamp: Date.now() });
            return null;
        }

        // Use the first user (could implement better selection logic)
        const user = addressData.users[0];
        const profile: FarcasterProfile = {
            fid: user.fid,
            username: user.username || 'unknown',
            displayName: user.username || 'Unknown User',
            pfpUrl: user.pfp || 'https://via.placeholder.com/150',
            walletAddress: walletAddress,
        };

        console.log('✅ Successfully fetched Farcaster profile via server API:', profile);
        profileCache.set(walletAddress, { profile, timestamp: Date.now() });
        return profile;

    } catch (error) {
        console.error('Error fetching Farcaster profile via server API for', walletAddress, ':', error);
        profileCache.set(walletAddress, { profile: null, timestamp: Date.now() });
        return null;
    }
}

/**
 * Batch fetch multiple Farcaster profiles using server API
 */
export async function fetchFarcasterProfiles(walletAddresses: string[]): Promise<Map<string, FarcasterProfile | null>> {
    const results = new Map<string, FarcasterProfile | null>();
    
    // Filter out addresses we already have cached
    const uncachedAddresses: string[] = [];
    const cachedResults = new Map<string, FarcasterProfile | null>();
    
    walletAddresses.forEach(address => {
        const cached = profileCache.get(address) as CachedProfile | undefined;
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            cachedResults.set(address, cached.profile);
        } else {
            uncachedAddresses.push(address);
        }
    });
    
    // Add cached results
    cachedResults.forEach((profile, address) => {
        results.set(address, profile);
    });
    
    // If no uncached addresses, return cached results
    if (uncachedAddresses.length === 0) {
        return results;
    }
    
    // Batch fetch uncached addresses via server API
    try {
        console.log('🔍 Batch fetching Farcaster profiles via server API for:', uncachedAddresses);
        
        const response = await fetch('/api/fc/users-by-address', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ addresses: uncachedAddresses }),
        });

        if (!response.ok) {
            console.log('❌ Server API error for batch fetch, Status:', response.status);
            // Fallback: set all uncached addresses to null
            uncachedAddresses.forEach(address => {
                results.set(address, null);
                profileCache.set(address, { profile: null, timestamp: Date.now() });
            });
            return results;
        }

        const { result } = await response.json();
        
        // Process each address
        uncachedAddresses.forEach(address => {
            const addressData = result.find((r: any) => r.address.toLowerCase() === address.toLowerCase());
            
            if (!addressData || !addressData.users || addressData.users.length === 0) {
                results.set(address, null);
                profileCache.set(address, { profile: null, timestamp: Date.now() });
                console.log('❌ No profile found for:', address);
            } else {
                // Use the first user (could implement better selection logic)
                const user = addressData.users[0];
                const profile: FarcasterProfile = {
                    fid: user.fid,
                    username: user.username || 'unknown',
                    displayName: user.username || 'Unknown User',
                    pfpUrl: user.pfp || 'https://via.placeholder.com/150',
                    walletAddress: address,
                };
                
                results.set(address, profile);
                profileCache.set(address, { profile, timestamp: Date.now() });
                console.log('✅ Batch fetched profile for:', address, profile.username);
            }
        });
        
    } catch (error) {
        console.error('Error batch fetching Farcaster profiles via server API:', error);
        // Fallback: set all uncached addresses to null
        uncachedAddresses.forEach(address => {
            results.set(address, null);
            profileCache.set(address, { profile: null, timestamp: Date.now() });
        });
    }
    
    return results;
}

/**
 * Clear the profile cache (useful for testing or memory management)
 */
export function clearProfileCache(): void {
    profileCache.clear();
}
