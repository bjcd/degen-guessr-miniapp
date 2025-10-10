"use client";

import { useState, useEffect } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Card } from "./components/ui/card";
import { Trophy, Zap, TrendingUp, Crown, Sparkles } from "lucide-react";
// @ts-ignore
import degenHat from "/public/degen-logo.png";
import { useFarcaster } from "./farcaster-provider";

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
}

interface LeaderboardEntry {
    address: string;
    wins: number;
    totalWon: number;
}

// Contract configuration from environment variables
const DEGEN_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_DEGEN_TOKEN_ADDRESS || "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed";
const GUESS_GAME_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS;

export default function Home() {
    const { isReady, user, signIn, signOut, isFarcasterEnvironment } = useFarcaster();
    const [guess, setGuess] = useState("");
    const [pot, setPot] = useState(2340);
    const [attempts, setAttempts] = useState<Attempt[]>([
        { id: 1, guess: 42, timestamp: new Date(Date.now() - 120000) },
        { id: 2, guess: 73, timestamp: new Date(Date.now() - 60000) },
        { id: 3, guess: 15, timestamp: new Date(Date.now() - 30000) },
    ]);
    const [totalGuesses, setTotalGuesses] = useState(26);
    const [isWinning, setIsWinning] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [targetNumber] = useState(() => Math.floor(Math.random() * 100) + 1);

    const [winners] = useState<Winner[]>([
        { id: 1, address: "0x742d...3f2a", amount: 1890, timestamp: new Date(Date.now() - 3600000) },
        { id: 2, address: "0x8b3f...9c4d", amount: 2450, timestamp: new Date(Date.now() - 7200000) },
        { id: 3, address: "0x1a5c...7e8b", amount: 3120, timestamp: new Date(Date.now() - 10800000) },
    ]);

    const [leaderboard] = useState<LeaderboardEntry[]>([
        { address: "0x8b3f...9c4d", wins: 12, totalWon: 23400 },
        { address: "0x742d...3f2a", wins: 8, totalWon: 15680 },
        { address: "0x1a5c...7e8b", wins: 6, totalWon: 11200 },
        { address: "0x9f2e...4a6c", wins: 5, totalWon: 8900 },
        { address: "0x3d8b...1f5e", wins: 4, totalWon: 7200 },
    ]);

    const handleGuess = async () => {
        const guessNum = parseInt(guess);

        if (!guess || guessNum < 1 || guessNum > 100) {
            alert("Please enter a number between 1 and 100");
            return;
        }

        setIsLoading(true);

        try {
            if (GUESS_GAME_CONTRACT_ADDRESS) {
                // Real contract interaction
                await makeContractGuess(guessNum);
            } else {
                // Demo mode
                await makeDemoGuess(guessNum);
            }
        } catch (error) {
            console.error('Guess failed:', error);
            alert('Guess failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const makeDemoGuess = async (guessNum: number) => {
        const newAttempt: Attempt = {
            id: Date.now(),
            guess: guessNum,
            timestamp: new Date(),
        };

        setAttempts([newAttempt, ...attempts.slice(0, 4)]);
        setPot(pot + 90);
        setTotalGuesses(totalGuesses + 1);

        if (guessNum === targetNumber) {
            setIsWinning(true);
            alert(`🎉 WINNER! You guessed ${guessNum} correctly! You won ${pot + 90} $DEGEN!`);

            setTimeout(() => {
                setIsWinning(false);
                setPot(900);
                setAttempts([]);
            }, 5000);
        } else {
            alert(`${guessNum} wasn't it. Try again!`);
        }

        setGuess("");
    };

    const makeContractGuess = async (guessNum: number) => {
        // This would integrate with the actual smart contract
        // For now, we'll simulate the contract interaction
        console.log('Making contract guess:', guessNum);
        console.log('Contract address:', GUESS_GAME_CONTRACT_ADDRESS);
        console.log('DEGEN token address:', DEGEN_TOKEN_ADDRESS);
        console.log('Treasury address:', TREASURY_ADDRESS);

        // Simulate contract call
        await new Promise(resolve => setTimeout(resolve, 2000));

        // For demo purposes, use the same logic as demo mode
        await makeDemoGuess(guessNum);
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

    if (!user) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-background via-[hsl(270_50%_10%)] to-background flex items-center justify-center p-4">
                <Card className="glass-card gradient-border p-8 max-w-md w-full text-center space-y-6">
                    <div className="flex items-center justify-center gap-3">
                        <img src={degenHat.src || degenHat} alt="Degen Hat" className="w-16 h-16 object-contain animate-[bounce_2s_ease-in-out_infinite]" />
                        <h1 className="text-4xl font-black bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent neon-glow">
                            DEGEN GUESSR
                        </h1>
                    </div>
                    <p className="text-muted-foreground">
                        {isFarcasterEnvironment
                            ? "Connect your Farcaster account to start guessing!"
                            : "Sign in to start playing the DEGEN guessing game!"
                        }
                    </p>
                    <Button onClick={signIn} className="btn-primary w-full h-16 text-xl">
                        <img src={degenHat} alt="Hat" className="w-8 h-8 object-contain" />
                        <Zap className="w-6 h-6" />
                        {isFarcasterEnvironment ? "CONNECT FARCASTER" : "SIGN IN"}
                        <Zap className="w-6 h-6" />
                    </Button>
                    {!GUESS_GAME_CONTRACT_ADDRESS && (
                        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                            <p className="font-bold text-primary mb-1">DEMO MODE</p>
                            <p>Contract not deployed. Set NEXT_PUBLIC_CONTRACT_ADDRESS in .env to enable real gameplay.</p>
                        </div>
                    )}
                </Card>
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
                        <img src={degenHat} alt="Degen Hat" className="w-16 h-16 object-contain animate-[bounce_2s_ease-in-out_infinite] scale-x-[-1]" />
                    </div>
                    <p className="text-muted-foreground text-sm font-medium">Guess the number. Win the pot. Be legendary.</p>
                    {isFarcasterEnvironment && (
                        <div className="text-xs text-primary bg-primary/10 px-3 py-1 rounded-full inline-block">
                            🚀 Running in Farcaster
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
                                    {pot}
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
                                    onKeyPress={(e: React.KeyboardEvent) => e.key === "Enter" && !isLoading && handleGuess()}
                                    disabled={isLoading}
                                />
                            </div>

                            <Button
                                onClick={handleGuess}
                                className="w-full h-16 bg-gradient-to-r from-primary to-secondary hover:from-primary-glow hover:to-secondary-glow text-white font-black text-xl transition-all duration-300 neon-button rounded-2xl flex items-center justify-center gap-3"
                                disabled={isWinning || isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                        GUESSING...
                                    </>
                                ) : (
                                    <>
                                        <img src={degenHat.src || degenHat} alt="Hat" className="w-8 h-8 object-contain" />
                                        <Zap className="w-6 h-6" />
                                        GUESS FOR 100 $DEGEN
                                        <Zap className="w-6 h-6" />
                                    </>
                                )}
                            </Button>
                        </Card>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4">
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
                                    <span>ENTRY FEE</span>
                                </div>
                                <div className="text-4xl font-black text-foreground">100</div>
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

                    {/* Right Column - Leaderboard & Winners */}
                    <div className="space-y-6">
                        {/* Leaderboard */}
                        <Card className="glass-card gradient-border p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Crown className="w-5 h-5 text-primary" />
                                <h2 className="text-lg font-black text-foreground">LEADERBOARD</h2>
                            </div>
                            <div className="space-y-2">
                                {leaderboard.map((entry, index) => (
                                    <div
                                        key={entry.address}
                                        className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-primary/20 hover:bg-muted/60 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center font-black text-sm
                        ${index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' : ''}
                        ${index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-black' : ''}
                        ${index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-black' : ''}
                        ${index > 2 ? 'bg-muted text-foreground' : ''}
                      `}>
                                                {index + 1}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-foreground">{entry.address}</div>
                                                <div className="text-xs text-muted-foreground">{entry.wins} wins</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-black text-primary">{entry.totalWon}</div>
                                            <div className="text-xs text-muted-foreground">$DEGEN</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* Last Winners */}
                        <Card className="glass-card gradient-border p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Trophy className="w-5 h-5 text-secondary" />
                                <h2 className="text-lg font-black text-foreground">LAST WINNERS</h2>
                            </div>
                            <div className="space-y-3">
                                {winners.map((winner, index) => (
                                    <div
                                        key={winner.id}
                                        className="p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/30 hover:border-primary/50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-bold text-foreground">{winner.address}</span>
                                            <Trophy className={`w-4 h-4 ${index === 0 ? 'text-yellow-400' : 'text-primary'}`} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(winner.timestamp).toLocaleDateString()}
                                            </span>
                                            <span className="text-lg font-black text-primary">{winner.amount} $DEGEN</span>
                                        </div>
                                    </div>
                                ))}
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
                                    90 $DEGEN added to pot
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