#!/usr/bin/env python3
"""
Generate ABI for DegenSlot contract
This is a placeholder - in practice, you would compile the contract
and extract the ABI from the compilation artifacts.
"""

# This is a simplified ABI for the updated DegenSlot contract
# In practice, you would compile the contract and get the real ABI

abi = [
    {
        "inputs": [
            {"internalType": "address", "name": "_degenToken", "type": "address"},
            {"internalType": "address", "name": "_treasury", "type": "address"},
            {"internalType": "address", "name": "_vrfCoordinator", "type": "address"},
            {"internalType": "bytes32", "name": "_keyHash", "type": "bytes32"},
            {"internalType": "uint256", "name": "_subscriptionId", "type": "uint256"}
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [],
        "name": "PotTooSmall",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "Pending",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "InvalidRequest",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "InsufficientPot",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "NoTreasuryFunds",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "address", "name": "player", "type": "address"},
            {"indexed": true, "internalType": "uint256", "name": "requestId", "type": "uint256"},
            {"indexed": false, "internalType": "uint256", "name": "potBefore", "type": "uint256"}
        ],
        "name": "SpinInitiated",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "address", "name": "player", "type": "address"},
            {"indexed": false, "internalType": "uint256", "name": "roll", "type": "uint256"},
            {"indexed": false, "internalType": "uint8", "name": "category", "type": "uint8"},
            {"indexed": false, "internalType": "uint256", "name": "payout", "type": "uint256"},
            {"indexed": false, "internalType": "uint256", "name": "potAfter", "type": "uint256"}
        ],
        "name": "SpinResult",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"},
            {"indexed": false, "internalType": "uint256", "name": "newPot", "type": "uint256"}
        ],
        "name": "PotSeeded",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "address", "name": "to", "type": "address"},
            {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"}
        ],
        "name": "TreasuryWithdrawn",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "address", "name": "player", "type": "address"}
        ],
        "name": "StuckRequestCleared",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "spin",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"}],
        "name": "addToPot",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "withdrawTreasury",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "pause",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "unpause",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "player", "type": "address"}],
        "name": "clearStuckPendingRequest",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getPot",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getTreasuryBalance",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getOwner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "", "type": "address"}],
        "name": "hasPendingRequest",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "pot",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "treasuryBalance",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]

if __name__ == "__main__":
    import json
    print(json.dumps(abi, indent=2))
