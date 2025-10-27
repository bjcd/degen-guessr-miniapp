'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ethers } from 'ethers';
import DegenSlotABI from '../contracts/DegenSlot.json';
import { useFarcaster } from '../farcaster-provider';

const SLOT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SLOT_CONTRACT_ADDRESS || '0x6285b23b5CbDD84187B15cC1aC23cFC5F659Ac21';
const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_DEGEN_TOKEN_ADDRESS || '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed';
const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
const BASE_RPC_URL_ALT = process.env.NEXT_PUBLIC_BASE_RPC_URL_ALT || 'https://base-rpc.publicnode.com';

console.log('Slot Contract Address:', SLOT_CONTRACT_ADDRESS);
console.log('Token Address:', TOKEN_ADDRESS);
console.log('Base RPC URL:', BASE_RPC_URL);
console.log('Base RPC URL (alt):', BASE_RPC_URL_ALT);

// Keep a tiny in-memory cache to avoid UI flicker on transient RPC errors
const lastPotByAddress = new Map<string, number>();
const lastBalanceByAccount = new Map<string, number>();
const lastAllowanceByKey = new Map<string, number>(); // key: `${account}-${contract}`

// Session-based block tracking for optimized queries
// Store the first spin block of this session to avoid querying the entire history
const sessionFirstSpinBlock = new Map<string, number>(); // key: `${account}-${contractAddress}`

// Helper: retry a promise-returning fn with backoff and optional alt provider
function isRetryableError(err: any): boolean {
    if (!err) return false;
    const msg = String(err.message || '');
    const code = String(err.code || '');
    const errorCode = err.error?.code || err.code;
    
    return msg.includes('429') 
        || msg.includes('Too Many Requests') 
        || msg.includes('missing revert data')
        || msg.includes('no backend is currently healthy')
        || msg.includes('unhealthy')
        || msg.includes('TIMEOUT')
        || code === 'CALL_EXCEPTION'
        || code === 'TIMEOUT'
        || code === 'SERVER_ERROR'
        || errorCode === -32011;
}

async function withRetries<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 250): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (!isRetryableError(err)) throw err;
            const delay = baseDelayMs * Math.pow(2, i);
            await new Promise(res => setTimeout(res, delay));
        }
    }
    throw lastError;
}

// Helper: small delay
function delay(ms: number) { return new Promise(res => setTimeout(res, ms)); }

// Optional secondary provider for failover
const rpcProviderPrimary = new ethers.JsonRpcProvider(BASE_RPC_URL);
const rpcProviderAlt = BASE_RPC_URL_ALT ? new ethers.JsonRpcProvider(BASE_RPC_URL_ALT) : null;

// Simple metadata cache for this session
let cachedTokenDecimals: number | null = null;
let cachedTokenSymbol: string | null = null;

interface SlotContractCallbacks {
    onSpinInitiated?: (requestId: string, potBefore: string) => void;
    onSpinResult?: (roll: number, category: string, payout: string, potAfter: string) => void;
    onError?: (message: string) => void;
}

export function useSlotContract(callbacks?: SlotContractCallbacks) {
    const { getEthereumProvider, isFarcasterEnvironment } = useFarcaster();
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
    const [contract, setContract] = useState<ethers.Contract | null>(null);
    const [account, setAccount] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Create a read-only provider for contract data
    const rpcProvider = rpcProviderPrimary;
    const readOnlyContract = SLOT_CONTRACT_ADDRESS ? new ethers.Contract(SLOT_CONTRACT_ADDRESS, DegenSlotABI, rpcProvider) : null;

    // Internal: pick provider for a call with 429/missing-revert failover
    async function callWithProviderFailover<T>(fnPrimary: () => Promise<T>, fnAlt?: () => Promise<T>): Promise<T> {
        try {
            return await fnPrimary();
        } catch (err: any) {
            if (rpcProviderAlt && fnAlt && isRetryableError(err)) {
                console.warn('Primary RPC retryable error, retrying on alt...');
                await delay(150);
                return await fnAlt();
            }
            throw err;
        }
    }

    // Helper: check if contract is available
    function requireContract() {
        if (!readOnlyContract || !SLOT_CONTRACT_ADDRESS) {
            throw new Error('Slot contract address not set');
        }
    }

    // Connect wallet
    const connectWallet = useCallback(async () => {
        try {
            setIsLoading(true);

            // Get the appropriate provider based on environment
            const ethProvider = await getEthereumProvider();

            if (!ethProvider) {
                if (callbacks?.onError) {
                    callbacks.onError('No wallet provider found. Please install a wallet or use Farcaster.');
                }
                return;
            }

            console.log('Using provider:', isFarcasterEnvironment ? 'Farcaster' : 'Browser');
            const provider = new ethers.BrowserProvider(ethProvider);
            const accounts = await provider.send("eth_requestAccounts", []);

            if (accounts.length > 0) {
                // Check if user is on Base Mainnet (chainId: 8453)
                const network = await provider.getNetwork();
                console.log('Current network:', network);

                if (Number(network.chainId) !== 8453) {
                    // In Farcaster environment, try to automatically switch to Base
                    if (isFarcasterEnvironment) {
                        console.log('🔄 Auto-switching to Base Mainnet in Farcaster environment...');
                        try {
                            // Base Mainnet network configuration
                            const baseNetwork = {
                                chainId: '0x2105', // 8453 in hex
                                chainName: 'Base',
                                nativeCurrency: {
                                    name: 'Ethereum',
                                    symbol: 'ETH',
                                    decimals: 18,
                                },
                                rpcUrls: [BASE_RPC_URL],
                                blockExplorerUrls: ['https://basescan.org'],
                            };

                            // Try to add the network first (in case it's not added)
                            try {
                                await ethProvider.request({
                                    method: 'wallet_addEthereumChain',
                                    params: [baseNetwork],
                                });
                                console.log('✅ Base network added successfully');
                            } catch (addError) {
                                console.log('Base network already exists or add failed:', addError);
                            }

                            // Switch to Base network
                            await ethProvider.request({
                                method: 'wallet_switchEthereumChain',
                                params: [{ chainId: '0x2105' }],
                            });

                            console.log('✅ Successfully switched to Base Mainnet');

                            // Re-fetch accounts and network after switch
                            const newAccounts = await provider.send("eth_requestAccounts", []);
                            const newNetwork = await provider.getNetwork();

                            if (Number(newNetwork.chainId) !== 8453) {
                                throw new Error('Failed to switch to Base Mainnet');
                            }

                            // Update accounts if they changed
                            if (newAccounts.length > 0) {
                                accounts.length = 0;
                                accounts.push(...newAccounts);
                            }
                        } catch (switchError) {
                            console.error('❌ Failed to auto-switch to Base:', switchError);
                            if (callbacks?.onError) {
                                callbacks.onError('Please switch to Base Mainnet to use this app. Current network: ' + network.name);
                            }
                            setIsLoading(false);
                            return;
                        }
                    } else {
                        // In regular browser, just show error
                        if (callbacks?.onError) {
                            callbacks.onError('Please switch to Base Mainnet to use this app. Current network: ' + network.name);
                        }
                        setIsLoading(false);
                        return;
                    }
                }

                const signer = await provider.getSigner();
                const contract = new ethers.Contract(
                    SLOT_CONTRACT_ADDRESS!,
                    DegenSlotABI,
                    signer
                );

                setProvider(provider);
                setSigner(signer);
                setContract(contract);
                setAccount(accounts[0]);
                setIsConnected(true);

                console.log('Wallet connected:', accounts[0], 'Environment:', isFarcasterEnvironment ? 'MiniApp' : 'Web');
            } else {
                if (callbacks?.onError) {
                    callbacks.onError('No accounts found');
                }
            }
        } catch (error) {
            console.error('Error connecting wallet:', error);
            if (callbacks?.onError) {
                callbacks.onError('Failed to connect wallet: ' + (error as Error).message);
            }
        } finally {
            setIsLoading(false);
        }
    }, [callbacks]);

    // Get current pot
    const getPot = async (): Promise<number> => {
        try {
            requireContract();
            console.log('Getting pot from slot contract:', SLOT_CONTRACT_ADDRESS);
            const value = await withRetries(async () => callWithProviderFailover(
                async () => Number(ethers.formatEther(await readOnlyContract!.getPot())),
                async () => {
                    const alt = new ethers.Contract(SLOT_CONTRACT_ADDRESS!, DegenSlotABI, rpcProviderAlt!);
                    return Number(ethers.formatEther(await alt.getPot()));
                }
            ));
            console.log('Formatted pot value:', value);
            lastPotByAddress.set(SLOT_CONTRACT_ADDRESS!, value);
            return value;
        } catch (error) {
            console.error('Error getting pot:', error);
            const cached = lastPotByAddress.get(SLOT_CONTRACT_ADDRESS!);
            if (typeof cached === 'number') {
                console.log('Returning cached pot value:', cached);
                return cached;
            }
            return 0;
        }
    };

    // Get treasury balance
    const getTreasuryBalance = async (): Promise<number> => {
        try {
            requireContract();
            console.log('Getting treasury balance from slot contract:', SLOT_CONTRACT_ADDRESS);
            const value = await withRetries(async () => callWithProviderFailover(
                async () => Number(ethers.formatEther(await readOnlyContract!.getTreasuryBalance())),
                async () => {
                    const alt = new ethers.Contract(SLOT_CONTRACT_ADDRESS!, DegenSlotABI, rpcProviderAlt!);
                    return Number(ethers.formatEther(await alt.getTreasuryBalance()));
                }
            ));
            console.log('Formatted treasury balance:', value);
            return value;
        } catch (error) {
            console.error('Error getting treasury balance:', error);
            return 0;
        }
    };

    // Get contract owner
    const getOwner = async (): Promise<string> => {
        try {
            requireContract();
            const owner = await withRetries(async () => callWithProviderFailover(
                async () => await readOnlyContract!.getOwner(),
                async () => {
                    const alt = new ethers.Contract(SLOT_CONTRACT_ADDRESS!, DegenSlotABI, rpcProviderAlt!);
                    return await alt.getOwner();
                }
            ));
            console.log('Contract owner:', owner);
            return owner;
        } catch (error) {
            console.error('Error getting contract owner:', error);
            return '';
        }
    };

    // Get token balance
    const getTokenBalance = async (): Promise<number> => {
        if (!account) return 0;
        try {
            const tokenPrimary = new ethers.Contract(
                TOKEN_ADDRESS!,
                [
                    'function balanceOf(address owner) view returns (uint256)',
                    'function decimals() view returns (uint8)',
                    'function symbol() view returns (string)'
                ],
                rpcProvider
            );
            const tokenAlt = rpcProviderAlt ? new ethers.Contract(
                TOKEN_ADDRESS!,
                [
                    'function balanceOf(address owner) view returns (uint256)',
                    'function decimals() view returns (uint8)',
                    'function symbol() view returns (string)'
                ],
                rpcProviderAlt
            ) : null;

            const balance = await withRetries(() => callWithProviderFailover(
                () => tokenPrimary.balanceOf(account),
                () => tokenAlt!.balanceOf(account)
            ));

            let decimals = cachedTokenDecimals ?? 18;
            if (cachedTokenDecimals == null) {
                try {
                    decimals = await withRetries(() => callWithProviderFailover(
                        () => tokenPrimary.decimals(),
                        () => tokenAlt!.decimals()
                    ));
                    cachedTokenDecimals = decimals;
                } catch { }
            }

            if (cachedTokenSymbol == null) {
                try {
                    const symbol = await withRetries(() => callWithProviderFailover(
                        () => tokenPrimary.symbol(),
                        () => tokenAlt!.symbol()
                    ));
                    cachedTokenSymbol = symbol;
                } catch { }
            }

            const value = Number(ethers.formatUnits(balance, decimals));
            lastBalanceByAccount.set(account, value);
            return value;
        } catch (error) {
            console.error('Error getting token balance:', error);
            const cached = lastBalanceByAccount.get(account);
            return typeof cached === 'number' ? cached : 0;
        }
    };

    // Get current allowance
    const getAllowance = async (): Promise<number> => {
        if (!account) return 0;
        try {
            const tokenPrimary = new ethers.Contract(
                TOKEN_ADDRESS!,
                [
                    'function allowance(address owner, address spender) view returns (uint256)',
                    'function decimals() view returns (uint8)'
                ],
                rpcProvider
            );
            const tokenAlt = rpcProviderAlt ? new ethers.Contract(
                TOKEN_ADDRESS!,
                [
                    'function allowance(address owner, address spender) view returns (uint256)',
                    'function decimals() view returns (uint8)'
                ],
                rpcProviderAlt
            ) : null;

            const allowanceBN = await withRetries(() => callWithProviderFailover(
                () => tokenPrimary.allowance(account, SLOT_CONTRACT_ADDRESS!),
                () => tokenAlt!.allowance(account, SLOT_CONTRACT_ADDRESS!)
            ));

            let decimals = cachedTokenDecimals ?? 18;
            if (cachedTokenDecimals == null) {
                try {
                    decimals = await withRetries(() => callWithProviderFailover(
                        () => tokenPrimary.decimals(),
                        () => tokenAlt!.decimals()
                    ));
                    cachedTokenDecimals = decimals;
                } catch { }
            }

            const value = Number(ethers.formatUnits(allowanceBN, decimals));
            lastAllowanceByKey.set(`${account}-${SLOT_CONTRACT_ADDRESS}`, value);
            return value;
        } catch (error) {
            console.error('Error getting allowance:', error);
            const cached = lastAllowanceByKey.get(`${account}-${SLOT_CONTRACT_ADDRESS}`);
            return typeof cached === 'number' ? cached : 0;
        }
    };

    // Approve tokens
    const approveTokens = useCallback(async (amount: string): Promise<boolean> => {
        if (!signer || !account) return false;
        try {
            setIsLoading(true);

            const tokenContract = new ethers.Contract(
                TOKEN_ADDRESS!,
                [
                    'function approve(address spender, uint256 amount) returns (bool)',
                    'function allowance(address owner, address spender) view returns (uint256)'
                ],
                signer
            );

            // Dynamically get decimals from the token contract
            let decimals = 18; // Default to 18
            try {
                const tokenContractForDecimals = new ethers.Contract(
                    TOKEN_ADDRESS!,
                    ['function decimals() view returns (uint8)'],
                    rpcProvider
                );
                decimals = await tokenContractForDecimals.decimals();
                console.log('Token decimals for approval:', decimals);
            } catch (decimalsError) {
                console.warn('Could not get token decimals for approval, using default 18:', decimalsError);
            }

            const amountWei = ethers.parseUnits(amount, decimals);
            console.log(`Approving ${amount} tokens (${amountWei.toString()} wei) with ${decimals} decimals`);

            // Use manual gas limit to avoid eth_estimateGas (Farcaster-compatible)
            const tx = await tokenContract.approve(SLOT_CONTRACT_ADDRESS!, amountWei, {
                gasLimit: 100000n // Standard ERC20 approve gas limit
            });
            console.log('Approval transaction sent, waiting for confirmation...');

            // Wait for transaction using RPC provider (Farcaster-compatible)
            const receipt = await rpcProvider.waitForTransaction(tx.hash);
            console.log('Approval transaction confirmed!');

            // Verify approval using read-only provider (Farcaster-compatible)
            const readOnlyTokenContract = new ethers.Contract(
                TOKEN_ADDRESS!,
                ['function allowance(address owner, address spender) view returns (uint256)'],
                rpcProvider
            );
            const allowance = await readOnlyTokenContract.allowance(account, SLOT_CONTRACT_ADDRESS!);
            console.log(`Allowance after approval: ${allowance.toString()}`);

            return true;
        } catch (error) {
            console.error('Error approving tokens:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [signer, account]);

    // Spin the slot machine
    const spin = useCallback(async (): Promise<boolean> => {
        if (!contract || !account || !signer) return false;
        try {
            requireContract();
            setIsLoading(true);

            console.log('Spinning slot machine...');
            console.log('Contract address:', SLOT_CONTRACT_ADDRESS);
            console.log('User address:', account);

            // Check if user has pending request
            console.log('Checking for pending request...');
            const hasPending = await readOnlyContract!.hasPendingRequest(account);
            console.log('Has pending request:', hasPending);
            if (hasPending) {
                console.log('⚠️ Pending request detected. This usually means:');
                console.log('1. A previous VRF request is still being processed');
                console.log('2. The VRF callback failed or is taking too long');
                console.log('3. There might be a stuck request');
                console.log('Please wait a few minutes for the VRF to complete, or contact support.');

                // Check recent VRF events to help debug
                await checkRecentVRFEvents();

                if (callbacks?.onError) {
                    callbacks.onError('You have a pending spin request. Please wait for it to complete (this can take 1-2 minutes). If it\'s been stuck for more than 5 minutes, contact support.');
                }
                return false;
            }

            // Skip simulation on Farcaster wallet (RPC doesn't support static calls properly)
            // Make the spin with manual gas limit (Farcaster-compatible)
            console.log('Sending spin transaction...');
            const tx = await contract.spin({
                gasLimit: 500000n // Gas limit for spin transaction (includes VRF callback)
            });
            console.log('Spin transaction sent, waiting for confirmation...');
            console.log('Transaction hash:', tx.hash);

            // Wait for transaction using RPC provider (Farcaster-compatible)
            const receipt = await rpcProvider.waitForTransaction(tx.hash);
            if (!receipt) {
                throw new Error('Transaction receipt not found');
            }
            console.log('Spin confirmed! Receipt:', receipt);

            // Check if transaction was successful
            if (receipt.status !== 1) {
                // Try to get more details about the failure
                let errorMessage = `Transaction failed with status ${receipt.status}`;

                // Check if there are any logs that might indicate the reason
                if (receipt.logs && receipt.logs.length > 0) {
                    console.log('Transaction logs:', receipt.logs);
                } else {
                    console.log('No transaction logs found - this suggests a revert');
                }

                // Skip revert reason detection (Farcaster wallet RPC doesn't support static calls)

                // Try to get the transaction details
                try {
                    const txDetails = await rpcProvider.getTransaction(tx.hash);
                    console.log('Transaction details:', txDetails);
                } catch (txError) {
                    console.log('Could not get transaction details:', txError);
                }

                throw new Error(errorMessage);
            }

            // Start polling for SpinResult events since VRF callback happens in a different transaction
            const startBlock = receipt.blockNumber;
            let pollCount = 0;
            const maxPolls = 30; // Poll for up to 30 times (60 seconds if 2s interval)

            const pollForEvents = async () => {
                try {
                    pollCount++;
                    const currentBlock = await rpcProvider.getBlockNumber();
                    console.log(`Polling for spin events (${pollCount}/${maxPolls}), blocks ${startBlock} to ${currentBlock}`);

                    // Query for SpinResult events in recent blocks using read-only provider
                    const spinResultFilter = readOnlyContract!.filters.SpinResult(account);
                    const spinResultEvents = await readOnlyContract!.queryFilter(spinResultFilter, startBlock, currentBlock);

                    if (spinResultEvents.length > 0) {
                        console.log('Polling found SpinResult event!', spinResultEvents[spinResultEvents.length - 1]);
                        const event = spinResultEvents[spinResultEvents.length - 1]; // Get the latest one
                        // Type guard to check if event is EventLog (has args property)
                        if ('args' in event && event.args && callbacks?.onSpinResult) {
                            let decimals = 18; // Default to 18
                            try {
                                const tokenContractForDecimals = new ethers.Contract(
                                    TOKEN_ADDRESS!,
                                    ['function decimals() view returns (uint8)'],
                                    rpcProvider
                                );
                                decimals = await tokenContractForDecimals.decimals();
                            } catch (decimalsError) {
                                console.warn('Could not get token decimals for event, using default 18:', decimalsError);
                            }
                            const formattedPayout = ethers.formatUnits(event.args[3], decimals); // payout is 4th arg
                            const formattedPotAfter = ethers.formatUnits(event.args[4], decimals); // potAfter is 5th arg

                            // Map uint8 category to string
                            const categoryMap = ['NOTHING', 'TWO_SAME', 'THREE_SAME', 'JACKPOT', 'ONE_HAT', 'TWO_HATS'];
                            const categoryString = categoryMap[Number(event.args[2])] || 'UNKNOWN';

                            callbacks.onSpinResult(Number(event.args[1]), categoryString, formattedPayout, formattedPotAfter);
                        }
                        return; // Stop polling
                    }

                    // Continue polling if we haven't reached max polls
                    if (pollCount < maxPolls) {
                        setTimeout(pollForEvents, 2000); // Poll every 2 seconds
                    } else {
                        console.log('Max polls reached, stopping event polling');
                    }
                } catch (error) {
                    console.error('Error polling for spin events:', error);
                    // Continue polling on error
                    if (pollCount < maxPolls) {
                        setTimeout(pollForEvents, 2000);
                    }
                }
            };

            // Start polling after a short delay
            setTimeout(pollForEvents, 3000); // Start polling after 3 seconds

            return true;
        } catch (error) {
            console.error('Error spinning:', error);
            console.error('Error details:', {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                error
            });
            if (callbacks?.onError) {
                callbacks.onError('Failed to spin: ' + (error instanceof Error ? error.message : 'Unknown error'));
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [contract, account, signer, readOnlyContract, callbacks]);

    // Get game constants
    const getGameConstants = async () => {
        try {
            requireContract();
            const constants = await withRetries(async () => callWithProviderFailover(
                async () => await readOnlyContract!.getGameConstants(),
                async () => {
                    const alt = new ethers.Contract(SLOT_CONTRACT_ADDRESS!, DegenSlotABI, rpcProviderAlt!);
                    return await alt.getGameConstants();
                }
            ));

            return {
                costPerSpin: Number(ethers.formatEther(constants[0])),
                potAddPerSpin: Number(ethers.formatEther(constants[1])),
                treasuryAddPerSpin: Number(ethers.formatEther(constants[2])),
                initialPot: Number(ethers.formatEther(constants[3]))
            };
        } catch (error) {
            console.error('Error getting game constants:', error);
            return {
                costPerSpin: 100,
                potAddPerSpin: 70,
                treasuryAddPerSpin: 30,
                initialPot: 7500
            };
        }
    };

    // Get payouts
    const getPayouts = async () => {
        try {
            requireContract();
            const payouts = await withRetries(async () => callWithProviderFailover(
                async () => await readOnlyContract!.getFixedPayouts(),
                async () => {
                    const alt = new ethers.Contract(SLOT_CONTRACT_ADDRESS!, DegenSlotABI, rpcProviderAlt!);
                    return await alt.getFixedPayouts();
                }
            ));

            return {
                threeSamePayout: Number(ethers.formatEther(payouts.threeSame)),
                twoSamePayout: Number(ethers.formatEther(payouts.twoSame)),
                oneHatPayout: Number(ethers.formatEther(payouts.oneHat)),
                twoHatsPayout: Number(ethers.formatEther(payouts.twoHats)),
                jackpotShareBps: Number(payouts.jackpotShareBps)
            };
        } catch (error) {
            console.error('Error getting payouts:', error);
            return {
                threeSamePayout: 500,
                twoSamePayout: 250,
                oneHatPayout: 50,
                twoHatsPayout: 350,
                jackpotShareBps: 5000
            };
        }
    };

    // Clear stuck pending request (emergency function)
    const clearStuckPendingRequest = async (): Promise<boolean> => {
        try {
            requireContract();
            if (!contract || !account) return false;

            console.log('🚨 Attempting to clear stuck pending request...');
            const tx = await contract.clearStuckPendingRequest(account);
            console.log('Clear stuck request transaction sent:', tx.hash);

            const receipt = await rpcProvider.waitForTransaction(tx.hash);
            if (!receipt) {
                throw new Error('Transaction receipt not found');
            }

            console.log('✅ Stuck pending request cleared successfully!');
            return true;
        } catch (error) {
            console.error('Error clearing stuck pending request:', error);
            return false;
        }
    };

    // Check for recent VRF events to debug pending requests
    const checkRecentVRFEvents = async () => {
        try {
            requireContract();
            if (!account) return null;

            console.log('🔍 Checking for recent VRF events...');

            // Get recent blocks
            const currentBlock = await rpcProvider.getBlockNumber();
            const fromBlock = Math.max(0, currentBlock - 100); // Check last 100 blocks

            // Check for SpinInitiated events
            const spinInitiatedFilter = readOnlyContract!.filters.SpinInitiated(account);
            const spinEvents = await readOnlyContract!.queryFilter(spinInitiatedFilter, fromBlock, currentBlock);

            // Check for SpinResult events
            const spinResultFilter = readOnlyContract!.filters.SpinResult(account);
            const resultEvents = await readOnlyContract!.queryFilter(spinResultFilter, fromBlock, currentBlock);

            console.log(`Found ${spinEvents.length} SpinInitiated events and ${resultEvents.length} SpinResult events in last 100 blocks`);

            if (spinEvents.length > 0) {
                const latestSpin = spinEvents[spinEvents.length - 1];
                console.log('Latest SpinInitiated event:', {
                    blockNumber: latestSpin.blockNumber,
                    transactionHash: latestSpin.transactionHash,
                    requestId: 'args' in latestSpin ? latestSpin.args?.requestId : 'N/A'
                });
            }

            if (resultEvents.length > 0) {
                const latestResult = resultEvents[resultEvents.length - 1];
                console.log('Latest SpinResult event:', {
                    blockNumber: latestResult.blockNumber,
                    transactionHash: latestResult.transactionHash,
                    roll: 'args' in latestResult ? latestResult.args?.roll : 'N/A',
                    category: 'args' in latestResult ? latestResult.args?.category : 'N/A'
                });
            }

            return {
                spinEvents: spinEvents.length,
                resultEvents: resultEvents.length,
                latestSpin: spinEvents.length > 0 ? spinEvents[spinEvents.length - 1] : null,
                latestResult: resultEvents.length > 0 ? resultEvents[resultEvents.length - 1] : null
            };
        } catch (error) {
            console.error('Error checking VRF events:', error);
            return null;
        }
    };

    // Get probability thresholds
    const getProbabilityThresholds = async () => {
        try {
            requireContract();
            const thresholds = await withRetries(async () => callWithProviderFailover(
                async () => await readOnlyContract!.getProbabilityThresholds(),
                async () => {
                    const alt = new ethers.Contract(SLOT_CONTRACT_ADDRESS!, DegenSlotABI, rpcProviderAlt!);
                    return await alt.getProbabilityThresholds();
                }
            ));

            return {
                jackpotStart: Number(thresholds[0]),
                jackpotEnd: Number(thresholds[1]),
                threeSameStart: Number(thresholds[2]),
                threeSameEnd: Number(thresholds[3]),
                twoSameStart: Number(thresholds[4]),
                twoSameEnd: Number(thresholds[5]),
                nothingStart: Number(thresholds[6]),
                nothingEnd: Number(thresholds[7])
            };
        } catch (error) {
            console.error('Error getting probability thresholds:', error);
            return {
                jackpotStart: 0,
                jackpotEnd: 15,
                threeSameStart: 15,
                threeSameEnd: 265,
                twoSameStart: 265,
                twoSameEnd: 2890,
                nothingStart: 2890,
                nothingEnd: 10000
            };
        }
    };

    // Get total spins for a player from past events
    const getPlayerSpins = async (playerAddress: string): Promise<number> => {
        try {
            requireContract();
            console.log('🎰 Getting player spins for:', playerAddress);

            const currentBlock = await rpcProviderPrimary.getBlockNumber();

            // Use session block if this is a subsequent spin in the same session
            const sessionKey = `${playerAddress}-${SLOT_CONTRACT_ADDRESS}`;
            let fromBlock: number;

            if (sessionFirstSpinBlock.has(sessionKey)) {
                // Subsequent spin - use the session's first block
                fromBlock = sessionFirstSpinBlock.get(sessionKey)!;
                console.log('🎰 Using session block tracking - fromBlock:', fromBlock);
            } else {
                // First spin of session - query last 50k blocks and store this block
                fromBlock = Math.max(0, currentBlock - 50000);
                sessionFirstSpinBlock.set(sessionKey, fromBlock);
                console.log('🎰 First spin of session - storing block:', fromBlock);
            }

            const filter = readOnlyContract!.filters.SpinResult(playerAddress);
            const events = await withRetries(async () => callWithProviderFailover(
                async () => await readOnlyContract!.queryFilter(filter, fromBlock),
                async () => {
                    const alt = new ethers.Contract(SLOT_CONTRACT_ADDRESS!, DegenSlotABI, rpcProviderAlt!);
                    return await alt.queryFilter(filter, fromBlock);
                }
            ));
            console.log('🎰 Found', events.length, 'spin events for player (queried from block', fromBlock, ')');
            return events.length;
        } catch (error) {
            console.error('Error getting player spins:', error);
            throw error; // Re-throw so caller knows it failed
        }
    };

    // Get total winnings for a player from past events
    const getPlayerWinnings = async (playerAddress: string): Promise<number> => {
        try {
            requireContract();

            const currentBlock = await rpcProviderPrimary.getBlockNumber();

            // Use session block if this is a subsequent spin in the same session
            const sessionKey = `${playerAddress}-${SLOT_CONTRACT_ADDRESS}`;
            let fromBlock: number;

            if (sessionFirstSpinBlock.has(sessionKey)) {
                // Subsequent spin - use the session's first block
                fromBlock = sessionFirstSpinBlock.get(sessionKey)!;
                console.log('🎰 Using session block tracking for winnings - fromBlock:', fromBlock);
            } else {
                // First spin of session - query last 50k blocks
                fromBlock = Math.max(0, currentBlock - 50000);
                sessionFirstSpinBlock.set(sessionKey, fromBlock);
                console.log('🎰 First winnings query - storing block:', fromBlock);
            }

            const filter = readOnlyContract!.filters.SpinResult(playerAddress);
            const events = await withRetries(async () => callWithProviderFailover(
                async () => await readOnlyContract!.queryFilter(filter, fromBlock),
                async () => {
                    const alt = new ethers.Contract(SLOT_CONTRACT_ADDRESS!, DegenSlotABI, rpcProviderAlt!);
                    return await alt.queryFilter(filter, fromBlock);
                }
            ));

            let totalWinnings = 0;
            for (const event of events) {
                if ('args' in event && event.args && event.args[3]) {
                    const payout = Number(ethers.formatEther(event.args[3]));
                    totalWinnings += payout;
                }
            }

            console.log('🎰 Total winnings for player:', totalWinnings, '(from', events.length, 'events)');
            return totalWinnings;
        } catch (error) {
            console.error('Error getting player winnings:', error);
            throw error; // Re-throw so caller knows it failed
        }
    };

    return useMemo(() => ({
        connectWallet,
        getPot,
        getTreasuryBalance,
        getTokenBalance,
        getAllowance,
        approveTokens,
        spin,
        getGameConstants,
        getPayouts,
        getProbabilityThresholds,
        checkRecentVRFEvents,
        clearStuckPendingRequest,
        getOwner,
        getPlayerSpins,
        getPlayerWinnings,
        isConnected,
        isLoading,
        account,
        contract
    }), [
        connectWallet,
        approveTokens,
        spin,
        clearStuckPendingRequest,
        isConnected,
        isLoading,
        account,
        contract
    ]);
}
