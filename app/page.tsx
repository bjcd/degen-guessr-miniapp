'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from './farcaster-provider';
import GameInterface from './components/GameInterface';
import WalletConnect from './components/WalletConnect';
import Header from './components/Header';

// Contract configuration
const DEGEN_TOKEN = '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed';
const GUESS_GAME_CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';

const ABI = [
    {
        "inputs": [
            { "internalType": "uint8", "name": "number", "type": "uint8" },
            {
                "components": [
                    { "internalType": "uint256", "name": "value", "type": "uint256" },
                    { "internalType": "uint256", "name": "deadline", "type": "uint256" },
                    { "internalType": "uint8", "name": "v", "type": "uint8" },
                    { "internalType": "bytes32", "name": "r", "type": "bytes32" },
                    { "internalType": "bytes32", "name": "s", "type": "bytes32" }
                ],
                "internalType": "struct GuessGame.PermitData",
                "name": "permit",
                "type": "tuple"
            }
        ],
        "name": "guess",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getPot",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "player", "type": "address" }],
        "name": "getPlayerWins",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    }
];

const ERC20_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "owner", "type": "address" },
            { "internalType": "address", "name": "spender", "type": "address" }
        ],
        "name": "allowance",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "owner", "type": "address" },
            { "internalType": "address", "name": "spender", "type": "address" },
            { "internalType": "uint256", "name": "value", "type": "uint256" },
            { "internalType": "uint256", "name": "deadline", "type": "uint256" },
            { "internalType": "uint8", "name": "v", "type": "uint8" },
            { "internalType": "bytes32", "name": "r", "type": "bytes32" },
            { "internalType": "bytes32", "name": "s", "type": "bytes32" }
        ],
        "name": "permit",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    }
];

export default function Home() {
    const { isReady, user, signIn, signOut } = useFarcaster();
    const [address, setAddress] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const [guess, setGuess] = useState<number>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [gameStatus, setGameStatus] = useState<'idle' | 'guessing' | 'waiting' | 'result'>('idle');
    const [lastResult, setLastResult] = useState<{
        type: 'win' | 'miss';
        guessedNumber: number;
        winningNumber: number;
        amount?: string;
    } | null>(null);

    // Demo mode - show when no contract is deployed
    const isDemoMode = GUESS_GAME_CONTRACT === '0x0000000000000000000000000000000000000000';

    // Demo state for when contract is not deployed
    const [demoPot, setDemoPot] = useState<string>('0');
    const [demoPlayerWins, setDemoPlayerWins] = useState<string>('0');
    const [demoDegenBalance, setDemoDegenBalance] = useState<string>('1000');

    // Handle Farcaster sign in
    const handleSignIn = async () => {
        await signIn();
        // Mock wallet connection for demo
        setAddress('0x1234567890123456789012345678901234567890');
        setIsConnected(true);
    };

    const handleGuess = async () => {
        if (!user) {
            await handleSignIn();
            return;
        }

        if (!address || !isConnected) {
            await handleSignIn();
            return;
        }

        if (guess < 1 || guess > 100) {
            alert('Please enter a number between 1 and 100');
            return;
        }

        const currentBalance = isDemoMode ? parseFloat(demoDegenBalance) : 1000; // Mock balance
        if (currentBalance < 100) {
            alert('Insufficient DEGEN balance. You need at least 100 DEGEN to play.');
            return;
        }

        setIsLoading(true);
        setGameStatus('guessing');

        if (isDemoMode) {
            // Demo mode - simulate the game
            setTimeout(() => {
                setGameStatus('waiting');
                setTimeout(() => {
                    const winningNumber = Math.floor(Math.random() * 100) + 1;
                    const isWin = guess === winningNumber;

                    if (isWin) {
                        const winAmount = parseFloat(demoPot) + 90;
                        setDemoPot('0');
                        setDemoPlayerWins((parseFloat(demoPlayerWins) + winAmount).toString());
                        setLastResult({
                            type: 'win',
                            guessedNumber: guess,
                            winningNumber,
                            amount: winAmount.toString()
                        });
                    } else {
                        setDemoPot((parseFloat(demoPot) + 90).toString());
                        setLastResult({
                            type: 'miss',
                            guessedNumber: guess,
                            winningNumber
                        });
                    }

                    setDemoDegenBalance((parseFloat(demoDegenBalance) - 100).toString());
                    setGameStatus('result');
                    setIsLoading(false);
                }, 2000);
            }, 1000);
        } else {
            // Real contract interaction would go here
            console.log('Real contract interaction not implemented yet');
            setGameStatus('idle');
            setIsLoading(false);
        }
    };

    const formatDegen = (value: bigint | undefined) => {
        if (!value) return '0';
        return parseFloat(value.toString()).toFixed(2);
    };

    if (!isReady) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-degen-50 to-degen-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-degen-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

  return (
    <div className="min-h-screen bg-dark-bg max-w-md mx-auto relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-neon-green/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-neon-purple/10 rounded-full blur-3xl animate-pulse"></div>
      </div>
      
      <Header user={user} onSignOut={signOut} />
      
      <main className="px-4 py-4 relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black gradient-text mb-3 animate-glow">
            🎯 DEGEN GUESS
          </h1>
          <p className="text-text-secondary text-sm font-medium">
            Guess 1-100 • Win the pot • 100 $DEGEN per guess
          </p>
          <div className="mt-2 flex justify-center space-x-2">
            <span className="px-2 py-1 bg-neon-green/20 text-neon-green text-xs rounded-full font-bold">
              VRF
            </span>
            <span className="px-2 py-1 bg-neon-purple/20 text-neon-purple text-xs rounded-full font-bold">
              BASE
            </span>
            <span className="px-2 py-1 bg-neon-orange/20 text-neon-orange text-xs rounded-full font-bold">
              FAIR
            </span>
          </div>
        </div>

        {!user ? (
          <WalletConnect onConnect={handleSignIn} />
        ) : (
          <GameInterface
            guess={guess}
            setGuess={setGuess}
            onGuess={handleGuess}
            isLoading={isLoading}
            gameStatus={gameStatus}
            pot={isDemoMode ? demoPot : '0'}
            playerWins={isDemoMode ? demoPlayerWins : '0'}
            degenBalance={isDemoMode ? demoDegenBalance : '1000'}
            lastResult={lastResult}
            isDemoMode={isDemoMode}
            user={user}
          />
        )}
      </main>
    </div>
  );
}
