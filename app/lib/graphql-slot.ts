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
    contractAddress?: string;
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
        console.log('📊 GraphQL Request:', { url: SUBGRAPH_URL, variables });
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
        console.log('📊 GraphQL Response:', data);

        if (data.errors) {
            console.error('GraphQL errors:', data.errors);
            throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
        }

        return data.data;
    } catch (error) {
        console.error('❌ Error making GraphQL request:', error);
        throw error;
    }
}

export async function getRecentSlotWinners(limit: number = 1000, skip: number = 0, contractAddress?: string): Promise<SpinResult[]> {
    // Build where clause - include contract address if provided
    let whereClause = 'payout_gt: "0"';
    if (contractAddress) {
        whereClause += `, contractAddress: "${contractAddress.toLowerCase()}"`;
    }

    const query = `
        query GetRecentSlotWinners($limit: Int!, $skip: Int!) {
            spinResults(
                first: $limit
                skip: $skip
                orderBy: timestamp
                orderDirection: desc
                where: { ${whereClause} }
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
                contractAddress
            }
        }
    `;

    try {
        const data = await makeGraphQLRequest(query, { limit, skip });
        let winners = data?.spinResults || [];
        
        // If subgraph doesn't support filtering, filter client-side
        if (contractAddress && winners.length > 0) {
            winners = winners.filter((winner: SpinResult) => 
                (winner as any).contractAddress?.toLowerCase() === contractAddress.toLowerCase()
            );
        }
        
        console.log('🏆 Recent winners from subgraph:', winners.length, 'winners');
        return winners;
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
        const stats = data?.slotPlayerStats;
        console.log('📊 Player stats for', playerAddress, ':', stats);
        return stats || null;
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
        const stats = data?.slotGameStats;
        console.log('🎮 Game stats:', stats);
        return stats || null;
    } catch (error) {
        console.error('Error fetching slot game stats:', error);
        return null;
    }
}

export async function getPlayerAllSpins(playerAddress: string): Promise<SpinResult[]> {
    const query = `
        query GetPlayerAllSpins($playerAddress: String!) {
            spinResults(
                first: 1000
                orderBy: timestamp
                orderDirection: desc
                where: { player: $playerAddress }
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
        const data = await makeGraphQLRequest(query, { playerAddress: playerAddress.toLowerCase() });
        const spins = data?.spinResults || [];
        console.log('🎰 All spins for player', playerAddress, ':', spins.length, 'spins');
        return spins;
    } catch (error) {
        console.error('Error fetching player all spins:', error);
        return [];
    }
}

export type { SpinResult, SlotPlayerStats, SlotGameStats };

