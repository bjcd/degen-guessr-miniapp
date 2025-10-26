/**
 * GraphQL client for DegenSlot subgraph
 */

const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SLOT_SUBGRAPH_URL || 'https://api.studio.thegraph.com/query/1685627/degen-slot/v0.0.1';

interface SpinResult {
    id: string;
    tx: string;
    block: string;
    timestamp: string;
    player: string;
    roll: string;
    category: string;
    payout: string;
    potAfter: string;
}

interface SlotPlayerStats {
    id: string;
    address: string;
    totalSpins: number;
    totalWinnings: string;
    lastUpdated: string;
}

interface SlotGameStats {
    id: string;
    totalSpins: number;
    totalPot: string;
    lastUpdated: string;
}

async function makeGraphQLRequest(query: string, variables: any = {}) {
    try {
        const response = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                variables,
            }),
        });

        if (!response.ok) {
            console.error('GraphQL request failed:', response.statusText);
            throw new Error(`GraphQL request failed: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.errors) {
            console.error('GraphQL errors:', data.errors);
            throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
        }

        return data.data;
    } catch (error) {
        console.error('Error making GraphQL request:', error);
        throw error;
    }
}

export async function getRecentSlotWinners(limit: number = 20): Promise<SpinResult[]> {
    const query = `
        query GetRecentSlotWinners($limit: Int!) {
            spinResults(
                first: $limit
                orderBy: timestamp
                orderDirection: desc
                where: { payout_gt: "0" }
            ) {
                id
                tx
                block
                timestamp
                player
                roll
                category
                payout
                potAfter
            }
        }
    `;

    try {
        const data = await makeGraphQLRequest(query, { limit });
        return data?.spinResults || [];
    } catch (error) {
        console.error('Error fetching recent slot winners:', error);
        return [];
    }
}

export async function getSlotPlayerStats(playerAddress: string): Promise<SlotPlayerStats | null> {
    const query = `
        query GetSlotPlayerStats($playerId: String!) {
            slotPlayerStats(id: $playerId) {
                id
                address
                totalSpins
                totalWinnings
                lastUpdated
            }
        }
    `;

    try {
        const data = await makeGraphQLRequest(query, { playerId: playerAddress.toLowerCase() });
        return data?.slotPlayerStats || null;
    } catch (error) {
        console.error('Error fetching slot player stats:', error);
        return null;
    }
}

export async function getSlotGameStats(): Promise<SlotGameStats | null> {
    const query = `
        query GetSlotGameStats {
            slotGameStats(id: "slot-game-stats") {
                totalSpins
                totalPot
                lastUpdated
            }
        }
    `;

    try {
        const data = await makeGraphQLRequest(query);
        return data?.slotGameStats || null;
    } catch (error) {
        console.error('Error fetching slot game stats:', error);
        return null;
    }
}

export type { SpinResult, SlotPlayerStats, SlotGameStats };

