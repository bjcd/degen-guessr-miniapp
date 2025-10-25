"use client";

import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Trophy, Zap, TrendingUp, Crown, Sparkles } from "lucide-react";
import Image from "next/image";
import { SlotMachine } from "../components/SlotMachine";

interface SpinResult {
    id: number;
    reels: string[];
    won: boolean;
    amount: number;
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

const SLOT_ICONS = ["🎰", "💎", "⭐", "👑", "🍒", "🔔", "💰", "🎲"];
const HAT_ICON = "🎩";

const Index = () => {
    const [pot, setPot] = useState(2340);
    const [spinning, setSpinning] = useState(false);
    const [reels, setReels] = useState<string[]>([HAT_ICON, HAT_ICON, HAT_ICON]);
    const [lastSpins, setLastSpins] = useState<SpinResult[]>([]);
    const [totalSpins, setTotalSpins] = useState(26);

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

    const getRandomIcon = () => {
        const allIcons = [...SLOT_ICONS, HAT_ICON];
        return allIcons[Math.floor(Math.random() * allIcons.length)];
    };

    const handleSpin = () => {
        if (spinning) return;

        setSpinning(true);
        setPot(pot + 90);
        setTotalSpins(totalSpins + 1);

        // Generate random results for each reel
        const newReels = [getRandomIcon(), getRandomIcon(), getRandomIcon()];
        setReels(newReels);
    };

    const handleSpinComplete = () => {
        setSpinning(false);

        // Check for win conditions
        const allHats = reels.every((reel) => reel === HAT_ICON);
        const allSame = reels[0] === reels[1] && reels[1] === reels[2];
        const twoSame = reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2];

        let winAmount = 0;
        let winTitle = "";
        let winDescription = "";

        if (allHats) {
            winAmount = pot;
            winTitle = "🎩🎩🎩 JACKPOT!!!";
            winDescription = `THREE HATS! You won ${winAmount} $DEGEN!`;
        } else if (allSame) {
            winAmount = Math.floor(pot * 0.3);
            winTitle = "🎉 BIG WIN!";
            winDescription = `Three of a kind! You won ${winAmount} $DEGEN!`;
        } else if (twoSame) {
            winAmount = 200;
            winTitle = "✨ Nice!";
            winDescription = `Two matching symbols! You won ${winAmount} $DEGEN!`;
        }

        // Record the spin
        const newSpin: SpinResult = {
            id: Date.now(),
            reels: [...reels],
            won: winAmount > 0,
            amount: winAmount,
            timestamp: new Date(),
        };
        setLastSpins([newSpin, ...lastSpins.slice(0, 4)]);

        if (winAmount > 0) {
            alert(`${winTitle}\n${winDescription}`);

            setTimeout(() => {
                setPot(allHats ? 900 : pot - winAmount);
            }, 2000);
        } else {
            alert("Not this time...\nTry again! The jackpot is growing!");
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-background via-[hsl(270_50%_10%)] to-background p-4 py-8">
            <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
                {/* Header with Logo */}
                <div className="text-center space-y-3">
                    <div className="flex items-center justify-center gap-3">
                        <Image src="/degen-logo.png" alt="Degen Hat" width={64} height={64} className="object-contain animate-[bounce_2s_ease-in-out_infinite]" />
                        <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent neon-glow">
                            DEGEN SLOTS
                        </h1>
                        <Image src="/degen-logo.png" alt="Degen Hat" width={64} height={64} className="object-contain animate-[bounce_2s_ease-in-out_infinite] scale-x-[-1]" />
                    </div>
                    <p className="text-muted-foreground text-sm font-medium">Spin the reels. Match three hats. Win the jackpot.</p>
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
                        <SlotMachine spinning={spinning} reels={reels} onSpinComplete={handleSpinComplete} />

                        {/* Spin Button */}
                        <Button
                            onClick={handleSpin}
                            disabled={spinning}
                            className="w-full h-16 md:h-20 bg-gradient-to-r from-primary to-secondary hover:from-primary-glow hover:to-secondary-glow text-white font-black text-xl md:text-2xl transition-all duration-300 neon-button rounded-2xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Image src="/degen-logo.png" alt="Hat" width={32} height={32} className="object-contain" />
                            <Zap className="w-6 h-6" />
                            {spinning ? "SPINNING..." : "SPIN FOR 100 $DEGEN"}
                            <Zap className="w-6 h-6" />
                        </Button>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="glass-card gradient-border p-5">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
                                    <TrendingUp className="w-4 h-4" />
                                    <span>TOTAL SPINS</span>
                                </div>
                                <div className="text-4xl font-black text-foreground">{totalSpins}</div>
                            </Card>

                            <Card className="glass-card gradient-border p-5">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
                                    <Zap className="w-4 h-4" />
                                    <span>SPIN COST</span>
                                </div>
                                <div className="text-4xl font-black text-foreground">100</div>
                            </Card>
                        </div>

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
                                                {new Date(winner.timestamp).toLocaleDateString('en-US')}
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
                                    <span className="text-primary font-bold">🎩</span>
                                    Three hats = JACKPOT
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">🎰</span>
                                    Three same = 30% of pot
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">💎</span>
                                    Two same = 200 $DEGEN
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">⚡</span>
                                    Each spin costs 100
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">💰</span>
                                    90 added to jackpot
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