// GraphQL client for The Graph subgraph
const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL || "https://api.thegraph.com/subgraphs/name/your-username/degen-guessr";

export interface Win {
    id: string;
    tx: string;
    block: string;
    timestamp: string;
    player: string;
    guessedNumber: number;
    winningNumber: number;
    amount: string;
}

export interface GameStats {
    totalWins: number;
    totalPot: string;
    lastUpdated: string;
}

export async function getRecentWinners(limit: number = 10): Promise<Win[]> {
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
      }
    }
  `;

    const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query,
            variables: { limit }
        })
    });

    const data = await response.json();
    return data.data?.wins || [];
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

    const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
    });

    const data = await response.json();
    return data.data?.gameStats || null;
}

export async function getWinnersByPlayer(player: string, limit: number = 10): Promise<Win[]> {
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
      }
    }
  `;

    const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query,
            variables: { player, limit }
        })
    });

    const data = await response.json();
    return data.data?.wins || [];
}
