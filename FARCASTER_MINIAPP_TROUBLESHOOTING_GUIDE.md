# Farcaster MiniApp Troubleshooting Guide

A comprehensive guide for solving common Farcaster miniapp issues, based on real-world experience with production deployments.

---

## Table of Contents

1. [Mobile Compatibility Issues](#mobile-compatibility-issues)
2. [Miniapp Embeds Not Working](#miniapp-embeds-not-working)
3. [Farcaster Context & Authentication](#farcaster-context--authentication)
4. [Wallet & Payment Integration](#wallet--payment-integration)
5. [Sharing & Embeds](#sharing--embeds)
6. [Quick Reference Checklist](#quick-reference-checklist)

---

## Mobile Compatibility Issues

### Problem: Miniapp doesn't load or render correctly on Farcaster mobile

#### Root Causes & Solutions

**1. Splash Screen Never Dismisses**

**Symptom**: App stays on splash screen, never shows content.

**Root Cause**: `sdk.actions.ready()` not called or called incorrectly.

**Solution**:
```typescript
// Always call ready() in your provider initialization
useEffect(() => {
    const initFarcaster = async () => {
        // Must call this FIRST, before any other SDK calls
        try {
            await sdk.actions.ready();
            console.log('✅ Farcaster SDK ready - splash screen hidden');
        } catch (sdkError) {
            console.warn('⚠️ Farcaster SDK not available:', sdkError);
            // Don't block - continue anyway for web fallback
        }
        
        // NOW set your app as ready
        setIsReady(true);
    };
    initFarcaster();
}, []);
```

**Critical Rules**:
- Call `sdk.actions.ready()` in the root provider, not in child components
- Call it BEFORE setting any "ready" state
- Wrap in try-catch but don't throw - allow web fallback
- Set ready state AFTER calling `ready()`, not before

**2. Environment Detection Fails**

**Symptom**: App thinks it's in web mode when it's actually in Farcaster.

**Root Cause**: Relying on single detection method.

**Solution - Use Multi-Layer Detection**:
```typescript
let isInFarcaster = false;

// Layer 1: Official SDK method (most reliable)
try {
    isInFarcaster = await sdk.isInMiniApp();
    console.log('📱 SDK isInMiniApp result:', isInFarcaster);
} catch (error) {
    console.warn('⚠️ Error checking isInMiniApp:', error);
    // Layer 2: Fallback detection
    isInFarcaster = typeof window !== 'undefined' &&
        (window.location !== window.parent.location ||
            window.navigator.userAgent.includes('Farcaster') ||
            window.location.search.includes('farcaster') ||
            document.referrer.includes('farcaster') ||
            (window as any).farcaster);
}
```

**Why This Works**:
- SDK method is authoritative but can fail
- Fallback methods catch edge cases
- Never assume single detection method is sufficient

**3. Wallet Provider Not Available**

**Symptom**: "No wallet available" errors on mobile.

**Root Cause**: Timing issues - wallet not ready when accessed.

**Solution**:
```typescript
const getEthereumProvider = async () => {
    // Strategy 1: In Farcaster environment
    if (isFarcasterEnvironment && typeof window !== 'undefined') {
        // CRITICAL: Wait for SDK to be ready
        if (!isReady || !sdk?.wallet) {
            console.log('SDK not ready yet, waiting...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (!sdk?.wallet) {
                console.warn('SDK still not ready after waiting');
                return null;
            }
        }

        // Check capabilities FIRST
        const capabilities = await sdk.getCapabilities();
        if (!capabilities.includes('wallet.getEthereumProvider')) {
            console.warn('⚠ Wallet capability not available');
            return null;
        }

        // NOW get the provider
        const fcProvider = await sdk.wallet.getEthereumProvider();
        if (fcProvider) {
            return fcProvider;
        }
        
        // Fallback for desktop Farcaster with extensions
        if ((window as any).ethereum) {
            return (window as any).ethereum;
        }
        
        throw new Error('No wallet available. Please grant wallet access in Farcaster settings.');
    }
    
    // Strategy 2: Regular browser
    // ... browser wallet logic
};
```

**Key Points**:
- Always check `isReady` before accessing wallet
- Check capabilities before using wallet methods
- Wait with timeout if SDK not ready
- Provide clear error messages to users

**4. Viewport & Layout Issues on Mobile**

**Symptom**: UI cut off, scrolling issues, or elements not visible.

**Solution**: 
- Use responsive design with mobile-first approach
- Test with actual Farcaster mobile app, not just browser
- Use safe area insets for iOS
- Avoid fixed heights that exceed viewport
- Test with different screen sizes

---

## Miniapp Embeds Not Working

### Problem: Miniapp button doesn't appear in Farcaster or embed fails to load

#### Root Causes & Solutions

**1. Manifest File Missing or Incorrect**

**Symptom**: Miniapp doesn't show in Farcaster discovery or can't be added.

**Required Files**:
1. `public/.well-known/farcaster.json` - Must be accessible at `https://yourdomain.com/.well-known/farcaster.json`
2. Meta tag in HTML head - Alternative/backup method

**Solution - Manifest File**:
```json
{
    "accountAssociation": {
        "header": "eyJ...",
        "payload": "eyJ...",
        "signature": "..."
    },
    "miniapp": {
        "name": "Your App Name",
        "version": "1",
        "iconUrl": "https://yourdomain.com/icon.png",
        "homeUrl": "https://yourdomain.com",
        "imageUrl": "https://yourdomain.com/miniapp-icon-large.png",
        "buttonTitle": "PLAY NOW",
        "splashImageUrl": "https://yourdomain.com/icon.png",
        "splashBackgroundColor": "#d26cf8",
        "subtitle": "Your subtitle",
        "description": "Your description",
        "primaryCategory": "games",
        "screenshotUrls": [
            "https://yourdomain.com/screenshot.png"
        ],
        "requiredCapabilities": [
            "wallet.getEthereumProvider",
            "actions.addMiniApp",
            "actions.composeCast"
        ]
    }
}
```

**Solution - Meta Tag (Next.js)**:
```typescript
// app/layout.tsx
export const metadata: Metadata = {
    // ... other metadata
    other: {
        'fc:miniapp': JSON.stringify({
            version: "1",
            imageUrl: "https://yourdomain.com/miniapp-icon-large.png",
            button: {
                title: "PLAY NOW",
                action: {
                    type: "launch_frame",
                    name: "Your App Name",
                    url: "https://yourdomain.com",
                    splashImageUrl: "https://yourdomain.com/icon.png",
                    splashBackgroundColor: "#d26cf8"
                }
            }
        }),
    },
};
```

**Critical Rules**:
- Images must be HTTPS and publicly accessible
- Icon should be square, at least 512x512px
- Manifest must be valid JSON
- Account association must be properly signed
- Test manifest URL is accessible: `curl https://yourdomain.com/.well-known/farcaster.json`

**2. Image URLs Not Accessible**

**Symptom**: Miniapp shows but images are broken or missing.

**Solution**:
- Use absolute HTTPS URLs (never relative)
- Host images on CDN or your domain (not IP addresses)
- Ensure images are publicly accessible (no auth required)
- Test image URLs directly in browser
- Use proper image formats (PNG, JPG - avoid SVGs for icons)
- Recommended sizes:
  - Icon: 512x512px minimum
  - Screenshot: 1200x630px for OG images
  - Hero image: 1024x512px

**3. Account Association Issues**

**Symptom**: Miniapp added but doesn't associate with user account.

**Solution**:
- Account association signature must be valid
- Domain must match exactly (including www vs non-www)
- Signature must be generated using Farcaster's signing process
- Test with Farcaster's account association validator
- Ensure header, payload, and signature are all correct

**4. Capabilities Not Declared**

**Symptom**: Features don't work even though code is correct.

**Solution**:
- List ALL capabilities you need in `requiredCapabilities`
- Common capabilities:
  - `wallet.getEthereumProvider` - For wallet access
  - `actions.addMiniApp` - For adding miniapp to user's list
  - `actions.composeCast` - For sharing posts
  - `actions.openUrl` - For opening external URLs
  - `quickAuth.getToken` - For authentication
- If capability not listed, SDK will not grant access

---

## Farcaster Context & Authentication

### Problem: User authentication fails or context is unavailable

#### Root Causes & Solutions

**1. SDK Context Not Available**

**Symptom**: `sdk.context` is null or undefined.

**Solution**:
```typescript
const signIn = async () => {
    try {
        if (isFarcasterEnvironment) {
            // Get auth token first (required for some SDK calls)
            const { token } = await sdk.quickAuth.getToken();
            console.log('Farcaster token received');

            // Access user context
            const context = await sdk.context;
            const userProfile = context.user;

            // Extract user data
            setUser({
                fid: userProfile.fid,
                username: userProfile.username || 'Unknown',
                displayName: userProfile.displayName || 'Farcaster User',
                pfpUrl: userProfile.pfpUrl || 'https://via.placeholder.com/150'
            });
        } else {
            // Fallback for web
            setUser({
                fid: 0,
                username: 'webuser',
                displayName: 'Web User',
                pfpUrl: 'https://via.placeholder.com/150'
            });
        }
    } catch (error) {
        console.error('Sign in failed:', error);
        // Always have fallback
        setUser({
            fid: 0,
            username: 'guest',
            displayName: 'Guest User',
            pfpUrl: 'https://via.placeholder.com/150'
        });
    }
};
```

**Key Points**:
- Always check `isFarcasterEnvironment` first
- Get token before accessing context (in some SDK versions)
- Access context via `await sdk.context` (note: await, not function call)
- Always provide fallback for web mode
- Handle errors gracefully - don't block app flow

**2. User Data Not Persisting**

**Symptom**: User logs in but data is lost on refresh.

**Solution**:
- Don't rely on Farcaster context alone - store in state + localStorage
- Re-authenticate on app load if needed
- Use Farcaster context for initial load, localStorage for persistence

**3. FID Not Available**

**Symptom**: User FID is 0 or undefined.

**Solution**:
```typescript
// Always check if FID is valid
if (userProfile.fid && userProfile.fid > 0) {
    // Use FID
} else {
    // Handle anonymous/guest mode
}
```

---

## Wallet & Payment Integration

### Problem: Transactions fail or wallet not accessible

#### Root Causes & Solutions

**1. Provider Timing Issues**

**Symptom**: "Provider not available" errors.

**Solution - Provider Initialization Pattern**:
```typescript
// 1. Wait for SDK to be ready
if (!isReady || !sdk?.wallet) {
    await new Promise(resolve => setTimeout(resolve, 1000));
}

// 2. Check capabilities
const capabilities = await sdk.getCapabilities();
if (!capabilities.includes('wallet.getEthereumProvider')) {
    throw new Error('Wallet capability not granted');
}

// 3. Get provider
const provider = await sdk.wallet.getEthereumProvider();

// 4. Create ethers provider
const ethersProvider = new ethers.BrowserProvider(provider);
```

**2. Transaction Rejection**

**Symptom**: User approves but transaction fails.

**Common Causes**:
- Insufficient balance (check before submitting)
- Gas estimation errors (handle gracefully)
- Contract approval not set (check allowance first)
- Network mismatch (ensure correct network)

**Solution**:
```typescript
// Always check these before transaction:
// 1. Balance
const balance = await tokenContract.balanceOf(userAddress);
if (balance < requiredAmount) {
    throw new Error('Insufficient balance');
}

// 2. Allowance (for token approvals)
const allowance = await tokenContract.allowance(userAddress, contractAddress);
if (allowance < requiredAmount) {
    // Request approval first
    await tokenContract.approve(contractAddress, requiredAmount);
}

// 3. Network
const network = await provider.getNetwork();
if (network.chainId !== expectedChainId) {
    throw new Error('Wrong network');
}

// 4. Gas estimation
try {
    const gasEstimate = await contract.estimateGas.methodName(...params);
} catch (error) {
    // Handle gas estimation failure
}
```

**3. Wallet Not Granted**

**Symptom**: User hasn't granted wallet permission.

**Solution**:
- Show clear UI message: "Please grant wallet access in Farcaster settings"
- Provide instructions on how to grant access
- Check capabilities before attempting to use wallet
- Provide fallback if wallet not available

---

## Sharing & Embeds

### Problem: Sharing posts don't work or embeds don't display

#### Root Causes & Solutions

**1. Compose Cast Not Working**

**Symptom**: `sdk.actions.composeCast()` fails or doesn't open composer.

**Solution**:
```typescript
const shareWinOnFarcaster = async (winAmount: number) => {
    // Always check environment first
    if (!isFarcasterEnvironment || !sdk) {
        console.log('Not in Farcaster environment, skipping share');
        return;
    }

    try {
        // Check capabilities
        const capabilities = await sdk.getCapabilities();
        if (!capabilities.includes('actions.composeCast')) {
            console.warn('Compose cast capability not available');
            return;
        }

        const message = `I just won ${Math.floor(winAmount)} $DEGEN! 🎉

Who's next?

https://yourdomain.com`;

        await sdk.actions.composeCast({
            text: message
            // Optional: Add embeds array if needed
            // embeds: [...]
        });
    } catch (error) {
        console.error('Error sharing on Farcaster:', error);
        // Don't throw - just log and continue
    }
};
```

**Key Points**:
- Always check `isFarcasterEnvironment` first
- Check capabilities before calling
- Include URL in message for better discovery
- Handle errors gracefully
- Keep messages concise (Farcaster has character limits)

**2. Embeds Not Showing in Posts**

**Symptom**: Post shares but embed doesn't appear.

**Solution**:
- Ensure URL in post is full HTTPS URL
- Add proper Open Graph tags to your pages:
```typescript
export const metadata: Metadata = {
    openGraph: {
        title: 'Your App Name',
        description: 'Your description',
        images: ['/screenshot.png'],
        type: 'website',
    },
};
```
- Test embed with Farcaster's embed preview tool
- Ensure page is publicly accessible (no auth walls)
- Wait for Farcaster to crawl your page (can take a few minutes)

**3. Deep Linking Not Working**

**Symptom**: Links in posts don't open miniapp correctly.

**Solution**:
- Use full domain URLs (not relative paths)
- Ensure links point to your miniapp home page
- Test deep links with `?ref=fid` parameters for tracking
- Handle launch parameters in your app:
```typescript
useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refFid = urlParams.get('ref');
    
    if (refFid && isFarcasterEnvironment) {
        console.log('Launched via referral from FID:', refFid);
        // Track referral
    }
}, [isFarcasterEnvironment]);
```

---

## Quick Reference Checklist

### Before Deploying

- [ ] `sdk.actions.ready()` called in provider initialization
- [ ] Environment detection uses multiple fallback methods
- [ ] Manifest file accessible at `/.well-known/farcaster.json`
- [ ] All image URLs are HTTPS and publicly accessible
- [ ] Required capabilities listed in manifest
- [ ] Wallet provider accessed only after `isReady`
- [ ] Error handling for all SDK calls
- [ ] Web fallback for non-Farcaster environments
- [ ] Responsive design tested on mobile
- [ ] Open Graph tags configured for embeds

### Common Error Patterns

**Error: "SDK not available"**
- Check if `sdk.actions.ready()` was called
- Ensure provider wraps your app
- Check if running in Farcaster environment

**Error: "Wallet not available"**
- Check capabilities include `wallet.getEthereumProvider`
- Wait for `isReady` before accessing wallet
- Check if user granted wallet permission

**Error: "Capability not available"**
- List capability in manifest `requiredCapabilities`
- Check SDK version supports the capability
- Ensure user has granted permission

**Error: "Miniapp not found"**
- Check manifest file is accessible
- Verify image URLs are correct
- Test manifest JSON is valid
- Ensure domain matches account association

### Testing Checklist

- [ ] Test on Farcaster mobile app (iOS and Android)
- [ ] Test on Farcaster desktop (if applicable)
- [ ] Test in regular browser (web fallback)
- [ ] Test wallet connection flow
- [ ] Test transaction submission
- [ ] Test sharing functionality
- [ ] Test deep linking from posts
- [ ] Test miniapp discovery and adding
- [ ] Test error scenarios (no wallet, no network, etc.)

---

## Best Practices Summary

1. **Always Use Multi-Layer Detection**: Never rely on single method to detect Farcaster environment
2. **Call ready() First**: Always call `sdk.actions.ready()` before any other SDK calls
3. **Check Capabilities**: Always check capabilities before using SDK features
4. **Graceful Degradation**: Always provide web fallback for non-Farcaster environments
5. **Error Handling**: Wrap all SDK calls in try-catch, but don't block app flow
6. **Timing Matters**: Wait for `isReady` before accessing wallet or context
7. **Public Resources**: All images and assets must be publicly accessible via HTTPS
8. **Test on Real Devices**: Browser testing is not sufficient - test on actual Farcaster mobile app
9. **User Communication**: Provide clear error messages when capabilities aren't granted
10. **Persist State**: Use localStorage to persist user state across sessions

---

## Debugging Tips

1. **Enable Console Logging**: Farcaster SDK provides detailed logs - use them
2. **Test in Increments**: Get basic flow working first, then add features
3. **Use Farcaster Dev Tools**: Test with development environment when possible
4. **Check Network Tab**: Verify all assets load correctly
5. **Test Capabilities**: Log available capabilities to see what's granted
6. **Test Without Wallet**: Ensure app works even if wallet isn't granted
7. **Test Error Paths**: What happens when user denies permissions?
8. **Monitor Console**: Watch for SDK warnings and errors

---

## Additional Resources

- Farcaster MiniApp SDK Documentation
- Farcaster Developer Portal
- Base Network Documentation (for wallet/transaction issues)
- Ethers.js Documentation (for provider/contract issues)

---

*This guide is based on real-world experience with production Farcaster miniapps. If you encounter issues not covered here, check the Farcaster SDK documentation or community forums.*


