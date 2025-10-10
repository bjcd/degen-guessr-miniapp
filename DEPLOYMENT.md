# Deployment Guide

## Smart Contract Deployment

### 1. Prerequisites
- Node.js 18+
- Hardhat installed globally: `npm install -g hardhat`
- Base network RPC access
- Chainlink VRF subscription on Base

### 2. Set up Chainlink VRF
1. Go to [Chainlink VRF](https://vrf.chain.link/)
2. Create a subscription on Base network
3. Fund the subscription with LINK tokens
4. Note down your subscription ID

### 3. Configure Environment
```bash
cp env.example .env
# Edit .env with your values
```

### 4. Deploy Contract
```bash
# Compile contracts
npm run compile

# Deploy to Base mainnet
npm run deploy

# Or deploy to Base Sepolia for testing
npm run deploy -- --network baseSepolia
```

### 5. Verify Contract (Optional)
```bash
# Set VERIFY_CONTRACT=true in .env
VERIFY_CONTRACT=true npm run deploy
```

## Frontend Deployment

### 1. Update Environment Variables
```bash
# Set the deployed contract address
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...

# Set WalletConnect project ID
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id
```

### 2. Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### 3. Update Frame Manifest
Update `frame.json` with your deployed domain:
```json
{
  "icon": "https://your-domain.vercel.app/icon.png",
  "url": "https://your-domain.vercel.app"
}
```

## Testing

### 1. Local Testing
```bash
# Start local blockchain
npx hardhat node

# Run tests
npm test
```

### 2. Testnet Testing
```bash
# Deploy to Base Sepolia
npm run deploy -- --network baseSepolia

# Test the frontend with testnet contract
```

## Security Checklist

- [ ] Contract verified on BaseScan
- [ ] VRF subscription properly funded
- [ ] Treasury address set correctly
- [ ] Emergency functions tested
- [ ] Frontend domain configured
- [ ] Frame manifest updated

## Monitoring

### Contract Events
Monitor these events for game activity:
- `GuessSubmitted`: New guess submitted
- `Win`: Player won the pot
- `Miss`: Player missed the guess
- `PotUpdated`: Pot amount changed

### Key Metrics
- Total guesses made
- Pot size over time
- Win rate
- Gas usage per transaction

## Troubleshooting

### Common Issues

1. **VRF Request Fails**
   - Check subscription funding
   - Verify coordinator address
   - Check gas limits

2. **Frontend Connection Issues**
   - Verify contract address
   - Check network configuration
   - Ensure wallet is connected to Base

3. **Permit Issues**
   - Check token approval
   - Verify signature generation
   - Check deadline validity

### Support
- Check contract on [BaseScan](https://basescan.org/)
- Monitor VRF requests on [Chainlink VRF Explorer](https://vrf.chain.link/)
- Review transaction logs for errors

