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
    if (user && user.fid) {
        currentUserProfile = {
            fid: user.fid,
            username: user.username || 'unknown',
            displayName: user.displayName || user.username || 'Unknown User',
            pfpUrl: user.pfpUrl || 'https://via.placeholder.com/150',
            walletAddress: walletAddress,
        };
        console.log('✅ Set current user profile from SDK context:', currentUserProfile);
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
 * Only returns profile if it's the current user from SDK context
 * For other users, returns null (they'll show as wallet addresses)
 */
export async function fetchFarcasterProfile(walletAddress: string): Promise<FarcasterProfile | null> {
    // Only return profile if this is the current user from SDK context
    if (currentUserProfile && currentUserProfile.walletAddress.toLowerCase() === walletAddress.toLowerCase()) {
        console.log('✅ Using current user profile from SDK context for:', walletAddress);
        return currentUserProfile;
    }

    // For all other users, return null - they'll be displayed as wallet addresses
    console.log('ℹ️ No Farcaster profile available for wallet:', walletAddress, '- will show as wallet address');
    return null;
}

/**
 * Batch fetch multiple Farcaster profiles
 */
export async function fetchFarcasterProfiles(walletAddresses: string[]): Promise<Map<string, FarcasterProfile | null>> {
    const profiles = new Map<string, FarcasterProfile | null>();

    // Process in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < walletAddresses.length; i += batchSize) {
        const batch = walletAddresses.slice(i, i + batchSize);
        const batchPromises = batch.map(async (address) => {
            const profile = await fetchFarcasterProfile(address);
            return { address, profile };
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(({ address, profile }) => {
            profiles.set(address, profile);
        });

        // Small delay between batches to be respectful to the API
        if (i + batchSize < walletAddresses.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return profiles;
}

/**
 * Clear the profile cache (useful for testing or memory management)
 */
export function clearProfileCache(): void {
    profileCache.clear();
}
