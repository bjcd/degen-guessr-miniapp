"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Trophy, Zap, TrendingUp, Crown, Sparkles } from "lucide-react";
import Image from "next/image";
import { SlotMachine } from "../components/SlotMachine";
import { useSlotContract } from "../hooks/useSlotContract";
import { useConfetti } from "../hooks/useConfetti";
import { useFarcaster } from "../farcaster-provider";
import { fetchFarcasterProfile, FarcasterProfile, setCurrentUserProfile } from "../lib/farcaster-profiles";
import { getRecentSlotWinners, getSlotPlayerStats, getPlayerAllSpins, type SpinResult as GraphSpinResult } from "../lib/graphql-slot";
import { sdk } from '@farcaster/miniapp-sdk';

interface SpinResult {
    id: number;
    reels: string[];
    won: boolean;
    amount: number;
    timestamp: Date;
}

interface Winner {
    id: string;
    address: string;
    amount: number;
    timestamp: Date;
    txHash: string;
    farcasterProfile?: FarcasterProfile;
}

interface LeaderboardEntry {
    address: string;
    wins: number;
    totalWon: number;
}

const SLOT_ICONS = ["🎰", "💎", "⭐", "👑", "🍒", "🔔", "💰", "🎲"];
const HAT_ICON = "🎩";

const Index = () => {
    const { isReady, user, signIn, isFarcasterEnvironment, addToFarcaster, isMiniAppAdded } = useFarcaster();
    const [pot, setPot] = useState(0);
    const [balance, setBalance] = useState(0);
    const [allowance, setAllowance] = useState(0);
    const [spinning, setSpinning] = useState(false);
    const [reels, setReels] = useState<string[]>(["⭐", "🎩", "🍒"]);
    const spinningRef = useRef(false);
    const refetchPlayerStatsRef = useRef<((playerAccount: string) => Promise<void>) | null>(null);
    const accountRef = useRef<string | null>(null);

    const [lastSpins, setLastSpins] = useState<SpinResult[]>([]);
    const [totalSpins, setTotalSpins] = useState(0);
    const [totalWinnings, setTotalWinnings] = useState(0);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [statusMessage, setStatusMessage] = useState("");
    const [jackpotText, setJackpotText] = useState("PLAY & WIN");
    const [finalReels, setFinalReels] = useState<string[]>([]);
    const [currentUserFarcasterProfile, setCurrentUserFarcasterProfile] = useState<FarcasterProfile | null>(null);
    const [gameConstants, setGameConstants] = useState({
        costPerSpin: 100,
        potAddPerSpin: 70,
        treasuryAddPerSpin: 30,
        initialPot: 7500
    });
    const [payouts, setPayouts] = useState({
        threeSamePayout: 500,
        twoSamePayout: 250,
        oneHatPayout: 50,
        twoHatsPayout: 350,
        jackpotShareBps: 5000
    });

    const [winners, setWinners] = useState<Winner[]>([]);
    const [winnersToShow, setWinnersToShow] = useState(5);
    const [leaderboard] = useState<LeaderboardEntry[]>([]);
    const [countdown, setCountdown] = useState(isFarcasterEnvironment ? 12 : 10);
    const [lastWinAmount, setLastWinAmount] = useState<number | null>(null);

    const { triggerConfetti } = useConfetti();

    // Share win on Farcaster
    const shareWinOnFarcaster = async (winAmount: number) => {
        if (!isFarcasterEnvironment || !sdk) {
            console.log('Not in Farcaster environment, skipping share');
            return;
        }

        try {
            const message = `I just won ${Math.floor(winAmount)} $DEGEN on Mega Degen 🎩 🥳

Who's next?

https://www.degenguessr.xyz`.trim();

            console.log('🎩 Sharing win on Farcaster:', message);

            await sdk.actions.composeCast({
                text: message
            });
        } catch (error) {
            console.error('Error sharing win on Farcaster:', error);
        }
    };

    // Initialize countdown to its starting value on mount
    useEffect(() => {
        const initialValue = isFarcasterEnvironment ? 12 : 10;
        setCountdown(initialValue);
        console.log('🎯 Initialized countdown to:', initialValue, '(Farcaster:', isFarcasterEnvironment, ')');
    }, [isFarcasterEnvironment]);

    // Function to fetch winners' Farcaster profiles
    const fetchWinnerProfiles = async (winnersToFetch: Winner[]): Promise<Winner[]> => {
        return await Promise.all(winnersToFetch.map(async (winner) => {
            try {
                const profile = await fetchFarcasterProfile(winner.address);
                return {
                    ...winner,
                    farcasterProfile: profile || undefined
                };
            } catch (error) {
                console.error('Error fetching winner profile:', error);
                return winner;
            }
        }));
    };

    // Function to fetch current user's Farcaster profile
    const fetchCurrentUserProfile = async (walletAddress: string) => {
        if (!isFarcasterEnvironment) {
            console.log('❌ Not in Farcaster environment, skipping current user profile fetch');
            return null;
        }

        try {
            console.log('🔍 Fetching current user Farcaster profile for:', walletAddress);
            const profile = await fetchFarcasterProfile(walletAddress);
            console.log('🔍 Current user profile result:', profile);
            return profile;
        } catch (error) {
            console.error('❌ Error fetching current user profile:', error);
            return null;
        }
    };

    // Create stable callbacks to prevent re-renders
    const onSpinResult = useCallback(async (roll: number, category: string, payout: string, potAfter: string) => {
        console.log('Spin result received:', { roll, category, payout, potAfter });

        // Check if we're still spinning (using ref to avoid stale closure)
        if (!spinningRef.current) {
            console.log('🎯 Not spinning anymore, ignoring VRF result');
            return;
        }

        // Determine final reel display based on category using deterministic VRF result
        let newReels: string[] = [];
        const nonHatIcons = SLOT_ICONS.filter(icon => icon !== HAT_ICON);

        if (category === "JACKPOT") {
            newReels = [HAT_ICON, HAT_ICON, HAT_ICON];
        } else if (category === "THREE_SAME") {
            const symbolIndex = Number(roll) % nonHatIcons.length;
            const symbol = nonHatIcons[symbolIndex];
            newReels = [symbol, symbol, symbol];
        } else if (category === "TWO_SAME") {
            const symbol1Index = Number(roll) % nonHatIcons.length;
            const symbol2Index = (Number(roll) + 1) % nonHatIcons.length;
            const symbol1 = nonHatIcons[symbol1Index];
            const symbol2 = nonHatIcons[symbol2Index];
            newReels = [symbol1, symbol1, symbol2];
        } else if (category === "ONE_HAT") {
            const symbol1Index = Number(roll) % nonHatIcons.length;
            const symbol2Index = (Number(roll) + 1) % nonHatIcons.length;
            const symbol3Index = (Number(roll) + 2) % nonHatIcons.length;
            const symbol1 = nonHatIcons[symbol1Index];
            const symbol2 = nonHatIcons[symbol2Index];
            const symbol3 = nonHatIcons[symbol3Index];
            const hatPosition = Number(roll) % 3;
            newReels = [symbol1, symbol2, symbol3];
            newReels[hatPosition] = HAT_ICON;
        } else if (category === "TWO_HATS") {
            const symbol1Index = Number(roll) % nonHatIcons.length;
            const symbol2Index = (Number(roll) + 1) % nonHatIcons.length;
            const symbol3Index = (Number(roll) + 2) % nonHatIcons.length;
            const symbol1 = nonHatIcons[symbol1Index];
            const symbol2 = nonHatIcons[symbol2Index];
            const symbol3 = nonHatIcons[symbol3Index];
            const hatPosition = Number(roll) % 3;
            newReels = [symbol1, symbol2, symbol3];
            // Place hats in the two positions that are NOT the hatPosition
            const otherPositions = [0, 1, 2].filter(i => i !== hatPosition);
            newReels[otherPositions[0]] = HAT_ICON;
            newReels[otherPositions[1]] = HAT_ICON;
        } else {
            // NOTHING - all different, no hats
            const symbol1Index = Number(roll) % nonHatIcons.length;
            const symbol2Index = (Number(roll) + 1) % nonHatIcons.length;
            const symbol3Index = (Number(roll) + 2) % nonHatIcons.length;
            newReels = [nonHatIcons[symbol1Index], nonHatIcons[symbol2Index], nonHatIcons[symbol3Index]];
        }

        // Store the final result but keep spinning
        console.log('🎯 VRF result received - keeping spinning:', newReels);
        setFinalReels(newReels);
        setPot(Number(potAfter));
        setLoadingMessage("");

        // Keep spinning for 1 second after VRF result for natural look, then start reveal
        setTimeout(() => {
            console.log('🎯 Starting graceful reveal of results:', newReels);

            // Reveal each emoji one by one with delays
            const revealDelays = [500, 1000, 1500]; // 0.5s, 1s, 1.5s delays

            newReels.forEach((emoji, index) => {
                setTimeout(() => {
                    console.log(`Revealing emoji ${index + 1}: ${emoji}`);

                    // Call the global reveal function instead of updating reels prop
                    if ((window as any).revealEmoji) {
                        (window as any).revealEmoji(index, emoji);
                    }

                    // Stop spinning after the last emoji is revealed
                    if (index === newReels.length - 1) {
                        setTimeout(() => {
                            console.log('🎯 All emojis revealed, stopping spinning');
                            setSpinning(false);
                            spinningRef.current = false;
                            // Update reels prop with final result so they persist
                            setReels(newReels);
                        }, 200); // Small delay after last emoji
                    }
                }, revealDelays[index]);
            });
        }, 1000); // 1 second delay after VRF result before starting reveal

        const winAmount = Number(payout);
        if (winAmount > 0) {
            // Record the spin
            const newSpin: SpinResult = {
                id: Date.now(),
                reels: newReels,
                won: true,
                amount: winAmount,
                timestamp: new Date(),
            };
            setLastSpins([newSpin, ...lastSpins.slice(0, 4)]);

            // Set state to show share button
            setLastWinAmount(winAmount);

            // Set status messages based on category
            if (category === "JACKPOT") {
                triggerConfetti();
                setJackpotText("JACKPOT!! 🎩 🎩");
                setStatusMessage("");
                shareWinOnFarcaster(winAmount);
            } else if (category === "THREE_SAME") {
                triggerConfetti();
                setJackpotText("WON 500 DEGEN 🎩");
                setStatusMessage("");
                shareWinOnFarcaster(winAmount);
            } else if (category === "TWO_SAME") {
                triggerConfetti();
                setJackpotText("WON 250 DEGEN 🎩");
                setStatusMessage("");
                shareWinOnFarcaster(winAmount);
            } else if (category === "ONE_HAT") {
                triggerConfetti();
                setJackpotText("WON 50 DEGEN 🎩");
                setStatusMessage("");
                shareWinOnFarcaster(winAmount);
            } else if (category === "TWO_HATS") {
                triggerConfetti();
                setJackpotText("WON 350 DEGEN 🎩");
                setStatusMessage("");
                shareWinOnFarcaster(winAmount);
            }

            // Reload user data after win
            if (accountRef.current) {
                console.log('💾 Calling refetchPlayerStats after win, account:', accountRef.current);
                console.log('💾 refetchPlayerStats type:', typeof refetchPlayerStatsRef.current);
                if (typeof refetchPlayerStatsRef.current === 'function') {
                    refetchPlayerStatsRef.current(accountRef.current);
                } else {
                    console.error('❌ refetchPlayerStats is not a function!');
                }
            }
        } else {
            // Record the spin
            const newSpin: SpinResult = {
                id: Date.now(),
                reels: newReels,
                won: false,
                amount: 0,
                timestamp: new Date(),
            };
            setLastSpins([newSpin, ...lastSpins.slice(0, 4)]);

            setJackpotText("NO LUCK. TRY AGAIN");
            setStatusMessage("");

            // Reload user data after no-win spin
            if (accountRef.current) {
                console.log('💾 Calling refetchPlayerStats after no-win, account:', accountRef.current);
                console.log('💾 refetchPlayerStats type:', typeof refetchPlayerStatsRef.current);
                if (typeof refetchPlayerStatsRef.current === 'function') {
                    refetchPlayerStatsRef.current(accountRef.current);
                } else {
                    console.error('❌ refetchPlayerStats is not a function!');
                }
            }
        }
    }, [triggerConfetti]);

    const onError = useCallback((message: string) => {
        setLoadingMessage(message);
        setSpinning(false);
        spinningRef.current = false;
        setStatusMessage("");
    }, []);

    const {
        connectWallet,
        getPot,
        getTokenBalance,
        getAllowance,
        approveTokens,
        spin,
        getGameConstants: fetchGameConstants,
        getPayouts: fetchPayouts,
        getPlayerSpins,
        getPlayerWinnings,
        isConnected,
        isLoading,
        account
    } = useSlotContract({
        onSpinResult,
        onError
    });

    // Memoized function to refetch player stats after VRF result
    // Includes delay for subgraph indexing lag
    const refetchPlayerStats = useCallback(async (playerAccount: string) => {
        try {
            console.log('🔄 Refetching player stats for:', playerAccount);

            // Wait for subgraph indexing lag (The Graph typically has 10-30s delay)
            // Start with 3 seconds, retry up to 3 times with increasing delays
            let attempt = 0;
            const maxAttempts = 3;
            let playerStats = null;
            let allSpins: any[] = [];

            while (attempt < maxAttempts) {
                const delayMs = 3000 + (attempt * 2000); // 3s, 5s, 7s
                console.log(`⏳ Waiting ${delayMs}ms for subgraph indexing (attempt ${attempt + 1}/${maxAttempts})...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));

                try {
                    [playerStats, allSpins] = await Promise.all([
                        getSlotPlayerStats(playerAccount).catch(() => null),
                        getPlayerAllSpins(playerAccount).catch(() => [])
                    ]);

                    // If we got data from subgraph, break out of retry loop
                    if (playerStats || (allSpins && allSpins.length > 0)) {
                        console.log(`✅ Subgraph data found on attempt ${attempt + 1}`);
                        break;
                    }
                } catch (error) {
                    console.log(`⚠️ Attempt ${attempt + 1} failed, retrying...`);
                }

                attempt++;
            }

            // Fetch balance and allowance immediately (these are on-chain reads)
            const [balanceValue, allowanceValue] = await Promise.all([
                getTokenBalance(),
                getAllowance()
            ]);

            let spinsValue = 0;
            let winningsValue = 0;

            if (playerStats) {
                spinsValue = playerStats.totalSpins;
                winningsValue = parseFloat(playerStats.totalWinnings) / 1e18;
            } else if (allSpins && allSpins.length > 0) {
                spinsValue = allSpins.length;
                winningsValue = allSpins.reduce((sum, spin) => sum + parseFloat(spin.payout) / 1e18, 0);
            } else {
                // Fallback to RPC if subgraph completely fails
                console.log('📊 Subgraph unavailable, falling back to RPC...');
                const [rpcSpins, rpcWinnings] = await Promise.all([
                    getPlayerSpins(playerAccount),
                    getPlayerWinnings(playerAccount)
                ]);
                spinsValue = rpcSpins;
                winningsValue = rpcWinnings;
            }

            setBalance(balanceValue);
            setAllowance(allowanceValue);
            setTotalSpins(spinsValue);
            setTotalWinnings(winningsValue);
            console.log('✅ Refetched player stats - Spins:', spinsValue, 'Winnings:', winningsValue);
        } catch (error) {
            console.error('❌ Error refetching player stats:', error);
        }
    }, [getTokenBalance, getAllowance, getPlayerSpins, getPlayerWinnings]);

    // Assign refetchPlayerStats to the ref so onSpinResult can call it
    useEffect(() => {
        refetchPlayerStatsRef.current = refetchPlayerStats;
    }, [refetchPlayerStats]);

    // Debug: Log state changes
    useEffect(() => {
        console.log('📊 State update - totalSpins:', totalSpins, 'totalWinnings:', totalWinnings);
    }, [totalSpins, totalWinnings]);

    // Load public data (pot, treasury, game constants)
    const loadPublicData = async () => {
        try {
            const [potValue, constants, payoutsData, graphWinners] = await Promise.all([
                getPot(),
                fetchGameConstants(),
                fetchPayouts(),
                getRecentSlotWinners(1000, 0).catch(() => [])
            ]);

            setPot(potValue);
            setGameConstants(constants);
            setPayouts(payoutsData);

            // Convert GraphQL winners to our format
            if (graphWinners.length > 0) {
                console.log('🏆 Fetched', graphWinners.length, 'winners from subgraph');
                const formattedWinners: Winner[] = graphWinners.map((winner: GraphSpinResult) => ({
                    id: winner.id,
                    address: winner.player,
                    amount: parseFloat(winner.payout) / 1e18,
                    timestamp: new Date(parseInt(winner.timestamp) * 1000),
                    txHash: winner.tx
                }));

                const winnersWithProfiles = await fetchWinnerProfiles(formattedWinners);
                console.log('🏆 After fetching profiles, we have', winnersWithProfiles.length, 'winners');
                setWinners(winnersWithProfiles);
            } else {
                console.log('🏆 No winners found from subgraph');
            }
        } catch (error) {
            console.error('Error loading public data:', error);
        }
    };

    // Load data on mount and when account changes
    useEffect(() => {
        loadPublicData();
    }, []);

    // Countdown starts AFTER wallet connection, not at page load
    useEffect(() => {
        if (!account) {
            console.log('🎯 No account yet, countdown not started');
            return;
        }

        console.log('🎯 Wallet connected! Starting countdown timer - initial countdown value:', countdown);

        let currentCount = countdown;
        const interval = setInterval(() => {
            currentCount--;
            console.log('🎯 Setting countdown to:', currentCount);
            setCountdown(currentCount);

            if (currentCount <= 0) {
                console.log('🎯 Countdown complete! Button should be enabled now.');
                clearInterval(interval);
            }
        }, 1000);

        return () => {
            console.log('🎯 Cleaning up countdown timer');
            clearInterval(interval);
        };
    }, [account]); // Depends on account - starts when wallet connects

    useEffect(() => {
        if (account) {
            const loadUserData = async () => {
                try {
                    console.log('🎯 Loading user data for account:', account);

                    const [balanceValue, allowanceValue, playerStats, allSpins] = await Promise.all([
                        getTokenBalance(),
                        getAllowance(),
                        getSlotPlayerStats(account).catch(() => null),
                        getPlayerAllSpins(account).catch(() => [])
                    ]);

                    let spinsValue = 0;
                    let winningsValue = 0;

                    // Try aggregated stats first
                    if (playerStats) {
                        spinsValue = playerStats.totalSpins;
                        winningsValue = parseFloat(playerStats.totalWinnings) / 1e18;
                        console.log('🎯 Loaded stats from subgraph (aggregated):', { spinsValue, winningsValue });
                    } else if (allSpins && allSpins.length > 0) {
                        // Fall back to counting individual spins
                        spinsValue = allSpins.length;
                        winningsValue = allSpins.reduce((sum, spin) => sum + parseFloat(spin.payout) / 1e18, 0);
                        console.log('🎯 Loaded stats from subgraph (individual spins):', { spinsValue, winningsValue });
                    } else {
                        // Fall back to RPC if subgraph fails
                        const [rpcSpins, rpcWinnings] = await Promise.all([
                            getPlayerSpins(account),
                            getPlayerWinnings(account)
                        ]);
                        spinsValue = rpcSpins;
                        winningsValue = rpcWinnings;
                        console.log('🎯 Loaded stats from RPC fallback:', { spinsValue, winningsValue });
                    }

                    console.log('🎯 User data loaded:', { balanceValue, allowanceValue, spinsValue, winningsValue });
                    setBalance(balanceValue);
                    setAllowance(allowanceValue);
                    setTotalSpins(spinsValue);
                    setTotalWinnings(winningsValue);
                } catch (error) {
                    console.error('Error loading user data:', error);
                }
            };
            loadUserData();
        }
    }, [account]);

    // Auto-connect wallet in Farcaster environment
    useEffect(() => {
        console.log('Auto-connect useEffect triggered:', {
            isReady,
            isFarcasterEnvironment,
            isConnected,
            isLoading,
            connectWallet: typeof connectWallet
        });

        if (isReady && isFarcasterEnvironment && !isConnected) {
            console.log('🚀 Auto-connecting wallet in Farcaster environment...');
            connectWallet();
        } else {
            console.log('❌ Auto-connect conditions not met:', {
                isReady,
                isFarcasterEnvironment,
                isConnected,
                isLoading
            });
        }
    }, [isReady, isFarcasterEnvironment, isConnected, connectWallet]);

    useEffect(() => {
        if (isConnected && account) {
            // Fetch current user's Farcaster profile
            if (isFarcasterEnvironment) {
                fetchCurrentUserProfile(account).then(profile => {
                    setCurrentUserFarcasterProfile(profile);
                });
            }

            // Set current user profile for Farcaster context
            if (isFarcasterEnvironment && user) {
                console.log('🔧 Setting current user profile from SDK context:', { user, account });
                setCurrentUserProfile(user, account);
            }
        }
    }, [isConnected, account, isFarcasterEnvironment, user]);

    useEffect(() => {
        accountRef.current = account;
    }, [account]);

    const handleSpin = async () => {
        if (spinning || !isConnected) return;

        // Check if user has enough balance
        if (balance < gameConstants.costPerSpin) {
            alert(`Insufficient balance! You need ${gameConstants.costPerSpin} $DEGEN to spin.`);
            return;
        }

        // Check if user has enough allowance
        if (allowance < 100) {
            alert(`Insufficient allowance! Please approve at least 100 $DEGEN first.`);
            return;
        }

        console.log('🎯 Starting spin - setting spinning to true');
        setSpinning(true);
        spinningRef.current = true;
        setJackpotText("SPINNING...");
        setFinalReels([]); // Clear final reels
        setLastWinAmount(null); // Clear share button

        const success = await spin();
        if (!success) {
            console.log('🎯 Spin failed - stopping spinning');
            setSpinning(false);
            spinningRef.current = false;
            setJackpotText("PLAY TO WIN");
        } else {
            console.log('🎯 Spin transaction successful - keeping spinning until VRF result');
            setJackpotText("Getting results...");
        }
    };

    const handleApprove = async () => {
        if (!isConnected) return;

        setLoadingMessage("Approving tokens...");
        const approvalAmount = Math.ceil(gameConstants.costPerSpin * 1.1); // 10% buffer
        console.log(`🎯 Approving ${approvalAmount} DEGEN (cost is ${gameConstants.costPerSpin})`);
        const success = await approveTokens(approvalAmount.toString());
        setLoadingMessage("");

        if (success) {
            if (account) {
                try {
                    const [balanceValue, allowanceValue] = await Promise.all([
                        getTokenBalance(),
                        getAllowance()
                    ]);

                    setBalance(balanceValue);
                    setAllowance(allowanceValue);
                } catch (error) {
                    console.error('Error loading user data:', error);
                }
            }
        }
    };

    const handleConnect = async () => {
        if (isFarcasterEnvironment) {
            await signIn();
        } else {
            await connectWallet();
        }
    };

    const handlePreApprove = async (amount: number) => {
        if (!isConnected) {
            await handleConnect();
            return;
        }

        try {
            setLoadingMessage(`Approving ${amount} DEGEN...`);
            const success = await approveTokens(amount.toString());
            if (success) {
                setLoadingMessage(`✅ Approval successful!`);
                await new Promise(resolve => setTimeout(resolve, 500));
                const allowanceAmount = await getAllowance();
                setAllowance(allowanceAmount);
                setTimeout(() => setLoadingMessage(''), 2000);
            } else {
                setLoadingMessage('❌ Approval failed. Please try again.');
                setTimeout(() => setLoadingMessage(''), 2000);
            }
        } catch (error) {
            console.error('Error pre-approving tokens:', error);
            setLoadingMessage('❌ Approval failed: ' + (error as Error).message);
            setTimeout(() => setLoadingMessage(''), 2000);
        }
    };

    const handleRevoke = async () => {
        if (!isConnected) {
            await handleConnect();
            return;
        }

        try {
            setLoadingMessage('Revoking approval...');
            const success = await approveTokens('0');
            if (success) {
                setLoadingMessage('✅ Approval revoked!');
                await new Promise(resolve => setTimeout(resolve, 500));
                const allowanceAmount = await getAllowance();
                setAllowance(allowanceAmount);
                setTimeout(() => setLoadingMessage(''), 2000);
            } else {
                setLoadingMessage('❌ Revocation failed. Please try again.');
                setTimeout(() => setLoadingMessage(''), 2000);
            }
        } catch (error) {
            console.error('Error revoking approval:', error);
            setLoadingMessage('❌ Revocation failed: ' + (error as Error).message);
            setTimeout(() => setLoadingMessage(''), 2000);
        }
    };

    console.log('Page render - isReady:', isReady, 'user:', user);

    if (!isReady) {
        console.log('Showing loading screen');
        return (
            <main className="min-h-screen bg-gradient-to-br from-background via-[hsl(270_50%_10%)] to-background flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground">Loading DEGEN SLOTS...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-background via-[hsl(270_50%_10%)] to-background p-4 py-8">
            <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
                {/* Header with Logo and Wallet Connection */}
                <div className="text-center space-y-3">
                    <div className="flex items-center justify-center gap-3">
                        <Image src="/degen-logo.png" alt="Degen Hat" width={64} height={64} className="object-contain animate-[bounce_2s_ease-in-out_infinite]" />
                        <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent neon-glow">
                            DEGEN GUESSR
                        </h1>
                        <Image src="/degen-logo.png" alt="Degen Hat" width={64} height={64} className="object-contain animate-[bounce_2s_ease-in-out_infinite] scale-x-[-1]" />
                    </div>
                    <p className="text-muted-foreground text-sm font-medium">Spin the reels. Match three hats. Win the jackpot.</p>

                    {/* Connection Status */}
                    <div className="flex items-center justify-center gap-4">
                        {isConnected ? (
                            <div className="text-white text-sm font-bold flex items-center gap-2">
                                {isFarcasterEnvironment && currentUserFarcasterProfile ? (
                                    <div className="flex items-center gap-2">
                                        <img
                                            src={currentUserFarcasterProfile.pfpUrl || '/default-avatar.png'}
                                            alt="Profile"
                                            className="w-6 h-6 rounded-full"
                                            onError={(e) => {
                                                e.currentTarget.src = '/default-avatar.png';
                                            }}
                                        />
                                        <span>@{currentUserFarcasterProfile.username}</span>
                                    </div>
                                ) : (
                                    <span>Connected: {account?.slice(0, 6)}...{account?.slice(-4)}</span>
                                )}
                            </div>
                        ) : (
                            <Button onClick={handleConnect} className="btn-primary">
                                Connect Wallet
                            </Button>
                        )}
                    </div>

                    {/* Add to Farcaster button */}
                    {isFarcasterEnvironment && !isMiniAppAdded && (
                        <div className="flex justify-center">
                            <Button
                                onClick={addToFarcaster}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                📱 Add miniapp to Farcaster
                            </Button>
                        </div>
                    )}

                    {/* Show success message if mini app is already added */}
                    {isFarcasterEnvironment && isMiniAppAdded && (
                        <div className="flex justify-center">
                            <div className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg">
                                ✅ Added to Farcaster
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Left Column - Main Game */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Pot Display */}
                        <Card className="glass-card gradient-border p-6 md:p-8 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/20 animate-[pulse_3s_ease-in-out_infinite]" />
                            <div className="relative z-10 text-center space-y-3">
                                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm font-semibold">
                                    <Trophy className="w-5 h-5" />
                                    <span>JACKPOT PRIZE</span>
                                    <Trophy className="w-5 h-5" />
                                </div>
                                <div className="text-5xl md:text-7xl font-black bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent neon-glow">
                                    {pot}
                                </div>
                                <div className="text-2xl font-bold text-primary">$DEGEN</div>
                            </div>
                        </Card>

                        {/* Slot Machine */}
                        <SlotMachine
                            spinning={spinning}
                            reels={reels}
                            jackpotText={jackpotText}
                            onSpinComplete={() => { }}
                            onRevealEmoji={() => { }}
                        />

                        {/* Wallet Connection */}
                        {!isConnected ? (
                            <Button
                                onClick={handleConnect}
                                disabled={isLoading}
                                className="w-full h-16 md:h-20 bg-gradient-to-r from-primary to-secondary hover:from-primary-glow hover:to-secondary-glow text-white font-black text-xl md:text-2xl transition-all duration-300 neon-button rounded-2xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Zap className="w-6 h-6" />
                                {isLoading ? "CONNECTING..." : "CONNECT WALLET"}
                                <Zap className="w-6 h-6" />
                            </Button>
                        ) : (
                            <>
                                {/* Approval Button */}
                                {(account && allowance < 110 && gameConstants.costPerSpin > 0) && (
                                    <Button
                                        onClick={handleApprove}
                                        disabled={isLoading}
                                        className="w-full h-16 md:h-20 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-black text-xl md:text-2xl transition-all duration-300 neon-button rounded-2xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Zap className="w-6 h-6" />
                                        {isLoading ? "APPROVING..." : `APPROVE ${gameConstants.costPerSpin} $DEGEN`}
                                        <Zap className="w-6 h-6" />
                                    </Button>
                                )}

                                {/* Share Win Button */}
                                {lastWinAmount !== null && isFarcasterEnvironment && (
                                    <Button
                                        onClick={() => shareWinOnFarcaster(lastWinAmount)}
                                        className="w-full h-16 md:h-20 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-black text-lg md:text-xl transition-all duration-300 neon-button rounded-2xl flex items-center justify-center gap-2 animate-pulse"
                                    >
                                        🎩 YOU WON, SHARE THE NEWS 🔥
                                    </Button>
                                )}

                                {/* Spin Button */}
                                <Button
                                    onClick={handleSpin}
                                    disabled={countdown > 0 || spinning || isLoading}
                                    className="w-full h-16 md:h-20 bg-gradient-to-r from-primary to-secondary hover:from-primary-glow hover:to-secondary-glow text-white font-black text-xl md:text-2xl transition-all duration-300 neon-button rounded-2xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Image src="/degen-logo.png" alt="Hat" width={32} height={32} className="object-contain" />
                                    <Zap className="w-6 h-6" />
                                    {spinning
                                        ? "SPINNING..."
                                        : countdown > 0
                                            ? `PLAY IN ${countdown}...`
                                            : `SPIN FOR ${gameConstants.costPerSpin} $DEGEN`}
                                    <Zap className="w-6 h-6" />
                                </Button>
                            </>
                        )}

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="glass-card gradient-border p-5">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
                                    <Zap className="w-4 h-4" />
                                    <span>TOTAL SPINS</span>
                                </div>
                                <div className="text-4xl font-black text-foreground">{totalSpins}</div>
                            </Card>

                            <Card className="glass-card gradient-border p-5">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
                                    <Trophy className="w-4 h-4 text-yellow-400" />
                                    <span>TOTAL WINNINGS</span>
                                </div>
                                <div className="text-4xl font-black text-foreground">{Math.floor(totalWinnings)}</div>
                                <div className="text-xs text-muted-foreground">$DEGEN</div>
                            </Card>
                        </div>

                        {/* Your Balance */}
                        <Card className="glass-card gradient-border p-5">
                            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
                                <TrendingUp className="w-4 h-4" />
                                <span>YOUR BALANCE</span>
                            </div>
                            <div className="text-4xl font-black text-foreground">{balance.toFixed(2)}</div>
                            <div className="text-xs text-muted-foreground">$DEGEN</div>
                        </Card>

                        {/* Recent Spins */}
                        {lastSpins.length > 0 && (
                            <Card className="glass-card gradient-border p-5">
                                <div className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    Recent Spins
                                </div>
                                <div className="space-y-2">
                                    {lastSpins.map((spin, index) => (
                                        <div
                                            key={spin.id}
                                            className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-primary/20 animate-slide-in hover:bg-muted/60 transition-colors"
                                            style={{ animationDelay: `${index * 0.1}s` }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex gap-2 text-3xl">
                                                    {spin.reels.map((reel, i) => (
                                                        <span key={i}>{reel}</span>
                                                    ))}
                                                </div>
                                                {spin.won && (
                                                    <span className="text-xs font-bold text-primary">+{spin.amount}</span>
                                                )}
                                            </div>
                                            <span className="text-xs text-muted-foreground font-medium">
                                                {spin.timestamp.toLocaleTimeString('en-US')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}
                    </div>

                    {/* Right Column - Info */}
                    <div className="space-y-6">
                        {/* Pre-approval Section */}
                        {isConnected && (
                            <Card className="glass-card gradient-border p-6 space-y-4">
                                <div className="text-center space-y-2">
                                    <h3 className="text-xl font-bold text-foreground">Pre-approve to spin faster</h3>
                                    <p className="text-sm text-muted-foreground">Your allowance is {allowance.toFixed(0)} DEGEN</p>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <Button
                                        onClick={() => handlePreApprove(1000)}
                                        className="h-12 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-bold text-sm transition-all duration-300 rounded-xl"
                                        disabled={spinning || isLoading}
                                    >
                                        1000 DEGEN
                                    </Button>

                                    <Button
                                        onClick={() => handlePreApprove(8000)}
                                        className="h-12 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-bold text-sm transition-all duration-300 rounded-xl"
                                        disabled={spinning || isLoading}
                                    >
                                        8000 DEGEN
                                    </Button>

                                    <Button
                                        onClick={handleRevoke}
                                        className="h-12 bg-gradient-to-r from-primary/80 to-secondary/80 hover:from-primary/70 hover:to-secondary/70 text-white font-bold text-sm transition-all duration-300 rounded-xl"
                                        disabled={spinning || isLoading}
                                    >
                                        Revoke
                                    </Button>
                                </div>
                            </Card>
                        )}

                        {/* Last Winners */}
                        <Card className="glass-card gradient-border p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Trophy className="w-5 h-5 text-secondary" />
                                <h2 className="text-lg font-black text-foreground">LAST WINNERS</h2>
                            </div>
                            <div className="space-y-3">
                                {winners.length === 0 ? (
                                    <div className="p-6 text-center bg-muted/20 rounded-lg border border-primary/10">
                                        <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                                        <p className="text-sm text-muted-foreground">No winners yet!</p>
                                        <p className="text-xs text-muted-foreground/70 mt-1">Be the first to hit the jackpot 🎩</p>
                                    </div>
                                ) : (
                                    <>
                                        {winners.slice(0, winnersToShow).map((winner, index) => (
                                            <div
                                                key={winner.id}
                                                className="p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/30 hover:border-primary/50 transition-colors"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        {winner.farcasterProfile ? (
                                                            <>
                                                                <div className="relative">
                                                                    <Image
                                                                        src={winner.farcasterProfile.pfpUrl}
                                                                        alt={winner.farcasterProfile.displayName}
                                                                        width={24}
                                                                        height={24}
                                                                        className="w-6 h-6 rounded-full border border-primary/20"
                                                                        onError={(e) => {
                                                                            console.log('Failed to load profile image for:', winner.farcasterProfile?.displayName);
                                                                            // Fallback to a default avatar
                                                                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/24x24/6366f1/ffffff?text=' + (winner.farcasterProfile?.displayName?.charAt(0) || '?');
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-bold text-foreground">
                                                                        {winner.farcasterProfile.displayName}
                                                                    </span>
                                                                    {winner.farcasterProfile.fid > 0 && (
                                                                        <span className="text-xs text-muted-foreground">
                                                                            @{winner.farcasterProfile.username}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                                                                    <span className="text-xs font-bold text-muted-foreground">
                                                                        {winner.address.slice(2, 4).toUpperCase()}
                                                                    </span>
                                                                </div>
                                                                <span className="text-sm font-bold text-foreground font-mono">
                                                                    {winner.address.slice(0, 6)}...{winner.address.slice(-4)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Trophy className={`w-4 h-4 ${index === 0 ? 'text-yellow-400 animate-pulse' : 'text-primary'}`} />
                                                </div>
                                                <div className="flex items-center justify-between mb-2">
                                                    {winner.txHash ? (
                                                        <a
                                                            href={`https://basescan.org/tx/${winner.txHash}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-primary hover:text-primary/80 underline transition-colors"
                                                        >
                                                            View TX
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">
                                                            {winner.timestamp.toLocaleTimeString()}
                                                        </span>
                                                    )}
                                                    <span className="text-lg font-black text-primary">
                                                        {winner.amount % 1 === 0 ? winner.amount.toString() : winner.amount.toFixed(2)} $DEGEN
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {winnersToShow < winners.length && (
                                            <div className="flex justify-center mt-4">
                                                <button
                                                    onClick={() => setWinnersToShow(prev => Math.min(prev + 5, winners.length))}
                                                    className="px-6 py-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-white text-sm font-bold rounded-lg transition-all duration-200 transform hover:scale-105"
                                                >
                                                    Load More Winners ({Math.min(5, winners.length - winnersToShow)} more of {winners.length} total)
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </Card>

                        {/* How to Play */}
                        <Card className="glass-card border border-muted/30 p-4">
                            <div className="text-xs font-medium text-muted-foreground space-y-2">
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">🎩🎩🎩</span>
                                    Three hats = JACKPOT ({payouts.jackpotShareBps / 100}% of pot)
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">🎰🎰🎰</span>
                                    Three same = {payouts.threeSamePayout} $DEGEN
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">🎩🎩</span>
                                    Two hats = {payouts.twoHatsPayout} $DEGEN
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">💎💎</span>
                                    Two same = {payouts.twoSamePayout} $DEGEN
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">🎩</span>
                                    One hat = {payouts.oneHatPayout} $DEGEN
                                </p>
                                <br /><p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">⚡</span>
                                    Each spin costs {gameConstants.costPerSpin} $DEGEN
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">💰</span>
                                    {gameConstants.potAddPerSpin} added to jackpot
                                </p>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Index;