# Network Security Documentation

## Overview
The DegenGuessr application includes network security features to prevent users from accidentally switching networks during critical operations like transactions.

## Current Implementation

### 1. Network Detection
- **Primary Network**: Base Mainnet (Chain ID: 8453)
- **Fallback Network**: Base Sepolia (Chain ID: 84532) for testing
- **Detection Method**: `provider.getNetwork()` calls

### 2. Network Switching Prevention
The app prevents network switching during:
- Wallet connection
- Transaction signing
- Contract interactions

### 3. Files with Network Security

#### `app/hooks/useContract.ts`
```typescript
// Network switching prevention during wallet connection
const connectWallet = async () => {
    // ... existing code ...
    
    // Check if user is on the correct network
    const network = await provider.getNetwork();
    if (network.chainId !== 8453n) {
        // Auto-switch to Base Mainnet
        await switchToBaseMainnet();
    }
}
```

#### `app/hooks/useSlotContract.ts`
```typescript
// Similar network checking in slot contract hook
const connectWallet = async () => {
    // ... existing code ...
    
    // Network validation
    const network = await provider.getNetwork();
    if (network.chainId !== 8453n) {
        await switchToBaseMainnet();
    }
}
```

### 4. Network Switching Functions

#### Auto-switch to Base Mainnet
```typescript
const switchToBaseMainnet = async () => {
    try {
        await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }], // 8453 in hex
        });
    } catch (switchError) {
        // Handle switch error
        if (switchError.code === 4902) {
            // Chain not added, add it
            await addBaseMainnet();
        }
    }
};
```

#### Add Base Mainnet if not present
```typescript
const addBaseMainnet = async () => {
    await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
            chainId: '0x2105',
            chainName: 'Base',
            rpcUrls: ['https://mainnet.base.org'],
            nativeCurrency: {
                name: 'Ether',
                symbol: 'ETH',
                decimals: 18,
            },
            blockExplorerUrls: ['https://basescan.org'],
        }],
    });
};
```

## Temporary Removal Instructions

### Step 1: Comment out network checks in useContract.ts
```typescript
// Comment out these lines in connectWallet function:
// const network = await provider.getNetwork();
// if (network.chainId !== 8453n) {
//     await switchToBaseMainnet();
// }
```

### Step 2: Comment out network checks in useSlotContract.ts
```typescript
// Comment out similar network validation code
```

### Step 3: Remove network switching functions
```typescript
// Comment out or remove:
// - switchToBaseMainnet()
// - addBaseMainnet()
// - Any network validation logic
```

## Re-enabling Network Security

### Step 1: Uncomment network checks
- Restore all commented network validation code
- Ensure network switching functions are available

### Step 2: Test network switching
- Verify auto-switch to Base Mainnet works
- Test error handling for unsupported networks

### Step 3: Update network constants if needed
- Verify Chain IDs are correct
- Update RPC URLs if they change

## Testing on Different Networks

### Base Sepolia (Chain ID: 84532)
- Used for testing and development
- Requires separate contract deployments
- Network security should allow this for testing

### Base Mainnet (Chain ID: 8453)
- Production network
- Network security enforces this as primary

## Environment Variables
```bash
# Base Mainnet
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_BASE_RPC_URL_ALT=https://base-rpc.publicnode.com

# Base Sepolia (for testing)
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

## Notes
- Network security is important for production to prevent user confusion
- Temporary removal should only be done for testing purposes
- Always re-enable network security before production deployment
- Consider adding a development mode flag to disable network security during testing
