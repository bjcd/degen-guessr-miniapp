# DegenGuessr & DegenSlot Subgraph

This subgraph indexes events from multiple contracts on Base Mainnet:
- **DegenGuessr**: Win events from the guess game contract
- **DegenGuessr1000**: Win events from the super degen mode
- **DegenSlot**: SpinResult events from the slot machine game

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

This monorepo subgraph handles multiple contracts. However, for production, you may want to deploy separate subgraphs.

### Separate Deployment for DegenGuessr and DegenSlot

For clearer separation and independent deployment:

1. **DegenGuessr Subgraph** (existing):
   - Already deployed to Subgraph Studio
   - URL: Check your Subgraph Studio dashboard
   - Environment variable: `NEXT_PUBLIC_SUBGRAPH_URL`

2. **DegenSlot Subgraph** (new):
   - Authentication token: `c3fa04d31316518e6e7070e990c02c22`
   - Deploy commands (run from subgraph directory):
   ```bash
   # Authenticate
   graph auth c3fa04d31316518e6e7070e990c02c22
   
   # Navigate to project
   cd ..
   
   # Build and deploy
   cd subgraph
   graph codegen && graph build
   graph deploy degen-slot
   ```
   - Environment variable: `NEXT_PUBLIC_SLOT_SUBGRAPH_URL`

### Option 1: Deploy to The Graph Studio (Recommended)

1. Go to [The Graph Studio](https://thegraph.com/studio/)
2. Create a new subgraph for each game
3. Copy the deployment command from the studio
4. Run: `graph deploy <subgraph-name>`

### Option 2: Deploy Monorepo Subgraph

To deploy this monorepo subgraph (all contracts together):

1. Authenticate: `graph auth --studio <token>`
2. Build: `graph codegen && graph build`
3. Deploy: `graph deploy --studio degen-guessr`

### Option 3: Deploy to Local Node (Development)

1. Start a local Graph node
2. Run: `npm run create-local`
3. Run: `npm run deploy-local`

## GraphQL Queries

Once deployed, you can query the subgraph:

```graphql
# Get recent DegenGuessr winners
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

# Get DegenGuessr game stats
query GetGameStats {
  gameStats(id: "game-stats") {
    totalWins
    totalPot
    lastUpdated
  }
}

# Get recent DegenSlot winners (last 20)
query GetRecentSlotWinners {
  spinResults(
    first: 20
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

# Get DegenSlot player stats
query GetSlotPlayerStats($player: String!) {
  slotPlayerStats(id: $player) {
    id
    address
    totalSpins
    totalWinnings
    lastUpdated
  }
}

# Get DegenSlot game stats
query GetSlotGameStats {
  slotGameStats(id: "slot-game-stats") {
    totalSpins
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
