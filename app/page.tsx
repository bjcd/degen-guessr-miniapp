"use client";

import { useState, useEffect } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Card } from "./components/ui/card";
import { Trophy, Zap, TrendingUp, Sparkles } from "lucide-react";
// @ts-ignore
import degenHat from "../public/degen-logo.png";
import { useFarcaster } from "./farcaster-provider";
import { useContract } from "./hooks/useContract";

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
}

const DEGEN_TOKEN = process.env.NEXT_PUBLIC_DEGEN_TOKEN_ADDRESS || '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed';
const GUESS_GAME_CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';

export default function Home() {
    const { isReady, user, signIn, signOut, isFarcasterEnvironment } = useFarcaster();

    const [guess, setGuess] = useState("");
    const [pot, setPot] = useState(0);
    const [tokenBalance, setTokenBalance] = useState(0);
    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const [totalGuesses, setTotalGuesses] = useState(0);
    const [playerWins, setPlayerWins] = useState(0);
    const [isWinning, setIsWinning] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState<string>("");
    const [winners, setWinners] = useState<Winner[]>([]);

    const {
        connectWallet,
        getPot,
        getPlayerGuesses,
        getPlayerWins,
        getTokenBalance,
        approveTokens,
        makeGuess,
        getPastWinners,
        isConnected,
        isLoading,
        account
    } = useContract({
        onWin: async (guessedNumber, amount, winnerAddress, txHash) => {
            setLoadingMessage(`🎉 WINNER! You guessed ${guessedNumber} correctly! You won ${amount} DEGEN!`);

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
                // Refresh data after win
                const [potValue, balance, guesses, wins] = await Promise.all([
                    getPot(),
                    getTokenBalance(),
                    account ? getPlayerGuesses(account) : Promise.resolve(0),
                    account ? getPlayerWins(account) : Promise.resolve(0)
                ]);
                setPot(potValue);
                setTokenBalance(balance);
                setTotalGuesses(guesses);
                setPlayerWins(wins);
            }, 5000);
        },
        onMiss: async (guessedNumber, winningNumber) => {
            setLoadingMessage(`Not quite... ${guessedNumber} wasn't it. The winning number was ${winningNumber}. Try again!`);
            setTimeout(async () => {
                setLoadingMessage('');
                setIsWinning(false);
                // Refresh data after miss
                const [potValue, balance, guesses, wins] = await Promise.all([
                    getPot(),
                    getTokenBalance(),
                    account ? getPlayerGuesses(account) : Promise.resolve(0),
                    account ? getPlayerWins(account) : Promise.resolve(0)
                ]);
                setPot(potValue);
                setTokenBalance(balance);
                setTotalGuesses(guesses);
                setPlayerWins(wins);
            }, 3000);
        },
        onError: (message) => {
            setLoadingMessage(`❌ ${message}`);
            setTimeout(() => {
                setLoadingMessage('');
            }, 5000);
        }
    });

    const isDemoMode = GUESS_GAME_CONTRACT === '0x0000000000000000000000000000000000000000';

    // Load contract data
    useEffect(() => {
        if (isConnected && !isDemoMode) {
            loadContractData();
        }
    }, [isConnected, isDemoMode]);

    const loadContractData = async () => {
        try {
            const [potValue, balance, guesses, wins, pastWinners] = await Promise.all([
                getPot(),
                getTokenBalance(),
                account ? getPlayerGuesses(account) : Promise.resolve(0),
                account ? getPlayerWins(account) : Promise.resolve(0),
                getPastWinners(10)
            ]);
            setPot(potValue);
            setTokenBalance(balance);
            setTotalGuesses(guesses);
            setPlayerWins(wins);

            // Convert past winners to Winner format
            const formattedWinners: Winner[] = pastWinners.map((winner, index) => ({
                id: Date.now() - index,
                address: winner.player,
                amount: parseFloat(winner.amount),
                timestamp: winner.timestamp,
                txHash: winner.txHash
            }));
            setWinners(formattedWinners);
        } catch (error) {
            console.error('Error loading contract data:', error);
        }
    };

    const handleApprove = async () => {
        if (!isConnected) {
            await connectWallet();
            return;
        }

        try {
            setIsWinning(true);
            setLoadingMessage('Approving 100 DEGEN...');
            const success = await approveTokens('100');
            if (success) {
                setLoadingMessage('✅ Approval successful! You can now make a guess.');
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

            if (!guess || guessNum < 1 || guessNum > 100) {
                alert("Please enter a number between 1 and 100");
                return;
            }

            setIsWinning(true);

            const newAttempt: Attempt = {
                id: Date.now(),
                guess: guessNum,
                timestamp: new Date(),
            };

            setAttempts([newAttempt, ...attempts.slice(0, 4)]);
            setPot(pot + 90);
            setTotalGuesses(totalGuesses + 1);

            setTimeout(() => {
                const targetNumber = Math.floor(Math.random() * 100) + 1;
                if (guessNum === targetNumber) {
                    alert(`🎉 WINNER! You guessed ${guessNum} correctly! You won ${pot + 90} $DEGEN!`);
                    setPot(900);
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

        if (!guess || guessNum < 1 || guessNum > 100) {
            setLoadingMessage("Please enter a number between 1 and 100");
            setTimeout(() => setLoadingMessage(''), 3000);
            return;
        }

        if (tokenBalance < 100) {
            setLoadingMessage('Insufficient token balance. You need at least 100 tokens to play.');
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

    if (!isReady) {
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
                        <img src={degenHat.src || degenHat} alt="Degen Hat" className="w-16 h-16 object-contain animate-[bounce_2s_ease-in-out_infinite]" />
                        <h1 className="text-6xl font-black bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent neon-glow">
                            DEGEN GUESSR
                        </h1>
                        <img src={degenHat.src || degenHat} alt="Degen Hat" className="w-16 h-16 object-contain animate-[bounce_2s_ease-in-out_infinite] scale-x-[-1]" />
                    </div>
                    <p className="text-muted-foreground text-sm font-medium">Guess the number. Win the pot. Be legendary.</p>

                    {/* Connection Status */}
                    <div className="flex items-center justify-center gap-4">
                        {isDemoMode ? (
                            <div className="text-yellow-400 text-sm font-bold">DEMO MODE</div>
                        ) : isConnected ? (
                            <div className="text-green-400 text-sm font-bold">
                                Connected: {account?.slice(0, 6)}...{account?.slice(-4)}
                            </div>
                        ) : (
                            <Button onClick={handleConnect} className="btn-primary">
                                Connect Wallet
                            </Button>
                        )}
                    </div>
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
                                    {Math.floor(pot)}
                                </div>
                                <div className="text-2xl font-bold text-primary">$DEGEN</div>
                            </div>
                        </Card>

                        {/* Input Section */}
                        <Card className="glass-card gradient-border p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    Your Guess (1-100)
                                </label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={guess}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuess(e.target.value)}
                                    placeholder="Enter number..."
                                    className="h-16 text-3xl font-black text-center bg-input/50 border-2 border-primary/30 focus:border-primary focus:ring-primary rounded-2xl"
                                    onKeyPress={(e: React.KeyboardEvent) => e.key === "Enter" && !isWinning && handleGuess()}
                                    disabled={isWinning}
                                />
                            </div>

                            {!isDemoMode && (
                                <Button
                                    onClick={handleApprove}
                                    className="w-full h-14 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-black text-lg transition-all duration-300 rounded-2xl flex items-center justify-center gap-2"
                                    disabled={isWinning || isLoading}
                                >
                                    <TrendingUp className="w-5 h-5" />
                                    APPROVE 100 DEGEN
                                </Button>
                            )}

                            <Button
                                onClick={handleGuess}
                                className="w-full h-16 bg-gradient-to-r from-primary to-secondary hover:from-primary-glow hover:to-secondary-glow text-white font-black text-xl transition-all duration-300 neon-button rounded-2xl flex items-center justify-center gap-3"
                                disabled={isWinning || isLoading}
                            >
                                <img src={degenHat.src || degenHat} alt="Hat" className="w-8 h-8 object-contain" />
                                <Zap className="w-6 h-6" />
                                {isWinning ? "PROCESSING..." : isDemoMode ? "GUESS FOR 100 $DEGEN" : "MAKE GUESS"}
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

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-4">
                            <Card className="glass-card gradient-border p-5">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
                                    <TrendingUp className="w-4 h-4" />
                                    <span>TOTAL GUESSES</span>
                                </div>
                                <div className="text-4xl font-black text-foreground">{totalGuesses}</div>
                            </Card>

                            <Card className="glass-card gradient-border p-5">
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
                                    winners.map((winner, index) => (
                                        <div
                                            key={winner.id}
                                            className="p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/30 hover:border-primary/50 transition-colors"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-bold text-foreground font-mono">
                                                    {winner.address.slice(0, 6)}...{winner.address.slice(-4)}
                                                </span>
                                                <Trophy className={`w-4 h-4 ${index === 0 ? 'text-yellow-400 animate-pulse' : 'text-primary'}`} />
                                            </div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(winner.timestamp).toLocaleTimeString()}
                                                </span>
                                                <span className="text-lg font-black text-primary">
                                                    {winner.amount % 1 === 0 ? winner.amount.toString() : winner.amount.toFixed(2)} $DEGEN
                                                </span>
                                            </div>
                                            {winner.txHash && (
                                                <a
                                                    href={`https://basescan.org/tx/${winner.txHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-primary/70 hover:text-primary underline transition-colors flex items-center gap-1"
                                                >
                                                    <span>View TX</span>
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                    </svg>
                                                </a>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>

                        {/* How to Play */}
                        <Card className="glass-card border border-muted/30 p-4">
                            <div className="text-xs font-medium text-muted-foreground space-y-2">
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">•</span>
                                    Pay 100 $DEGEN to guess
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">•</span>
                                    50 $DEGEN added to pot
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