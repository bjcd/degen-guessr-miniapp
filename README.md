# DEGEN Guess 1-100

A minimalist Farcaster Miniapp for a guessing game using $DEGEN token on Base network. Players guess a number between 1-100, and the winner takes the entire pot!

## 🎯 Game Rules

- **Guess Range**: 1-100
- **Cost per Guess**: 100 $DEGEN
- **Distribution**: 90 $DEGEN → Pot, 10 $DEGEN → Treasury
- **Winning**: Match the random number to win the entire pot
- **Fairness**: Uses Chainlink VRF for provably fair randomness

## 🏗️ Architecture

### Smart Contract
- **Solidity** with OpenZeppelin security patterns
- **Chainlink VRF** for random number generation
- **ERC20Permit** support for gasless approvals
- **ReentrancyGuard**, **Pausable**, **Ownable** for security

### Frontend
- **Next.js 14** with App Router
- **React** with TypeScript
- **Tailwind CSS** for styling
- **Wagmi v2** for Ethereum interactions
- **RainbowKit** for wallet connection
- **Farcaster Frame** support

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Hardhat
- Base network RPC access
- Chainlink VRF subscription

### Installation

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd degen-guessr
npm install
```

2. **Set up environment variables:**
```bash
cp env.example .env
# Edit .env with your configuration
```

3. **Compile contracts:**
```bash
npm run compile
```

4. **Deploy to Base:**
```bash
npm run deploy
```

5. **Start frontend:**
```bash
npm run dev
```

## 📋 Environment Variables

```env
# Private key for deployment
PRIVATE_KEY=your_private_key_here

# Base mainnet RPC URL
BASE_RPC_URL=https://mainnet.base.org

# DEGEN token address on Base
DEGEN_TOKEN=0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed

# Treasury address (where 10 DEGEN from each guess goes)
TREASURY_ADDRESS=your_treasury_address_here

# Chainlink VRF configuration for Base
VRF_COORDINATOR=0x271682DEB8C4E0901D1a1550aD2e64D568E69909
VRF_KEY_HASH=0x8af398995b04c28e9951adb9721ef74c74f93e6a478f39e7e077fbe33a8f4
VRF_SUBSCRIPTION_ID=your_subscription_id_here

# Frontend
NEXT_PUBLIC_CONTRACT_ADDRESS=deployed_contract_address
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_wallet_connect_project_id
```

## 🔧 Smart Contract Details

### Key Functions
- `guess(uint8 number, PermitData permit)` - Submit a guess with ERC20Permit
- `fulfillRandomWords(uint256 requestId, uint256[] randomWords)` - VRF callback
- `getPot()` - Get current pot amount
- `getPlayerWins(address player)` - Get player's total wins

### Security Features
- **ReentrancyGuard**: Prevents reentrancy attacks
- **Pausable**: Emergency pause functionality
- **Ownable**: Admin controls for emergency functions
- **VRF Integration**: Provably fair randomness

## 🎨 Frontend Features

### Components
- **Header**: Branding and network status
- **WalletConnect**: Wallet connection interface
- **GameInterface**: Main game UI with stats and controls

### Features
- Real-time pot updates
- Player win tracking
- Responsive design
- Farcaster Frame integration
- Wallet connection with RainbowKit

## 📱 Farcaster Miniapp Integration

The app includes a `frame.json` manifest for Farcaster Miniapp integration:

```json
{
  "name": "DEGEN Guess 1-100",
  "description": "A fun and fair guessing game using $DEGEN token",
  "icon": "https://your-domain.com/icon.png",
  "url": "https://your-domain.com",
  "permissions": ["wallet", "user"]
}
```

## 🧪 Testing

```bash
# Run tests
npm test

# Test on Base Sepolia
npm run deploy -- --network baseSepolia
```

## 🚀 Deployment

### Smart Contract
1. Set up Chainlink VRF subscription on Base
2. Configure environment variables
3. Deploy: `npm run deploy`

### Frontend
1. Update `NEXT_PUBLIC_CONTRACT_ADDRESS` in environment
2. Deploy to Vercel, Netlify, or your preferred platform
3. Update `frame.json` with your domain

## 🔒 Security Considerations

- **VRF Security**: Uses Chainlink VRF for provably fair randomness
- **Access Control**: Only owner can pause/emergency withdraw
- **Reentrancy Protection**: Guards against reentrancy attacks
- **Input Validation**: Proper range checking for guesses
- **Token Safety**: Emergency withdraw function for stuck tokens

## 📊 Contract Addresses

- **DEGEN Token**: `0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed`
- **VRF Coordinator**: `0x271682DEB8C4E0901D1a1550aD2e64D568E69909`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Create an issue on GitHub
- Join our Discord community
- Follow us on Twitter

---

**Built with ❤️ for the DEGEN community on Base**

