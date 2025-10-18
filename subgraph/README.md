# DegenGuessr Subgraph

This subgraph indexes Win events from the DegenGuessr smart contract on Base Mainnet.

## Setup

1. Install dependencies:
```bash
cd subgraph
npm install
```

2. Generate code:
```bash
npm run codegen
```

3. Build the subgraph:
```bash
npm run build
```

## Deployment

### Option 1: Deploy to The Graph Studio (Recommended)

1. Go to [The Graph Studio](https://thegraph.com/studio/)
2. Create a new subgraph
3. Copy the deployment command from the studio
4. Run: `npm run deploy`

### Option 2: Deploy to Hosted Service

1. Go to [The Graph Hosted Service](https://thegraph.com/hosted-service/)
2. Create a new subgraph
3. Update the subgraph URL in `app/lib/graphql.ts`
4. Run: `npm run deploy`

### Option 3: Deploy to Local Node (Development)

1. Start a local Graph node
2. Run: `npm run create-local`
3. Run: `npm run deploy-local`

## GraphQL Queries

Once deployed, you can query the subgraph:

```graphql
# Get recent winners
query GetRecentWinners {
  wins(
    first: 10
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

# Get game stats
query GetGameStats {
  gameStats(id: "game-stats") {
    totalWins
    totalPot
    lastUpdated
  }
}
```

## Benefits

- ✅ **Reliable**: No RPC query limits or timeouts
- ✅ **Fast**: Pre-indexed data with GraphQL queries
- ✅ **Scalable**: Handles large datasets with pagination
- ✅ **Historical**: All data since contract deployment
- ✅ **Filtered**: Easy to query by player, time range, etc.
