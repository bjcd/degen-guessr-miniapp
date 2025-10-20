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
 * Fetch Farcaster profile data for a wallet address
 * Uses the Farcaster API to resolve wallet address to profile
 */
export async function fetchFarcasterProfile(walletAddress: string): Promise<FarcasterProfile | null> {
    // Check cache first
    const cached = profileCache.get(walletAddress) as CachedProfile | undefined;
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.profile;
    }

    try {
        console.log('Fetching Farcaster profile for wallet:', walletAddress);

        // Use Farcaster's API to resolve wallet address to FID
        const response = await fetch(`https://api.warpcast.com/v2/verifications?address=${walletAddress}`, {
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.log('No Farcaster profile found for wallet:', walletAddress);
            profileCache.set(walletAddress, { profile: null, timestamp: Date.now() });
            return null;
        }

        const data = await response.json();

        if (!data.result || !data.result.verifications || data.result.verifications.length === 0) {
            console.log('No verifications found for wallet:', walletAddress);
            profileCache.set(walletAddress, { profile: null, timestamp: Date.now() });
            return null;
        }

        // Get the first verification (most recent)
        const verification = data.result.verifications[0];
        const fid = verification.fid;

        // Now fetch the profile data for this FID
        const profileResponse = await fetch(`https://api.warpcast.com/v2/user?fid=${fid}`, {
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!profileResponse.ok) {
            console.log('Failed to fetch profile for FID:', fid);
            profileCache.set(walletAddress, { profile: null, timestamp: Date.now() });
            return null;
        }

        const profileData = await profileResponse.json();

        if (!profileData.result || !profileData.result.user) {
            console.log('No user data found for FID:', fid);
            profileCache.set(walletAddress, { profile: null, timestamp: Date.now() });
            return null;
        }

        const user = profileData.result.user;
        const profile: FarcasterProfile = {
            fid: user.fid,
            username: user.username || 'unknown',
            displayName: user.displayName || user.username || 'Unknown User',
            pfpUrl: user.pfpUrl || 'https://via.placeholder.com/150',
            walletAddress: walletAddress,
        };

        console.log('Successfully fetched Farcaster profile:', profile);
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
