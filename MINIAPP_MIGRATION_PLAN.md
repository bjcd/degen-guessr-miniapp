# 📋 Farcaster MiniApp Migration Plan
## DegenGuessr - Comprehensive Implementation Guide

---

## 🎯 **OBJECTIVE**
Make DegenGuessr fully compatible with Farcaster MiniApps while keeping the web app 100% intact and functional.

---

## ✅ **CURRENT STATE ANALYSIS**

### **Already Implemented:**
1. ✅ **Farcaster SDK Integration**: `@farcaster/miniapp-sdk` installed and imported
2. ✅ **FarcasterProvider**: Context provider with environment detection
3. ✅ **Environment Detection**: Checks for Farcaster context via multiple methods
4. ✅ **frame.json Manifest**: MiniApp metadata file exists
5. ✅ **Basic Authentication**: `signIn/signOut` methods with mock data
6. ✅ **Ethereum Provider**: `getEthereumProvider()` method for wallet access
7. ✅ **Smart Contract**: `DegenGuessr.sol` deployed and functional
8. ✅ **Game Logic**: Fully working with Chainlink VRF v2.5 Plus
9. ✅ **Frontend**: Complete UI with approval flow, guess submission, VRF polling

### **Current Limitations:**
1. ❌ **No Real Wallet Integration**: Not using Farcaster's embedded wallet API
2. ❌ **Mock User Data**: Authentication doesn't fetch real Farcaster user profile
3. ❌ **No Smart Wallet Support**: Not leveraging Farcaster's smart wallet features
4. ❌ **Incomplete frame.json**: Placeholder values for contract address/ABI
5. ❌ **No Frame Actions**: Missing interactive frame buttons/actions
6. ❌ **No Deep Linking**: Can't be launched directly from Farcaster casts
7. ❌ **Manifest Not Served**: `frame.json` not accessible via public route

---

## 🚨 **CRITICAL: SMART CONTRACT COMPATIBILITY**

### **✅ CONTRACT IS 100% COMPATIBLE - NO CHANGES NEEDED**

The `DegenGuessr.sol` contract is **fully compatible** with Farcaster MiniApps because:

1. **Standard ERC20 Integration**: Uses standard `IERC20` interface
   - Works with any EIP-1193 compliant provider (browser wallets OR Farcaster wallet)
   - No custom wallet logic in the contract

2. **Standard Transaction Flow**: 
   - `approve()` → standard ERC20 method
   - `guess()` → standard payable function
   - Works identically whether called from MetaMask or Farcaster wallet

3. **Chainlink VRF Integration**: 
   - VRF v2.5 Plus is network-level (Base), not wallet-specific
   - Contract receives randomness regardless of transaction origin

4. **No Off-Chain Dependencies**:
   - All logic is on-chain
   - No signatures or wallet-specific features required

### **Why No Contract Changes Are Needed:**
```
Web App Flow:              MiniApp Flow:
┌─────────────────┐       ┌─────────────────┐
│ MetaMask Wallet │       │ Farcaster Wallet│
└────────┬────────┘       └────────┬────────┘
         │                         │
         ├─── approve(amount) ─────┤
         │                         │
         ├──── guess(number) ──────┤
         │                         │
         └─────► Same Contract ◄───┘
                 (0x743c74...)
```

**The contract only sees:**
- Transaction sender address (`msg.sender`)
- Transaction data (function call + parameters)
- Transaction value (if payable)

**It doesn't care about:**
- Which wallet sent it
- Whether it came from web or MiniApp
- User's Farcaster profile

---

## 🚀 **DEPLOYMENT STRATEGY**

### **✅ CORRECT APPROACH: Deploy to Base Mainnet NOW**

**Why this is the right approach:**

1. **Single Contract for Both Environments**
   - Same contract address works for web AND MiniApp
   - No need for separate deployments
   - Easier to maintain and verify

2. **Mainnet Advantages**
   - Real $DEGEN token integration
   - Production VRF subscription
   - Real users, real transactions
   - Can test web app immediately

3. **MiniApp Can Connect Later**
   - MiniApp changes are **frontend-only**
   - No contract redeployment needed
   - Update `.env` and you're done

4. **Progressive Rollout**
   - Launch web app first (get users, test game)
   - Add MiniApp support later (expand reach)
   - Both use same contract, same pot, same game

### **Deployment Checklist (Base Mainnet):**

- [ ] Deploy `DegenGuessr.sol` to Base Mainnet via Remix
- [ ] Note deployed contract address
- [ ] Add contract to Chainlink VRF subscription as consumer
- [ ] Fund contract with ETH for VRF gas costs
- [ ] Call `addToPot()` to seed initial pot (optional)
- [ ] Update `NEXT_PUBLIC_CONTRACT_ADDRESS` in `.env.local`
- [ ] Update `NEXT_PUBLIC_DEGEN_TOKEN_ADDRESS` to mainnet DEGEN (`0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed`)
- [ ] Update `CHAINLINK_VRF_COORDINATOR` to Base Mainnet coordinator
- [ ] Update `CHAINLINK_KEY_HASH` for Base Mainnet
- [ ] Update `CHAINLINK_SUBSCRIPTION_ID` to your mainnet subscription
- [ ] Test web app thoroughly before public launch

---

## 📋 **IMPLEMENTATION PHASES**

### **Phase 1: Enhanced Wallet Integration** ✨
**Goal**: Make the app use Farcaster's embedded wallet when in MiniApp context

#### **1.1 Update FarcasterProvider with Real Wallet Support**

**File**: `app/farcaster-provider.tsx`

```typescript
const getEthereumProvider = async () => {
    try {
        if (isFarcasterEnvironment && typeof window !== 'undefined') {
            // Use Farcaster's embedded wallet provider
            const fcProvider = await sdk.wallet.ethProvider;
            if (fcProvider) {
                console.log('Using Farcaster embedded wallet');
                return fcProvider;
            }
        }
        
        // Fallback to browser wallet (MetaMask, etc.)
        if (typeof window !== 'undefined' && (window as any).ethereum) {
            console.log('Using browser wallet');
            return (window as any).ethereum;
        }
        
        throw new Error('No wallet provider found');
    } catch (error) {
        console.error('Failed to get Ethereum provider:', error);
        return null;
    }
};
```

#### **1.2 Update useContract Hook**

**File**: `app/hooks/useContract.ts`

```typescript
// At the top of useContract hook
const { getEthereumProvider, isFarcasterEnvironment } = useFarcaster();

// In useEffect or init function
const initProvider = async () => {
    let ethProvider;
    
    if (isFarcasterEnvironment) {
        // Get Farcaster wallet provider
        ethProvider = await getEthereumProvider();
        console.log('MiniApp mode: Using Farcaster wallet');
    } else {
        // Get browser wallet (MetaMask)
        ethProvider = window.ethereum;
        console.log('Web mode: Using browser wallet');
    }
    
    if (ethProvider) {
        const web3Provider = new ethers.BrowserProvider(ethProvider);
        setProvider(web3Provider);
    }
};
```

**Key Points:**
- ✅ No contract changes needed
- ✅ Same ABI, same contract address
- ✅ Only provider source changes
- ✅ Web app behavior unchanged

---

### **Phase 2: Real User Authentication** 👤
**Goal**: Fetch actual Farcaster user data when in MiniApp

#### **2.1 Implement Real Authentication**

**File**: `app/farcaster-provider.tsx`

```typescript
const signIn = async () => {
    try {
        if (isFarcasterEnvironment) {
            // Get real Farcaster auth token
            const { token } = await sdk.auth.signIn();
            
            // Fetch user context
            const context = await sdk.context;
            const userProfile = context.user;
            
            setUser({
                fid: userProfile.fid,
                username: userProfile.username || 'Unknown',
                displayName: userProfile.displayName || 'Farcaster User',
                pfpUrl: userProfile.pfpUrl || 'https://via.placeholder.com/150'
            });
            
            console.log('Authenticated Farcaster user:', userProfile);
        } else {
            // Mock for web app (no change to existing behavior)
            setUser({
                fid: 0,
                username: 'webuser',
                displayName: 'Web User',
                pfpUrl: 'https://via.placeholder.com/150'
            });
        }
    } catch (error) {
        console.error('Sign in failed:', error);
    }
};
```

#### **2.2 Optional: Display User Info in UI**

**File**: `app/page.tsx`

```typescript
// Add to component
const { user, isFarcasterEnvironment } = useFarcaster();

// Optionally display in header or profile section
{isFarcasterEnvironment && user && (
    <div className="farcaster-user-badge">
        <img src={user.pfpUrl} alt={user.username} className="w-8 h-8 rounded-full" />
        <span>@{user.username}</span>
    </div>
)}
```

---

### **Phase 3: Frame Manifest & Metadata** 📄
**Goal**: Make the app discoverable and launchable from Farcaster

#### **3.1 Complete frame.json**

**File**: `frame.json` (update with real values)

```json
{
    "name": "DEGEN Guess 1-100",
    "description": "A fun and fair guessing game using $DEGEN token on Base network. Guess a number between 1-100 and win the entire pot!",
    "icon": "https://your-domain.com/icon.png",
    "url": "https://your-domain.com",
    "permissions": [
        "wallet",
        "user"
    ],
    "version": "1.0.0",
    "author": "DegenGuessr Team",
    "category": "games",
    "tags": ["game", "degen", "base", "vrf", "guessing"],
    "contracts": {
        "base": {
            "address": "0x743c74D3b77e3576d39aa00c5435D1931E0DAAD7",
            "chainId": 8453
        }
    },
    "tokens": {
        "degen": {
            "address": "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
            "symbol": "DEGEN",
            "decimals": 18
        }
    },
    "networks": ["base"],
    "features": [
        "wallet_connect",
        "token_transfer",
        "random_number_generation"
    ]
}
```

#### **3.2 Serve Manifest Publicly**

**Option A: Copy to public directory**
```bash
cp frame.json public/frame.json
```

**Option B: Create API route**

**File**: `app/api/manifest/route.ts`
```typescript
import { NextResponse } from 'next/server';
import frameManifest from '@/frame.json';

export async function GET() {
    return NextResponse.json(frameManifest);
}
```

#### **3.3 Add Well-Known Discovery Endpoint**

**File**: `public/.well-known/farcaster.json`
```json
{
    "manifestUrl": "https://your-domain.com/frame.json",
    "version": "1.0.0"
}
```

#### **3.4 Update Next.js Metadata**

**File**: `app/layout.tsx`

```typescript
export const metadata: Metadata = {
    title: "DEGEN Guess 1-100",
    description: "Win the pot by guessing the right number!",
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
    openGraph: {
        title: "DEGEN Guess 1-100",
        description: "A fair guessing game on Base using $DEGEN",
        images: ['/og-image.png'],
    },
    // Farcaster Frame metadata
    other: {
        'fc:frame': 'vNext',
        'fc:frame:image': `${process.env.NEXT_PUBLIC_APP_URL}/og-image.png`,
        'fc:frame:button:1': 'Play Game',
        'fc:frame:button:1:action': 'link',
        'fc:frame:button:1:target': process.env.NEXT_PUBLIC_APP_URL || '',
    }
};
```

---

### **Phase 4: Frame Actions & Interactions** 🎮
**Goal**: Enable interactive features from Farcaster casts

#### **4.1 Create Frame Action Endpoint**

**File**: `app/api/frame/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const DEGEN_ADDRESS = process.env.NEXT_PUBLIC_DEGEN_TOKEN_ADDRESS;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        
        // Farcaster frame action payload
        const { untrustedData } = body;
        const buttonIndex = untrustedData?.buttonIndex;
        
        // Initialize provider (read-only)
        const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
        const contract = new ethers.Contract(
            CONTRACT_ADDRESS!,
            ['function pot() view returns (uint256)'],
            provider
        );
        
        // Fetch current pot
        const pot = await contract.pot();
        const potFormatted = ethers.formatUnits(pot, 18);
        
        // Generate response based on button clicked
        let imageUrl = '';
        let buttons = [];
        
        if (buttonIndex === 1) {
            // "Play Game" button
            return NextResponse.json({
                type: 'frame',
                frameUrl: process.env.NEXT_PUBLIC_APP_URL,
            });
        }
        
        // Default: Show pot value
        imageUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/frame/image?pot=${potFormatted}`;
        buttons = [
            {
                label: 'Play Game',
                action: 'link',
                target: process.env.NEXT_PUBLIC_APP_URL,
            },
        ];
        
        return NextResponse.json({
            image: imageUrl,
            buttons,
        });
    } catch (error) {
        console.error('Frame action error:', error);
        return NextResponse.json({ error: 'Failed to process frame action' }, { status: 500 });
    }
}

export async function GET() {
    // Return initial frame
    const imageUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/frame/image`;
    
    return NextResponse.json({
        image: imageUrl,
        buttons: [
            {
                label: 'Play Game',
                action: 'link',
                target: process.env.NEXT_PUBLIC_APP_URL,
            },
        ],
    });
}
```

#### **4.2 Create Dynamic Frame Image Generator**

**File**: `app/api/frame/image/route.tsx`

```typescript
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const pot = searchParams.get('pot') || '0';
    
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#1a1a2e',
                    color: '#00ff00',
                    fontSize: 60,
                    fontWeight: 'bold',
                }}
            >
                <div style={{ fontSize: 80 }}>🎯 DEGEN GUESS</div>
                <div style={{ fontSize: 40, marginTop: 20 }}>Current Pot</div>
                <div style={{ fontSize: 100, color: '#ffd700', marginTop: 10 }}>
                    {pot} DEGEN
                </div>
                <div style={{ fontSize: 30, marginTop: 20, color: '#888' }}>
                    Guess 1-100 to win!
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
        }
    );
}
```

---

### **Phase 5: Smart Wallet Features** 💰
**Goal**: Leverage Farcaster's built-in wallet capabilities

#### **5.1 Implement Farcaster Transactions**

**File**: `app/hooks/useContract.ts`

```typescript
// Add to makeGuess function
const makeGuess = async (number: number) => {
    try {
        if (isFarcasterEnvironment) {
            // Use Farcaster wallet SDK
            const txHash = await sdk.wallet.sendTransaction({
                to: CONTRACT_ADDRESS,
                data: contract.interface.encodeFunctionData('guess', [number]),
                value: '0x0',
            });
            
            // Watch transaction status
            const receipt = await sdk.wallet.waitForTransaction(txHash);
            console.log('Transaction confirmed:', receipt);
        } else {
            // Standard web3 transaction (existing code)
            const tx = await contract.guess(number);
            await tx.wait();
        }
    } catch (error) {
        console.error('Error making guess:', error);
    }
};
```

---

### **Phase 6: Environment-Specific UI Adjustments** 🎨
**Goal**: Optimize UI/UX for MiniApp vs Web

#### **6.1 Conditional Layout Rendering**

**File**: `app/page.tsx`

```typescript
const { isFarcasterEnvironment } = useFarcaster();

// Conditionally adjust layout
<div className={`
    container 
    ${isFarcasterEnvironment ? 'miniapp-layout' : 'web-layout'}
`}>
```

**File**: `app/globals.css`

```css
/* MiniApp-specific styles */
.miniapp-layout {
    max-width: 100vw;
    padding: 0.5rem;
}

.miniapp-layout .header {
    display: none; /* Hide large branding in MiniApp */
}

/* Web-specific styles */
.web-layout {
    max-width: 1200px;
    margin: 0 auto;
}
```

---

### **Phase 7: Deep Linking & Sharing** 🔗
**Goal**: Enable sharing and launching from Farcaster

#### **7.1 Add Share Functionality**

**File**: `app/page.tsx`

```typescript
const handleShare = async () => {
    if (isFarcasterEnvironment) {
        // Share via Farcaster
        const shareText = `🎯 Current pot: ${pot} DEGEN! Can you guess the number? Play now!`;
        await sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(window.location.href)}`);
    } else {
        // Web share API
        if (navigator.share) {
            await navigator.share({
                title: 'DEGEN Guess 1-100',
                text: `Current pot: ${pot} DEGEN!`,
                url: window.location.href,
            });
        }
    }
};

// Add button to UI
<button onClick={handleShare} className="share-button">
    📤 Share Game
</button>
```

#### **7.2 Handle Launch Parameters**

**File**: `app/farcaster-provider.tsx`

```typescript
useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refFid = urlParams.get('ref');
    
    if (refFid && isFarcasterEnvironment) {
        console.log('Launched via referral from FID:', refFid);
        // Track referral (optional)
    }
}, [isFarcasterEnvironment]);
```

---

## 🧪 **TESTING & VALIDATION**

### **Test Matrix**
```
┌─────────────────────┬──────────────┬──────────────┐
│ Feature             │ Web          │ MiniApp      │
├─────────────────────┼──────────────┼──────────────┤
│ Wallet Connect      │ MetaMask     │ FC Wallet    │
│ Authentication      │ None/Mock    │ Real FC Auth │
│ Contract Interaction│ Web3         │ FC Web3      │
│ UI Layout           │ Full Desktop │ Mobile Opt   │
│ Game Logic          │ ✅ Same      │ ✅ Same      │
│ VRF Polling         │ ✅ Same      │ ✅ Same      │
│ Approval Flow       │ ✅ Same      │ ✅ Same      │
│ Contract Address    │ ✅ Same      │ ✅ Same      │
└─────────────────────┴──────────────┴──────────────┘
```

### **Testing Checklist:**
- [ ] Deploy contract to Base Mainnet
- [ ] Test web app with MetaMask
- [ ] Test approval flow on web
- [ ] Test guess submission on web
- [ ] Test VRF result polling on web
- [ ] Verify pot updates correctly
- [ ] Implement MiniApp wallet integration
- [ ] Test in Warpcast mobile app
- [ ] Test Farcaster wallet connection
- [ ] Test approval in MiniApp
- [ ] Test guess in MiniApp
- [ ] Test VRF polling in MiniApp
- [ ] Verify both environments use same contract
- [ ] Test frame display in Farcaster cast
- [ ] Test frame buttons
- [ ] Test MiniApp launch from frame

---

## 📦 **DELIVERABLES**

### **Code Changes:**
1. ✅ Enhanced `FarcasterProvider` with real wallet integration
2. ✅ Updated `useContract` hook with environment-aware provider
3. ✅ Completed `frame.json` with real values
4. ✅ Public manifest route at `/.well-known/farcaster.json`
5. ✅ Enhanced metadata in `app/layout.tsx`
6. ✅ Frame action endpoints in `/api/frame`
7. ✅ Conditional UI rendering in `app/page.tsx`

### **New Files:**
1. `public/frame.json` - Public manifest
2. `public/.well-known/farcaster.json` - Discovery endpoint
3. `app/api/frame/route.ts` - Frame action handler
4. `app/api/frame/image/route.tsx` - Dynamic OG images
5. `public/icon.png` - MiniApp icon (512x512)
6. `public/og-image.png` - Open Graph preview image

### **Environment Variables to Add:**
```env
# MiniApp Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.com
BASE_RPC_URL=https://mainnet.base.org

# Already have these (just verify):
NEXT_PUBLIC_CONTRACT_ADDRESS=0xAe5f686AaA1E9A4caFbBfBE6DAC57377b2064eBb
NEXT_PUBLIC_DEGEN_TOKEN_ADDRESS=0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed
NEXT_PUBLIC_TREASURY_ADDRESS=<your-treasury-address>
CHAINLINK_VRF_COORDINATOR=<base-mainnet-coordinator>
CHAINLINK_KEY_HASH=<base-mainnet-key-hash>
CHAINLINK_SUBSCRIPTION_ID=<your-subscription-id>
```

---

## 🚨 **CRITICAL: ZERO BREAKING CHANGES**

### **Contract: NO CHANGES NEEDED ✅**
- Same contract works for both web and MiniApp
- Deploy once to Base Mainnet
- Both environments interact with same address
- No redeployment required for MiniApp support

### **Web App: 100% Preserved ✅**
- All existing functionality intact
- No changes to core game logic
- Provider selection is conditional (doesn't affect web)
- All current features work as-is

### **Strategy: Progressive Enhancement**
```javascript
// Pattern used throughout:
if (isFarcasterEnvironment) {
    // Use Farcaster-specific features
} else {
    // Use existing web app behavior (UNCHANGED)
}
```

---

## 🎯 **SUCCESS CRITERIA**

### **Web App (Must Remain Working):**
- ✅ Wallet connects via MetaMask/browser wallet
- ✅ Approve & Guess buttons work
- ✅ VRF result polling works
- ✅ Winners display correctly
- ✅ All UI elements render properly
- ✅ No regressions or bugs introduced

### **MiniApp (New Functionality):**
- ✅ Launches from Farcaster cast
- ✅ Wallet connects via Farcaster embedded wallet
- ✅ User authenticated with real FC profile
- ✅ All game features work identically to web
- ✅ Frame displays correctly in casts
- ✅ Can be shared back to Farcaster
- ✅ Uses **same contract** as web app

---

## 📅 **RECOMMENDED IMPLEMENTATION ORDER**

1. **✅ Deploy Contract to Base Mainnet** (DO THIS FIRST)
   - Deploy `DegenGuessr.sol` via Remix
   - Add to VRF subscription
   - Test web app thoroughly
   
2. **Phase 3** - Manifest & Metadata (Quick win)
   - Update `frame.json` with real contract address
   - Set up public routes
   - Add metadata to `layout.tsx`

3. **Phase 1** - Wallet Integration (Core functionality)
   - Update `FarcasterProvider`
   - Modify `useContract` hook

4. **Phase 2** - Authentication (User experience)
   - Implement real Farcaster auth
   - Display user profile

5. **Phase 4** - Frame Actions (Discoverability)
   - Create `/api/frame` endpoints
   - Generate dynamic images

6. **Phase 6** - UI Polish (User experience)
   - Conditional styling
   - Mobile optimization

7. **Phase 7** - Sharing (Growth)
   - Share buttons
   - Deep linking

8. **Phase 5** - Advanced Features (Optional)
   - Farcaster-specific transaction methods
   - Gas optimizations

9. **Phase 8** - Testing (Validation)
   - Comprehensive testing in both environments
   - Bug fixes and refinements

---

## 💡 **KEY INSIGHTS**

1. **Contract is Environment-Agnostic**: The smart contract doesn't know or care whether transactions come from web or MiniApp. It just processes valid transactions.

2. **Frontend is the Integration Layer**: All MiniApp-specific code lives in the frontend (provider selection, authentication, UI adjustments).

3. **Progressive Enhancement**: MiniApp features are additive. Web app continues working exactly as before.

4. **Single Source of Truth**: One contract, one pot, one game state shared across all environments.

5. **Deploy Smart, Iterate Fast**: Deploy contract once, iterate on frontend integrations without redeployment.

---

## 🔧 **TROUBLESHOOTING**

### **Common Issues:**

1. **"Wallet not connecting in MiniApp"**
   - Check `sdk.wallet.ethProvider` is properly initialized
   - Verify permissions in `frame.json` include `"wallet"`
   - Ensure `isFarcasterEnvironment` detection is working

2. **"Contract calls failing in MiniApp"**
   - Verify same ABI is used in both environments
   - Check provider is correctly set before contract interaction
   - Ensure contract address in env matches deployed address

3. **"Frame not displaying in Farcaster"**
   - Verify `frame.json` is accessible at public URL
   - Check Open Graph metadata in `layout.tsx`
   - Ensure image URLs are absolute (not relative)

4. **"Web app broke after MiniApp changes"**
   - Review all conditional logic: `if (isFarcasterEnvironment) {...} else {...}`
   - Ensure fallback to browser wallet is working
   - Test with `isFarcasterEnvironment = false` explicitly

---

## 📚 **REFERENCE LINKS**

- [Farcaster MiniApps SDK Documentation](https://miniapps.farcaster.xyz/)
- [Farcaster Frames Specification](https://docs.farcaster.xyz/learn/what-is-farcaster/frames)
- [Base Network Documentation](https://docs.base.org/)
- [Chainlink VRF v2.5 Plus](https://docs.chain.link/vrf)
- [Ethers.js Documentation](https://docs.ethers.org/)

---

## ✅ **FINAL CHECKLIST BEFORE GOING LIVE**

### **Contract Deployment:**
- [ ] Contract deployed to Base Mainnet
- [ ] Contract address recorded
- [ ] Added to Chainlink VRF subscription
- [ ] Contract funded with ETH for gas
- [ ] Test transactions successful

### **Web App:**
- [ ] `.env.local` updated with mainnet contract address
- [ ] `.env.local` updated with mainnet DEGEN address
- [ ] Approval flow tested
- [ ] Guess submission tested
- [ ] VRF polling tested
- [ ] Winners display tested

### **MiniApp (When Ready):**
- [ ] `frame.json` updated and accessible
- [ ] Farcaster wallet integration tested
- [ ] Frame displays correctly in casts
- [ ] Can launch from Farcaster
- [ ] All features work in MiniApp environment

---

**Last Updated**: October 17, 2025  
**Version**: 1.0  
**Status**: Ready for Implementation

