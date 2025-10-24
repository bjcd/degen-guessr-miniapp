"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Trophy, Zap, TrendingUp, Sparkles, ArrowLeft } from "lucide-react";
import { useFarcaster } from "../farcaster-provider";
import { useContract } from "../hooks/useContract";
import Image from "next/image";
import Link from "next/link";
import { fetchFarcasterProfile, FarcasterProfile, setCurrentUserProfile } from "../lib/farcaster-profiles";
import { useConfetti } from "../hooks/useConfetti";

interface Attempt {
    id: number;
    guess: number;
    timestamp: Date;
}

interface Winner {
    id: number;
    address: string;
    amount: number;
    timestamp: Date;
    txHash?: string;
    farcasterProfile?: FarcasterProfile;
}

const DEGEN_TOKEN = process.env.NEXT_PUBLIC_DEGEN_TOKEN_ADDRESS || '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed';
const SUPER_DEGEN_CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_1000_ADDRESS || '0x0000000000000000000000000000000000000000';

// Debug logging
console.log('Environment variables:');
console.log('NEXT_PUBLIC_CONTRACT_1000_ADDRESS:', process.env.NEXT_PUBLIC_CONTRACT_1000_ADDRESS);
console.log('NEXT_PUBLIC_DEGEN_TOKEN_ADDRESS:', process.env.NEXT_PUBLIC_DEGEN_TOKEN_ADDRESS);
console.log('SUPER_DEGEN_CONTRACT:', SUPER_DEGEN_CONTRACT);
console.log('DEGEN_TOKEN:', DEGEN_TOKEN);

export default function SuperDegenHome() {
    const { isReady, user, signIn, signOut, isFarcasterEnvironment, addToFarcaster, isMiniAppAdded } = useFarcaster();
    const { triggerConfetti } = useConfetti();

    const [guess, setGuess] = useState("");
    const [pot, setPot] = useState(0);
    const [tokenBalance, setTokenBalance] = useState(0);
    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const [totalGuesses, setTotalGuesses] = useState(0);
    const [playerWins, setPlayerWins] = useState(0);
    const [isWinning, setIsWinning] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState<string>("");
    const loadedAccountRef = useRef<string | null>(null);
    const [winners, setWinners] = useState<Winner[]>([]);
    const [allowance, setAllowance] = useState(0);
    const loadedAllowanceRef = useRef<string | null>(null);
    const [isLoadingPot, setIsLoadingPot] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [currentUserFarcasterProfile, setCurrentUserFarcasterProfile] = useState<FarcasterProfile | null>(null);
    const [winnersToShow, setWinnersToShow] = useState(5);

    // Simple ref to track the current contract/account combo to avoid duplicate loads
    const currentContextRef = useRef<string>('');

    const isDemoMode = SUPER_DEGEN_CONTRACT === '0x0000000000000000000000000000000000000000';

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

    // Function to fetch Farcaster profiles for winners
    const fetchWinnerProfiles = async (winners: Winner[]) => {
        if (!isFarcasterEnvironment) {
            console.log('Not in Farcaster environment, skipping profile fetch');
            return winners;
        }

        console.log('Fetching Farcaster profiles for', winners.length, 'winners');

        const updatedWinners = await Promise.all(
            winners.map(async (winner) => {
                try {
                    const profile = await fetchFarcasterProfile(winner.address);
                    if (profile) {
                        console.log('Found Farcaster profile for winner:', winner.address, '->', profile.displayName);
                    } else {
                        console.log('No Farcaster profile found for winner:', winner.address);
                    }
                    return {
                        ...winner,
                        farcasterProfile: profile || undefined
                    };
                } catch (error) {
                    console.error('Error fetching profile for winner:', winner.address, error);
                    return winner;
                }
            })
        );

        return updatedWinners;
    };

    const {
        connectWallet,
        getPot,
        getPlayerGuesses,
        getPlayerWins,
        getTokenBalance,
        getAllowance,
        approveTokens,
        makeGuess,
        getPastWinners,
        clearWinnersCache,
        isConnected,
        isLoading,
        account
    } = useContract({
        onWin: async (guessedNumber, amount, winnerAddress, txHash) => {
            setLoadingMessage(`🎉 WINNER! You guessed ${guessedNumber} correctly! You won ${amount} DEGEN!`);

            // Trigger confetti celebration! 🎉
            triggerConfetti();

            // Clear cache to ensure fresh data
            clearWinnersCache();

            // Add to winners list
            const newWinner: Winner = {
                id: Date.now(),
                address: winnerAddress,
                amount: parseFloat(amount),
                timestamp: new Date(),
                txHash: txHash
            };
            setWinners(prev => [newWinner, ...prev].slice(0, 10)); // Keep last 10 winners

            setTimeout(async () => {
                setLoadingMessage('');
                setIsWinning(false);
                // Reload user data after win
                try {
                    const [balance, guesses, wins, allowanceAmount, potValue] = await Promise.all([
                        getTokenBalance(),
                        getPlayerGuesses(account!),
                        getPlayerWins(account!),
                        getAllowance(),
                        getPot()
                    ]);
                    setTokenBalance(balance);
                    setTotalGuesses(guesses);
                    setPlayerWins(wins);
                    setAllowance(allowanceAmount);
                    setPot(potValue);
                } catch (error) {
                    console.error('Error reloading data after win:', error);
                }
            }, 5000);
        },
        onMiss: async (guessedNumber, winningNumber) => {
            setLoadingMessage(`Not quite... ${guessedNumber} wasn't it. The winning number was ${winningNumber}. Try again!`);

            // Clear cache to ensure fresh data
            clearWinnersCache();

            setTimeout(async () => {
                setLoadingMessage('');
                setIsWinning(false);
                // Reload user data after miss
                try {
                    const [balance, guesses, wins, allowanceAmount, potValue] = await Promise.all([
                        getTokenBalance(),
                        getPlayerGuesses(account!),
                        getPlayerWins(account!),
                        getAllowance(),
                        getPot()
                    ]);
                    setTokenBalance(balance);
                    setTotalGuesses(guesses);
                    setPlayerWins(wins);
                    setAllowance(allowanceAmount);
                    setPot(potValue);
                } catch (error) {
                    console.error('Error reloading data after miss:', error);
                }
            }, 3000);
        },
        onError: (message) => {
            setLoadingMessage(`❌ ${message}`);
            setTimeout(() => {
                setLoadingMessage('');
            }, 5000);
        }
    }, SUPER_DEGEN_CONTRACT); // Use Super Degen contract

    // Load pot and winners immediately on mount - PUBLIC DATA
    useEffect(() => {
        if (isDemoMode) return;

        const loadPublicData = async () => {
            try {
                setIsLoadingData(true);
                const [potValue, pastWinners] = await Promise.all([
                    getPot(),
                    getPastWinners(10)
                ]);

                setPot(potValue);

                const formattedWinners: Winner[] = pastWinners.map((winner, index) => ({
                    id: Date.now() - index,
                    address: winner.player,
                    amount: parseFloat(winner.amount),
                    timestamp: winner.timestamp,
                    txHash: winner.txHash
                }));

                const winnersWithProfiles = await fetchWinnerProfiles(formattedWinners);
                setWinners(winnersWithProfiles);
            } catch (error) {
                console.error('Error loading public data:', error);
            } finally {
                setIsLoadingData(false);
            }
        };

        loadPublicData();
    }, [isDemoMode, isFarcasterEnvironment]);

    // Load personal data ONLY when wallet connects - USER DATA
    useEffect(() => {
        if (!isConnected || !account || isDemoMode) {
            setTokenBalance(0);
            setTotalGuesses(0);
            setPlayerWins(0);
            setAllowance(0);
            return;
        }

        const handle = setTimeout(async () => {
            try {
                const [balance, guesses, wins, allowanceAmount] = await Promise.all([
                    getTokenBalance(),
                    getPlayerGuesses(account),
                    getPlayerWins(account),
                    getAllowance()
                ]);

                setTokenBalance(balance);
                setTotalGuesses(guesses);
                setPlayerWins(wins);
                setAllowance(allowanceAmount);

                // Set current user profile for Farcaster context
                if (isFarcasterEnvironment && user) {
                    setCurrentUserProfile(user, account);
                }

                // Fetch current user's Farcaster profile for display
                if (isFarcasterEnvironment) {
                    fetchCurrentUserProfile(account).then(profile => {
                        setCurrentUserFarcasterProfile(profile);
                    });
                }

                console.log('✅ User data loaded - Balance:', balance, 'Guesses:', guesses, 'Wins:', wins, 'Allowance:', allowanceAmount);
            } catch (error) {
                console.error('Error loading user data:', error);
            }
        }, 400);

        return () => clearTimeout(handle);
    }, [isConnected, account, isDemoMode, isFarcasterEnvironment, user]);

    // Auto-connect wallet in Farcaster environment
    useEffect(() => {
        console.log('Super Degen Auto-connect useEffect triggered:', {
            isReady,
            isFarcasterEnvironment,
            isConnected,
            isLoading,
            connectWallet: typeof connectWallet
        });

        if (isReady && isFarcasterEnvironment && !isConnected) {
            console.log('🚀 Super Degen Auto-connecting wallet in Farcaster environment...');
            connectWallet();
        } else {
            console.log('❌ Super Degen Auto-connect conditions not met:', {
                isReady,
                isFarcasterEnvironment,
                isConnected,
                isLoading
            });
        }
    }, [isReady, isFarcasterEnvironment, isConnected, connectWallet]);

    const handleApprove = async () => {
        if (!isConnected) {
            await connectWallet();
            return;
        }

        try {
            setIsWinning(true);
            setLoadingMessage('Approving 1000 DEGEN...');
            const success = await approveTokens('1000');
            if (success) {
                setLoadingMessage('✅ Approval successful! You can now make a guess.');
                // Update allowance after successful approval
                const newAllowance = await getAllowance();
                setAllowance(newAllowance);
                setTimeout(() => setLoadingMessage(''), 3000);
            } else {
                setLoadingMessage('❌ Approval failed. Please try again.');
                setTimeout(() => setLoadingMessage(''), 3000);
            }
        } catch (error) {
            console.error('Error approving tokens:', error);
            setLoadingMessage('❌ Approval failed: ' + (error as Error).message);
            setTimeout(() => setLoadingMessage(''), 3000);
        } finally {
            setIsWinning(false);
        }
    };

    const handleGuess = async () => {
        if (!isConnected && !isDemoMode) {
            await connectWallet();
            return;
        }

        if (isDemoMode) {
            // Demo mode logic
            const guessNum = parseInt(guess);

            if (!guess || guessNum < 1 || guessNum > 10) {
                alert("Please enter a number between 1 and 10");
                return;
            }

            setIsWinning(true);

            const newAttempt: Attempt = {
                id: Date.now(),
                guess: guessNum,
                timestamp: new Date(),
            };

            setAttempts([newAttempt, ...attempts.slice(0, 4)]);
            setPot(pot + 900);
            setTotalGuesses(totalGuesses + 1);

            setTimeout(() => {
                const targetNumber = Math.floor(Math.random() * 10) + 1;
                if (guessNum === targetNumber) {
                    // Trigger confetti celebration! 🎉
                    triggerConfetti();
                    alert(`🎉 WINNER! You guessed ${guessNum} correctly! You won ${pot + 900} $DEGEN!`);
                    setPot(9000);
                    setAttempts([]);
                } else {
                    alert(`Not quite... ${guessNum} wasn't it. The winning number was ${targetNumber}. Try again!`);
                }
                setIsWinning(false);
                setGuess("");
            }, 3000);
            return;
        }

        // Real contract logic
        const guessNum = parseInt(guess);

        if (!guess || guessNum < 1 || guessNum > 10) {
            setLoadingMessage("Please enter a number between 1 and 10");
            setTimeout(() => setLoadingMessage(''), 3000);
            return;
        }

        if (tokenBalance < 1000) {
            setLoadingMessage('Insufficient token balance. You need at least 1000 tokens to play.');
            setTimeout(() => setLoadingMessage(''), 3000);
            return;
        }

        setIsWinning(true);
        setLoadingMessage(`Making guess ${guessNum}...`);

        try {
            const success = await makeGuess(guessNum);
            if (success) {
                setLoadingMessage('Guess submitted! Waiting for Chainlink VRF...');

                const newAttempt: Attempt = {
                    id: Date.now(),
                    guess: guessNum,
                    timestamp: new Date(),
                };

                setAttempts([newAttempt, ...attempts.slice(0, 4)]);
                setTotalGuesses(totalGuesses + 1);

                // Don't clear loading message yet - wait for VRF callback
                // The event listeners in useContract will handle the result
            } else {
                // If makeGuess returns false (e.g., insufficient approval), clear loading state
                setIsWinning(false);
            }
        } catch (error) {
            console.error('Error making guess:', error);
            setLoadingMessage('❌ Failed to make guess. Please try again.');
            setTimeout(() => setLoadingMessage(''), 3000);
            setIsWinning(false);
        }
        // Note: Only clear guess input, not isWinning (it's cleared above when needed)
        setGuess("");
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
            await connectWallet();
            return;
        }

        try {
            setIsWinning(true);
            setLoadingMessage(`Approving ${amount} DEGEN...`);
            const success = await approveTokens(amount.toString());
            if (success) {
                setLoadingMessage(`✅ Approval successful! You can now make ${Math.floor(amount / 1000)} guesses.`);
                // Update allowance after successful approval
                const newAllowance = await getAllowance();
                setAllowance(newAllowance);
                setTimeout(() => setLoadingMessage(''), 3000);
            } else {
                setLoadingMessage('❌ Approval failed. Please try again.');
                setTimeout(() => setLoadingMessage(''), 3000);
            }
        } catch (error) {
            console.error('Error pre-approving tokens:', error);
            setLoadingMessage('❌ Approval failed: ' + (error as Error).message);
            setTimeout(() => setLoadingMessage(''), 3000);
        } finally {
            setIsWinning(false);
        }
    };

    const handleRevoke = async () => {
        if (!isConnected) {
            await connectWallet();
            return;
        }

        try {
            setIsWinning(true);
            setLoadingMessage('Revoking approval...');
            const success = await approveTokens('0');
            if (success) {
                setLoadingMessage('✅ Approval revoked successfully!');
                // Update allowance after successful revocation
                const newAllowance = await getAllowance();
                setAllowance(newAllowance);
                setTimeout(() => setLoadingMessage(''), 3000);
            } else {
                setLoadingMessage('❌ Revocation failed. Please try again.');
                setTimeout(() => setLoadingMessage(''), 3000);
            }
        } catch (error) {
            console.error('Error revoking approval:', error);
            setLoadingMessage('❌ Revocation failed: ' + (error as Error).message);
            setTimeout(() => setLoadingMessage(''), 3000);
        } finally {
            setIsWinning(false);
        }
    };

    console.log('Page render - isReady:', isReady, 'user:', user);

    if (!isReady) {
        console.log('Showing loading screen');
        return (
            <main className="min-h-screen bg-gradient-to-br from-background via-[hsl(270_50%_10%)] to-background flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground">Loading DEGEN GUESSR...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-background via-[hsl(270_50%_10%)] to-background p-4 py-8">
            <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
                {/* Header with Logo */}
                <div className="text-center space-y-3">
                    <div className="flex items-center justify-center gap-3">
                        <Image src="/degen-logo.png" alt="Degen Hat" width={64} height={64} className="w-16 h-16 object-contain animate-[bounce_2s_ease-in-out_infinite]" />
                        <h1 className="text-6xl font-black bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent neon-glow">
                            DEGEN GUESSR
                        </h1>
                        <Image src="/degen-logo.png" alt="Degen Hat" width={64} height={64} className="w-16 h-16 object-contain animate-[bounce_2s_ease-in-out_infinite] scale-x-[-1]" />
                    </div>
                    <p className="text-muted-foreground text-sm font-medium">Guess the number. Win the pot.</p>


                    {/* Connection Status */}
                    <div className="flex items-center justify-center gap-4">
                        {isDemoMode ? (
                            <div className="text-yellow-400 text-sm font-bold">DEMO MODE</div>
                        ) : isConnected ? (
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

                    {/* Add to Farcaster button - shows in Farcaster environment if not already added */}
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
                        <Card className="glass-card gradient-border p-8 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/20 animate-[pulse_3s_ease-in-out_infinite]" />
                            <div className="relative z-10 text-center space-y-3">
                                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm font-semibold">
                                    <Trophy className="w-5 h-5" />
                                    <span>CURRENT PRIZE POT</span>
                                    <Trophy className="w-5 h-5" />
                                </div>
                                <div className="text-7xl font-black bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent neon-glow">
                                    {isLoadingPot ? (
                                        <div className="animate-pulse">...</div>
                                    ) : (
                                        Math.floor(pot)
                                    )}
                                </div>
                                <div className="text-2xl font-bold text-primary">$DEGEN</div>
                            </div>
                        </Card>

                        {/* Input Section */}
                        <Card className="glass-card gradient-border p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    Guess a number between 1 and 10.
                                </label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={guess}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuess(e.target.value)}
                                    placeholder="Enter number..."
                                    className="h-16 text-3xl font-black text-center bg-input/50 border-2 border-primary/30 focus:border-primary focus:ring-primary rounded-2xl"
                                    onKeyPress={(e: React.KeyboardEvent) => e.key === "Enter" && !isWinning && handleGuess()}
                                    disabled={isWinning}
                                />
                            </div>

                            {!isDemoMode && allowance < 1000 && (
                                <Button
                                    onClick={handleApprove}
                                    className="w-full h-14 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-black text-lg transition-all duration-300 rounded-2xl flex items-center justify-center gap-2"
                                    disabled={isWinning || isLoading}
                                >
                                    <TrendingUp className="w-5 h-5" />
                                    APPROVE 1000 DEGEN
                                </Button>
                            )}

                            <Button
                                onClick={handleGuess}
                                className="w-full h-16 bg-gradient-to-r from-primary to-secondary hover:from-primary-glow hover:to-secondary-glow text-white font-black text-xl transition-all duration-300 neon-button rounded-2xl flex items-center justify-center gap-3"
                                disabled={isWinning || isLoading || (!isDemoMode && allowance < 1000)}
                            >
                                <Image src="/degen-logo.png" alt="Hat" width={32} height={32} className="w-8 h-8 object-contain" />
                                <Zap className="w-6 h-6" />
                                {isWinning ? "PROCESSING..." : isDemoMode ? "GUESS FOR 1000 $DEGEN" : (!isDemoMode && allowance < 1000) ? "MAKE GUESS" : "MAKE GUESS"}
                                <Zap className="w-6 h-6" />
                            </Button>

                            {/* Loading Status */}
                            {loadingMessage && (
                                <div className={`text-center p-4 rounded-xl border-2 ${loadingMessage.includes('✅')
                                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                    : loadingMessage.includes('❌')
                                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                        : loadingMessage.includes('🎉')
                                            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 animate-pulse'
                                            : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                    }`}>
                                    <div className="flex items-center justify-center gap-2 font-semibold">
                                        {!loadingMessage.includes('✅') && !loadingMessage.includes('❌') && !loadingMessage.includes('🎉') && (
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                                        )}
                                        <span>{loadingMessage}</span>
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* Mode Switch Card */}
                        <Card className="glass-card gradient-border p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="text-2xl">⚡🎩</div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 text-yellow-400 font-bold text-lg">
                                            You're in Super Degen Mode.
                                            <span className="text-green-400 text-sm">✓</span>
                                        </div>
                                        <p className="text-muted-foreground text-sm mt-1">
                                            Switch to Degen Mode for lower odds, but more cautious stakes.
                                        </p>
                                        <p className="text-xs text-muted-foreground/70 mt-1">
                                            1 in 10 chances to hit the pot
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    href="/"
                                    className="bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-white font-bold px-6 py-3 rounded-xl transition-all duration-300 text-sm whitespace-nowrap w-full sm:w-auto text-center"
                                >
                                    Go Degen 🎩
                                </Link>
                            </div>
                        </Card>

                        {/* Stats */}
                        <div className="space-y-4">
                            {/* Balance - Full width on mobile, part of grid on desktop */}
                            <Card className="glass-card gradient-border p-5 md:hidden">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
                                    <Zap className="w-4 h-4" />
                                    <span>YOUR BALANCE</span>
                                </div>
                                <div className="text-4xl font-black text-foreground">{Math.floor(tokenBalance)}</div>
                            </Card>

                            {/* Desktop: 3 columns, Mobile: 2 columns for guesses and winnings */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <Card className="glass-card gradient-border p-5">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
                                        <TrendingUp className="w-4 h-4" />
                                        <span>TOTAL GUESSES</span>
                                    </div>
                                    <div className="text-4xl font-black text-foreground">{totalGuesses}</div>
                                </Card>

                                {/* Balance - Hidden on mobile, shown on desktop */}
                                <Card className="glass-card gradient-border p-5 hidden md:block">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
                                        <Zap className="w-4 h-4" />
                                        <span>YOUR BALANCE</span>
                                    </div>
                                    <div className="text-4xl font-black text-foreground">{Math.floor(tokenBalance)}</div>
                                </Card>

                                <Card className="glass-card gradient-border p-5">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
                                        <Trophy className="w-4 h-4 text-yellow-400" />
                                        <span>TOTAL WINNINGS</span>
                                    </div>
                                    <div className="text-4xl font-black text-foreground">{playerWins % 1 === 0 ? playerWins.toString() : playerWins.toFixed(2)}</div>
                                </Card>
                            </div>
                        </div>

                        {/* Recent Attempts */}
                        {attempts.length > 0 && (
                            <Card className="glass-card gradient-border p-5">
                                <div className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    Recent Attempts
                                </div>
                                <div className="space-y-2">
                                    {attempts.map((attempt, index) => (
                                        <div
                                            key={attempt.id}
                                            className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-primary/20 animate-slide-in hover:bg-muted/60 transition-colors"
                                            style={{ animationDelay: `${index * 0.1}s` }}
                                        >
                                            <span className="text-3xl font-black text-foreground">{attempt.guess}</span>
                                            <span className="text-xs text-muted-foreground font-medium">
                                                {attempt.timestamp.toLocaleTimeString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}
                    </div>

                    {/* Right Column - Winners */}
                    <div className="space-y-6">
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
                                        <p className="text-xs text-muted-foreground/70 mt-1">Be the first to guess correctly</p>
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
                                                            {new Date(winner.timestamp).toLocaleTimeString()}
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

                        {/* Pre-approval Section */}
                        {!isDemoMode && isConnected && (
                            <Card className="glass-card gradient-border p-6 space-y-4">
                                <div className="text-center space-y-2">
                                    <h3 className="text-xl font-bold text-foreground">Pre-approve to guess in one click</h3>
                                    <p className="text-sm text-muted-foreground">Your allowance is {allowance.toFixed(0)} DEGEN</p>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <Button
                                        onClick={() => handlePreApprove(4000)}
                                        className="h-12 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-bold text-sm transition-all duration-300 rounded-xl"
                                        disabled={isWinning || isLoading}
                                    >
                                        4000 DEGEN
                                    </Button>

                                    <Button
                                        onClick={() => handlePreApprove(8000)}
                                        className="h-12 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-bold text-sm transition-all duration-300 rounded-xl"
                                        disabled={isWinning || isLoading}
                                    >
                                        8000 DEGEN
                                    </Button>

                                    <Button
                                        onClick={handleRevoke}
                                        className="h-12 bg-gradient-to-r from-primary/80 to-secondary/80 hover:from-primary/70 hover:to-secondary/70 text-white font-bold text-sm transition-all duration-300 rounded-xl"
                                        disabled={isWinning || isLoading}
                                    >
                                        Revoke
                                    </Button>
                                </div>
                            </Card>
                        )}

                        {/* How to Play */}
                        <Card className="glass-card border border-muted/30 p-4">
                            <div className="text-xs font-medium text-muted-foreground space-y-2">
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">•</span>
                                    Pay 1000 $DEGEN to guess
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">•</span>
                                    500 $DEGEN added to pot, 500 $DEGEN to treasury (pot provision)
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">•</span>
                                    Guess correctly = win it all
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">•</span>
                                    Number changes each guess
                                </p>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

        </main>
    );
}