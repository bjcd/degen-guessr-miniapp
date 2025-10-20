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

/**
 * Fetch Farcaster profile data for a wallet address via server proxy
 */
export async function fetchFarcasterProfile(walletAddress: string): Promise<FarcasterProfile | null> {
    const cached = profileCache.get(walletAddress) as CachedProfile | undefined;
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.profile;
    }

    try {
        console.log('Fetching Farcaster profile for wallet:', walletAddress);
        const res = await fetch(`/api/farcaster-profile?address=${walletAddress}`);
        if (!res.ok) {
            profileCache.set(walletAddress, { profile: null, timestamp: Date.now() });
            return null;
        }
        const data = await res.json();
        const prof = data.profile;
        if (!prof) {
            profileCache.set(walletAddress, { profile: null, timestamp: Date.now() });
            return null;
        }
        const profile: FarcasterProfile = {
            fid: prof.fid,
            username: prof.username || 'unknown',
            displayName: prof.displayName || prof.username || 'Unknown User',
            pfpUrl: prof.pfpUrl || 'https://via.placeholder.com/150',
            walletAddress,
        };
        profileCache.set(walletAddress, { profile, timestamp: Date.now() });
        return profile;
    } catch (error) {
        console.error('Error fetching Farcaster profile:', error);
        profileCache.set(walletAddress, { profile: null, timestamp: Date.now() });
        return null;
    }
}

/**
 * Batch fetch multiple Farcaster profiles
 */
export async function fetchFarcasterProfiles(walletAddresses: string[]): Promise<Map<string, FarcasterProfile | null>> {
    const profiles = new Map<string, FarcasterProfile | null>();
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
        if (i + batchSize < walletAddresses.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    return profiles;
}

export function clearProfileCache(): void {
    profileCache.clear();
}
