'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import DegenGuessrABI from '../contracts/DegenGuessr.json';
import { useFarcaster } from '../farcaster-provider';
import { getRecentWinners, getGameStats, getPublicData, clearWinnersCache, type Win as GraphWin } from '../lib/graphql';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_DEGEN_TOKEN_ADDRESS;
const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
const BASE_RPC_URL_ALT = process.env.NEXT_PUBLIC_BASE_RPC_URL_ALT || '';

console.log('Contract Address:', CONTRACT_ADDRESS);
console.log('Token Address:', TOKEN_ADDRESS);
console.log('Base RPC URL:', BASE_RPC_URL);
if (BASE_RPC_URL_ALT) console.log('Base RPC URL (alt):', BASE_RPC_URL_ALT);

// Keep a tiny in-memory cache to avoid UI flicker on transient RPC errors
const lastPotByAddress = new Map<string, number>();
const lastBalanceByAccount = new Map<string, number>();
const lastWinsByAccount = new Map<string, number>();
const lastGuessesByAccount = new Map<string, number>();
const lastAllowanceByKey = new Map<string, number>(); // key: `${account}-${contract}`

// Helper: retry a promise-returning fn with backoff and optional alt provider
function isRetryableError(err: any): boolean {
    if (!err) return false;
    const msg = String(err.message || '');
    const code = String(err.code || '');
    return msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('missing revert data') || code === 'CALL_EXCEPTION';
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

interface ContractCallbacks {
    onWin?: (guessedNumber: number, amount: string, winnerAddress: string, txHash: string) => void;
    onMiss?: (guessedNumber: number, winningNumber: number) => void;
    onGuessSubmitted?: () => void;
    onError?: (message: string) => void;
}

export function useContract(callbacks?: ContractCallbacks, contractAddress?: string) {
    const { getEthereumProvider, isFarcasterEnvironment } = useFarcaster();
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
    const [contract, setContract] = useState<ethers.Contract | null>(null);
    const [account, setAccount] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Use provided contract address or default
    const currentContractAddress = contractAddress || CONTRACT_ADDRESS;

    // Create a read-only provider for contract data
    const rpcProvider = rpcProviderPrimary;
    const readOnlyContract = new ethers.Contract(currentContractAddress!, DegenGuessrABI, rpcProvider);

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

    // Connect wallet
    const connectWallet = async () => {
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
                    currentContractAddress!,
                    DegenGuessrABI,
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
    };

    // Get current pot
    const getPot = async (): Promise<number> => {
        try {
            console.log('Getting pot from contract:', currentContractAddress);
            const value = await withRetries(async () => callWithProviderFailover(
                async () => Number(ethers.formatEther(await readOnlyContract.getPot())),
                async () => {
                    const alt = new ethers.Contract(currentContractAddress!, DegenGuessrABI, rpcProviderAlt!);
                    return Number(ethers.formatEther(await alt.getPot()));
                }
            ));
            console.log('Formatted pot value:', value);
            lastPotByAddress.set(currentContractAddress!, value);
            return value;
        } catch (error) {
            console.error('Error getting pot:', error);
            const cached = lastPotByAddress.get(currentContractAddress!);
            if (typeof cached === 'number') {
                console.log('Returning cached pot value:', cached);
                return cached;
            }
            return 0;
        }
    };

    // Get player wins
    const getPlayerWins = async (playerAddress: string): Promise<number> => {
        if (!playerAddress) return 0;
        try {
            const winsBN = await withRetries(async () => callWithProviderFailover(
                async () => readOnlyContract.getPlayerWins(playerAddress),
                async () => new ethers.Contract(currentContractAddress!, DegenGuessrABI, rpcProviderAlt!).getPlayerWins(playerAddress)
            ));

            let decimals = cachedTokenDecimals ?? 18;
            if (cachedTokenDecimals == null) {
                try {
                    const tokenContractForDecimals = new ethers.Contract(
                        TOKEN_ADDRESS!, ['function decimals() view returns (uint8)'], rpcProvider
                    );
                    decimals = await withRetries(() => callWithProviderFailover(
                        () => tokenContractForDecimals.decimals(),
                        () => new ethers.Contract(TOKEN_ADDRESS!, ['function decimals() view returns (uint8)'], rpcProviderAlt!).decimals()
                    ));
                    cachedTokenDecimals = decimals;
                } catch { }
            }
            const wins = Number(ethers.formatUnits(winsBN, decimals));
            lastWinsByAccount.set(playerAddress, wins);
            return wins;
        } catch (error) {
            console.error('Error getting player wins:', error);
            const cached = lastWinsByAccount.get(playerAddress);
            return typeof cached === 'number' ? cached : 0;
        }
    };

    // Get total guesses for a player
    const getPlayerGuesses = async (playerAddress: string): Promise<number> => {
        try {
            const guessesBN = await withRetries(async () => callWithProviderFailover(
                async () => readOnlyContract.playerGuesses(playerAddress),
                async () => new ethers.Contract(currentContractAddress!, DegenGuessrABI, rpcProviderAlt!).playerGuesses(playerAddress)
            ));
            const guesses = Number(guessesBN);
            lastGuessesByAccount.set(playerAddress, guesses);
            return guesses;
        } catch (error) {
            console.error('Error getting player guesses:', error);
            const cached = lastGuessesByAccount.get(playerAddress);
            return typeof cached === 'number' ? cached : 0;
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
                () => tokenPrimary.allowance(account, currentContractAddress!),
                () => tokenAlt!.allowance(account, currentContractAddress!)
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
            lastAllowanceByKey.set(`${account}-${currentContractAddress}`, value);
            return value;
        } catch (error) {
            console.error('Error getting allowance:', error);
            const cached = lastAllowanceByKey.get(`${account}-${currentContractAddress}`);
            return typeof cached === 'number' ? cached : 0;
        }
    };

    // Approve tokens
    const approveTokens = async (amount: string): Promise<boolean> => {
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
            const tx = await tokenContract.approve(currentContractAddress!, amountWei, {
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
            const allowance = await readOnlyTokenContract.allowance(account, currentContractAddress!);
            console.log(`Allowance after approval: ${allowance.toString()}`);

            return true;
        } catch (error) {
            console.error('Error approving tokens:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Make a guess (only after approval)
    const makeGuess = async (number: number): Promise<boolean> => {
        if (!contract || !account || !signer) return false;
        try {
            setIsLoading(true);

            console.log('Making guess...');
            console.log('Guess number:', number);
            console.log('Contract address:', currentContractAddress);
            console.log('User address:', account);

            // Make the guess with manual gas limit (Farcaster-compatible)
            const tx = await contract.guess(number, {
                gasLimit: 500000n // Gas limit for guess transaction (includes VRF callback)
            });
            console.log('Guess transaction sent, waiting for confirmation...');

            // Wait for transaction using RPC provider (Farcaster-compatible)
            const receipt = await rpcProvider.waitForTransaction(tx.hash);
            if (!receipt) {
                throw new Error('Transaction receipt not found');
            }
            console.log('Guess confirmed! Receipt:', receipt);

            // Start polling for Win/Miss events since VRF callback happens in a different transaction
            // This is a fallback in case event listeners don't fire reliably
            const startBlock = receipt.blockNumber;
            let pollCount = 0;
            const maxPolls = 30; // Poll for up to 30 times (60 seconds if 2s interval)

            const pollForEvents = async () => {
                try {
                    pollCount++;
                    const currentBlock = await rpcProvider.getBlockNumber();
                    console.log(`Polling for events (${pollCount}/${maxPolls}), blocks ${startBlock} to ${currentBlock}`);

                    // Query for Win events in recent blocks using read-only provider
                    const winFilter = readOnlyContract.filters.Win(account);
                    const winEvents = await readOnlyContract.queryFilter(winFilter, startBlock, currentBlock);

                    if (winEvents.length > 0) {
                        console.log('Polling found Win event!', winEvents[winEvents.length - 1]);
                        const event = winEvents[winEvents.length - 1]; // Get the latest one
                        // Type guard to check if event is EventLog (has args property)
                        if ('args' in event && event.args && callbacks?.onWin) {
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
                            const formattedAmount = ethers.formatUnits(event.args[3], decimals); // amount is 4th arg
                            const txHash = event.transactionHash || '';
                            callbacks.onWin(Number(event.args[1]), formattedAmount, event.args[0], txHash);
                        }
                        return; // Stop polling
                    }

                    // Query for Miss events
                    const missFilter = readOnlyContract.filters.Miss(account);
                    const missEvents = await readOnlyContract.queryFilter(missFilter, startBlock, currentBlock);

                    if (missEvents.length > 0) {
                        console.log('Polling found Miss event!', missEvents[missEvents.length - 1]);
                        const event = missEvents[missEvents.length - 1]; // Get the latest one
                        // Type guard to check if event is EventLog (has args property)
                        if ('args' in event && event.args && callbacks?.onMiss) {
                            callbacks.onMiss(Number(event.args[1]), Number(event.args[2])); // guessedNumber, winningNumber
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
                    console.error('Error polling for events:', error);
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
            console.error('Error making guess:', error);
            if (callbacks?.onError) {
                callbacks.onError('Failed to make guess: ' + (error as Error).message);
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Listen for contract events
    useEffect(() => {
        if (!contract) return;

        const handleGuessSubmitted = (requestId: any, player: string, number: any, potAtTime: any) => {
            console.log('Guess submitted:', { requestId, player, number, potAtTime });
        };

        const handleWin = async (player: string, guessedNumber: any, winningNumber: any, amount: any, event: any) => {
            console.log('Win event received!', { player, guessedNumber, winningNumber, amount, event });

            // Extract the REAL transaction hash from the event receipt
            // ethers.js v6 provides the transaction hash in the event.log object
            let txHash = '';
            try {
                // Try multiple ways to get the transaction hash
                txHash = event?.log?.transactionHash ||
                    event?.transactionHash ||
                    event?.hash ||
                    '';
                console.log('Extracted transaction hash:', txHash);
            } catch (error) {
                console.error('Error extracting transaction hash:', error);
            }

            // Get token decimals dynamically
            if (provider) {
                try {
                    let decimals = 18; // Default to 18
                    try {
                        const tokenContractForDecimals = new ethers.Contract(
                            TOKEN_ADDRESS!,
                            ['function decimals() view returns (uint8)'],
                            rpcProvider
                        );
                        decimals = await tokenContractForDecimals.decimals();
                    } catch (decimalsError) {
                        console.warn('Could not get token decimals for manual win, using default 18:', decimalsError);
                    }
                    const formattedAmount = ethers.formatUnits(amount, decimals);
                    if (callbacks?.onWin) {
                        callbacks.onWin(Number(guessedNumber), formattedAmount, player, txHash);
                    }
                } catch (error) {
                    console.error('Error formatting win amount:', error);
                    if (callbacks?.onWin) {
                        callbacks.onWin(Number(guessedNumber), '0', player, txHash);
                    }
                }
            } else {
                if (callbacks?.onWin) {
                    callbacks.onWin(Number(guessedNumber), '0', player, txHash);
                }
            }
        };

        const handleMiss = (player: string, guessedNumber: any, winningNumber: any, potAtTime: any) => {
            console.log('Miss event received!', { player, guessedNumber, winningNumber, potAtTime });
            if (callbacks?.onMiss) {
                console.log('Calling onMiss callback with:', Number(guessedNumber), Number(winningNumber));
                callbacks.onMiss(Number(guessedNumber), Number(winningNumber));
            } else {
                console.warn('No onMiss callback defined!');
            }
        };

        // Note: We don't set up event listeners here because:
        // 1. Farcaster wallet doesn't support eth_newFilter
        // 2. We use polling in makeGuess() instead for better compatibility
        console.log('Event listeners disabled (using polling for Farcaster compatibility)');

        return () => {
            console.log('No event listeners to clean up');
        };
    }, [contract, callbacks, provider]);

    // Get past Win events from the blockchain using batched query
    const getPastWinners = async (limit: number = 10): Promise<Array<{
        player: string;
        guessedNumber: number;
        winningNumber: number;
        amount: string;
        txHash: string;
        timestamp: Date;
        contractAddress?: string;
        mode?: string;
    }>> => {
        try {
            console.log('Getting past winners from The Graph (batched query)...');

            // Get token decimals for formatting
            let decimals = 18; // Default to 18
            try {
                const tokenContractForDecimals = new ethers.Contract(
                    TOKEN_ADDRESS!,
                    ['function decimals() view returns (uint8)'],
                    rpcProvider
                );
                decimals = await tokenContractForDecimals.decimals();
                console.log('Token decimals for past winners:', decimals);
            } catch (decimalsError) {
                console.warn('Could not get token decimals for past winners, using default 18:', decimalsError);
            }

            // Use batched query to get both winners and stats
            const { wins: graphWins } = await getPublicData(limit);
            console.log('Found', graphWins.length, 'winners from The Graph');

            // Convert GraphQL results to our format
            const winners = graphWins.map((win: GraphWin) => ({
                player: win.player,
                guessedNumber: win.guessedNumber,
                winningNumber: win.winningNumber,
                amount: ethers.formatUnits(win.amount, decimals),
                txHash: win.tx,
                timestamp: new Date(parseInt(win.timestamp) * 1000),
                contractAddress: win.contractAddress,
                mode: win.mode
            }));

            console.log('Processed', winners.length, 'winners from The Graph');
            return winners;
        } catch (error) {
            console.error('Error getting past winners from The Graph:', error);
            // Fallback to RPC if GraphQL fails
            console.log('Falling back to RPC query...');
            return await getPastWinnersRPC(limit);
        }
    };

    // Fallback RPC method (keeping the working version as backup)
    const getPastWinnersRPC = async (limit: number = 10): Promise<Array<{
        player: string;
        guessedNumber: number;
        winningNumber: number;
        amount: string;
        txHash: string;
        timestamp: Date;
    }>> => {
        try {
            console.log('Getting past winners from RPC (fallback)...');
            // Query Win events from last 10,000 blocks (this approach was working)
            const currentBlock = await rpcProvider.getBlockNumber();
            const fromBlock = Math.max(0, currentBlock - 10000); // Last 10,000 blocks
            console.log('Querying events from block', fromBlock, 'to', currentBlock);

            const filter = readOnlyContract.filters.Win();
            const events = await readOnlyContract.queryFilter(filter, fromBlock, currentBlock);
            console.log('Found', events.length, 'Win events');

            // Get token decimals for formatting
            let decimals = 18; // Default to 18
            try {
                const tokenContractForDecimals = new ethers.Contract(
                    TOKEN_ADDRESS!,
                    ['function decimals() view returns (uint8)'],
                    rpcProvider
                );
                decimals = await tokenContractForDecimals.decimals();
                console.log('Token decimals for past winners:', decimals);
            } catch (decimalsError) {
                console.warn('Could not get token decimals for past winners, using default 18:', decimalsError);
            }

            // Process events and get block timestamps
            const winners = await Promise.all(
                events.slice(-limit).reverse().map(async (event) => {
                    const block = await event.getBlock();
                    // Type guard to check if event is EventLog (has args property)
                    const args = 'args' in event ? event.args : null;
                    return {
                        player: args?.player || '',
                        guessedNumber: Number(args?.guessedNumber || 0),
                        winningNumber: Number(args?.winningNumber || 0),
                        amount: ethers.formatUnits(args?.amount || 0, decimals),
                        txHash: event.transactionHash,
                        timestamp: new Date(block.timestamp * 1000)
                    };
                })
            );

            console.log('Processed', winners.length, 'winners from RPC');
            return winners;
        } catch (error) {
            console.error('Error getting past winners from RPC:', error);
            return [];
        }
    };

    return {
        connectWallet,
        getPot,
        getPlayerWins,
        getPlayerGuesses,
        getTokenBalance,
        getAllowance,
        approveTokens,
        makeGuess,
        getPastWinners,
        clearWinnersCache,
        isConnected,
        isLoading,
        account,
        contract
    };
}
