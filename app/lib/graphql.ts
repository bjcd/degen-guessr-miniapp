// GraphQL client for The Graph subgraph
const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL || "https://api.thegraph.com/subgraphs/name/your-username/degen-guessr";
const API_KEY = process.env.NEXT_PUBLIC_THEGRAPH_API_KEY;

export interface Win {
  id: string;
  tx: string;
  block: string;
  timestamp: string;
  player: string;
  guessedNumber: number;
  winningNumber: number;
  amount: string;
  contractAddress?: string;
  mode?: string;
}

export interface GameStats {
  totalWins: number;
  totalPot: string;
  lastUpdated: string;
}

// In-memory cache for winners (session-based)
const winnersCache = new Map<string, { data: Win[], timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

// Helper function to make GraphQL requests with API key
async function makeGraphQLRequest(query: string, variables: any = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (API_KEY) {
    headers['X-API-KEY'] = API_KEY;
  }

  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      variables
    })
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

export async function getRecentWinners(limit: number = 10): Promise<Win[]> {
  const cacheKey = `winners-${limit}`;
  const cached = winnersCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Returning cached winners');
    return cached.data;
  }

  const query = `
    query GetRecentWinners($limit: Int!) {
      wins(
        first: $limit
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        tx
        block
        timestamp
        player
        guessedNumber
        winningNumber
        amount
        contractAddress
        mode
      }
    }
  `;

  try {
    const data = await makeGraphQLRequest(query, { limit });
    const wins = data?.wins || [];

    // Cache the results
    winnersCache.set(cacheKey, { data: wins, timestamp: Date.now() });

    return wins;
  } catch (error) {
    console.error('Error fetching recent winners:', error);
    // Return cached data if available, even if expired
    if (cached) {
      console.log('Returning expired cached winners due to error');
      return cached.data;
    }
    return [];
  }
}

export async function getGameStats(): Promise<GameStats | null> {
  const query = `
    query GetGameStats {
      gameStats(id: "game-stats") {
        totalWins
        totalPot
        lastUpdated
      }
    }
  `;

  try {
    const data = await makeGraphQLRequest(query);
    return data?.gameStats || null;
  } catch (error) {
    console.error('Error fetching game stats:', error);
    return null;
  }
}

export async function getWinnersByPlayer(player: string, limit: number = 10): Promise<Win[]> {
  const cacheKey = `winners-player-${player}-${limit}`;
  const cached = winnersCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Returning cached player winners');
    return cached.data;
  }

  const query = `
    query GetWinnersByPlayer($player: Bytes!, $limit: Int!) {
      wins(
        first: $limit
        orderBy: timestamp
        orderDirection: desc
        where: { player: $player }
      ) {
        id
        tx
        block
        timestamp
        player
        guessedNumber
        winningNumber
        amount
        contractAddress
        mode
      }
    }
  `;

  try {
    const data = await makeGraphQLRequest(query, { player, limit });
    const wins = data?.wins || [];

    // Cache the results
    winnersCache.set(cacheKey, { data: wins, timestamp: Date.now() });

    return wins;
  } catch (error) {
    console.error('Error fetching player winners:', error);
    // Return cached data if available, even if expired
    if (cached) {
      console.log('Returning expired cached player winners due to error');
      return cached.data;
    }
    return [];
  }
}

// Batched query to fetch all public data in one request
export async function getPublicData(limit: number = 10): Promise<{
  wins: Win[];
  gameStats: GameStats | null;
}> {
  const cacheKey = `public-data-${limit}`;
  const cached = winnersCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Returning cached public data');
    return cached.data as any;
  }

  const query = `
    query GetPublicData($limit: Int!) {
      wins(
        first: $limit
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        tx
        block
        timestamp
        player
        guessedNumber
        winningNumber
        amount
        contractAddress
        mode
      }
      gameStats(id: "game-stats") {
        totalWins
        totalPot
        lastUpdated
      }
    }
  `;

  try {
    const data = await makeGraphQLRequest(query, { limit });
    const result = {
      wins: data?.wins || [],
      gameStats: data?.gameStats || null
    };

    // Cache the results
    winnersCache.set(cacheKey, { data: result as any, timestamp: Date.now() });

    return result;
  } catch (error) {
    console.error('Error fetching public data:', error);
    // Return cached data if available, even if expired
    if (cached) {
      console.log('Returning expired cached public data due to error');
      return cached.data as any;
    }
    return { wins: [], gameStats: null };
  }
}

// Function to clear cache (useful for testing or manual refresh)
export function clearWinnersCache() {
  winnersCache.clear();
  console.log('Winners cache cleared');
}
