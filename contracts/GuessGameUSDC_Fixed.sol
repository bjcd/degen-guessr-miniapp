// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract DegenGuessr is VRFConsumerBaseV2Plus, ReentrancyGuard, Pausable {
    // Chainlink VRF v2.5+ variables
    bytes32 private immutable KEY_HASH;
    uint256 private immutable SUBSCRIPTION_ID;
    uint16 private constant REQUEST_CONFIRMATIONS = 0; // Base Sepolia supports 0 confs
    uint32 private constant CALLBACK_GAS_LIMIT = 200000; // headroom for fulfill
    uint32 private constant NUM_WORDS = 1;

    // Game constants (using units, decimals will be fetched from token)
    uint256 private constant GUESS_COST_UNITS = 100; // 100 tokens
    uint256 private constant POT_SHARE_UNITS = 50; // 50 tokens to pot
    uint256 private constant TREASURY_SHARE_UNITS = 50; // 50 tokens to treasury
    uint8 private constant MIN_GUESS = 1;
    uint8 private constant MAX_GUESS = 100;

    // State variables
    IERC20 public immutable token;
    address public immutable treasury;
    uint256 public pot;
    uint8 public immutable tokenDecimals; // Store token decimals

    // Struct for storing guess data
    struct Guess {
        address player;
        uint8 number;
        uint256 potAtTime;
    }

    // Mappings
    mapping(uint256 => Guess) public guesses; // requestId => Guess
    mapping(address => uint256) public playerWins;
    mapping(address => uint256) public playerGuesses; // Total guesses per player

    // Events
    event GuessSubmitted(
        uint256 indexed requestId,
        address indexed player,
        uint8 number,
        uint256 potAtTime
    );
    event Win(
        address indexed player,
        uint8 guessedNumber,
        uint8 winningNumber,
        uint256 amount
    );
    event Miss(
        address indexed player,
        uint8 guessedNumber,
        uint8 winningNumber,
        uint256 potAtTime
    );
    event PotUpdated(uint256 newPot);

    constructor(
        address _token,
        address _treasury,
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint256 _subscriptionId
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        token = IERC20(_token);
        treasury = _treasury;
        KEY_HASH = _keyHash;
        SUBSCRIPTION_ID = _subscriptionId;
        tokenDecimals = IERC20Metadata(_token).decimals(); // Fetch decimals
    }

    function guess(uint8 number) external whenNotPaused nonReentrant {
        require(
            number >= MIN_GUESS && number <= MAX_GUESS,
            "Invalid guess range"
        );

        uint256 guessCost = GUESS_COST_UNITS * (10 ** tokenDecimals);
        require(
            token.balanceOf(msg.sender) >= guessCost,
            "Insufficient token balance"
        );

        // Transfer all tokens to contract first (user must have approved this contract)
        token.transferFrom(msg.sender, address(this), guessCost);

        // Distribute tokens internally
        uint256 potShare = POT_SHARE_UNITS * (10 ** tokenDecimals);
        uint256 treasuryShare = TREASURY_SHARE_UNITS * (10 ** tokenDecimals);

        pot += potShare;
        // Transfer treasury share from contract to treasury
        token.transfer(treasury, treasuryShare);

        // Request randomness (VRF v2.5 Plus subscription; pay with LINK, not native)
        VRFV2PlusClient.RandomWordsRequest memory req = VRFV2PlusClient
            .RandomWordsRequest({
                keyHash: KEY_HASH,
                subId: SUBSCRIPTION_ID,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            });

        uint256 requestId = s_vrfCoordinator.requestRandomWords(req);

        // Store guess data
        guesses[requestId] = Guess({
            player: msg.sender,
            number: number,
            potAtTime: pot
        });

        // Increment player's total guesses
        playerGuesses[msg.sender]++;

        emit GuessSubmitted(requestId, msg.sender, number, pot);
        emit PotUpdated(pot);
    }

    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        Guess memory guessData = guesses[requestId];
        require(guessData.player != address(0), "Invalid request ID");

        uint8 winningNumber = uint8((randomWords[0] % 100) + 1);
        uint8 guessedNumber = guessData.number;

        if (guessedNumber == winningNumber) {
            // Player wins the entire pot
            uint256 winAmount = pot;
            pot = 0; // Reset pot to zero
            playerWins[guessData.player] += winAmount;

            // Transfer winnings to player
            token.transfer(guessData.player, winAmount);

            emit Win(guessData.player, guessedNumber, winningNumber, winAmount);
        } else {
            // Player misses, pot continues growing
            emit Miss(guessData.player, guessedNumber, winningNumber, pot);
        }

        // Clean up guess data
        delete guesses[requestId];
    }

    // View functions
    function getPot() external view returns (uint256) {
        return pot;
    }

    function getPlayerWins(address player) external view returns (uint256) {
        return playerWins[player];
    }

    // Owner functions
    function addToPot(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        pot += amount;
        emit PotUpdated(pot);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        if (balance > 0) {
            token.transfer(owner(), balance);
        }
    }

    // Allow contract to receive ETH for gas payments
    receive() external payable {
        // Contract can receive ETH to pay for gas
    }
}
