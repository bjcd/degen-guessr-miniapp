// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {
    VRFConsumerBaseV2Plus
} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {
    VRFV2PlusClient
} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract DegenGuessr is VRFConsumerBaseV2Plus, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Chainlink VRF v2.5+ variables
    bytes32 private immutable KEY_HASH;
    uint256 private immutable SUBSCRIPTION_ID;
    uint16 private constant REQUEST_CONFIRMATIONS = 0; // Base Sepolia: 0 confs; Base Mainnet: use 2+
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

    // NFT free guess feature
    IERC721 public nftContract;
    bool public nftFreeGuessesEnabled;
    mapping(address => uint256) public lastFreeGuessTimestamp;
    uint256 private constant ONE_DAY = 86400; // 24 hours in seconds

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
    event FreeGuessUsed(address indexed player, uint256 timestamp);
    event NftFreeGuessesToggled(bool enabled);
    event NftContractUpdated(address indexed nftContract);

    constructor(
        address _token,
        address _treasury,
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint256 _subscriptionId
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        // ✅ Added: Constructor validation
        require(_token != address(0), "Zero address: token");
        require(_treasury != address(0), "Zero address: treasury");
        require(_vrfCoordinator != address(0), "Zero address: VRF");

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

        bool isFreeGuess = false;

        // Check if NFT free guess is available
        if (nftFreeGuessesEnabled && address(nftContract) != address(0)) {
            // Check if player owns at least one NFT
            if (nftContract.balanceOf(msg.sender) > 0) {
                // Check if 24 hours have passed since last free guess
                if (
                    block.timestamp >=
                    lastFreeGuessTimestamp[msg.sender] + ONE_DAY
                ) {
                    isFreeGuess = true;
                    lastFreeGuessTimestamp[msg.sender] = block.timestamp;
                    emit FreeGuessUsed(msg.sender, block.timestamp);
                }
            }
        }

        // If not eligible for free guess, process payment
        if (!isFreeGuess) {
            uint256 guessCost = GUESS_COST_UNITS * (10 ** tokenDecimals);
            require(
                token.balanceOf(msg.sender) >= guessCost,
                "Insufficient token balance"
            );

            // ✅ Changed: safeTransferFrom instead of transferFrom
            token.safeTransferFrom(msg.sender, address(this), guessCost);

            // Distribute tokens internally
            uint256 potShare = POT_SHARE_UNITS * (10 ** tokenDecimals);
            uint256 treasuryShare = TREASURY_SHARE_UNITS *
                (10 ** tokenDecimals);

            pot += potShare;
            // ✅ Changed: safeTransfer instead of transfer
            token.safeTransfer(treasury, treasuryShare);
        }

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

        // ✅ Changed: Use MAX_GUESS constant instead of hardcoded 100
        uint8 winningNumber = uint8((randomWords[0] % MAX_GUESS) + 1);
        uint8 guessedNumber = guessData.number;

        // ✅ Changed: Delete guess data BEFORE external calls (CEI pattern)
        delete guesses[requestId];

        if (guessedNumber == winningNumber) {
            // Player wins the entire pot
            uint256 winAmount = pot;
            pot = 0; // Reset pot to zero
            playerWins[guessData.player] += winAmount;

            // ✅ Changed: safeTransfer instead of transfer
            token.safeTransfer(guessData.player, winAmount);

            emit Win(guessData.player, guessedNumber, winningNumber, winAmount);
        } else {
            // Player misses, pot continues growing
            emit Miss(guessData.player, guessedNumber, winningNumber, pot);
        }

        emit PotUpdated(pot);
    }

    // View functions
    function getPot() external view returns (uint256) {
        return pot;
    }

    function getPlayerWins(address player) external view returns (uint256) {
        return playerWins[player];
    }

    // Owner functions

    // ✅ Changed: addToPot now properly transfers tokens to contract
    function addToPot(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");

        // Transfer tokens from owner to contract (owner must approve first)
        token.safeTransferFrom(msg.sender, address(this), amount);

        pot += amount;
        emit PotUpdated(pot);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // NFT free guess admin functions

    /**
     * @dev Set the NFT contract address for free guess eligibility
     * @param _nftContract Address of the ERC721 NFT contract
     */
    function setNftContract(address _nftContract) external onlyOwner {
        nftContract = IERC721(_nftContract);
        emit NftContractUpdated(_nftContract);
    }

    /**
     * @dev Toggle the NFT free guess feature on/off
     * @param _enabled True to enable, false to disable
     */
    function setNftFreeGuessesEnabled(bool _enabled) external onlyOwner {
        nftFreeGuessesEnabled = _enabled;
        emit NftFreeGuessesToggled(_enabled);
    }

    /**
     * @dev Emergency function to reset a user's free guess timestamp
     * @param user Address of the user
     * @param timestamp New timestamp value (0 to reset)
     */
    function setLastFreeGuessTimestamp(
        address user,
        uint256 timestamp
    ) external onlyOwner {
        lastFreeGuessTimestamp[user] = timestamp;
    }

    // ✅ IMPROVED: Protected emergency withdrawal
    // Only allows withdrawing "excess" funds beyond the pot
    // This protects player funds while still allowing emergency recovery
    function emergencyWithdraw() external onlyOwner whenPaused {
        uint256 balance = token.balanceOf(address(this));

        // Ensure pot accounting is correct
        require(balance >= pot, "Invariant violated: balance < pot");

        uint256 excess = balance - pot;
        require(excess > 0, "No excess funds to withdraw");

        // Only withdraw excess, never touch the pot
        token.safeTransfer(owner(), excess);
    }

    // ✅ IMPROVED: Withdraw ETH with pause requirement
    // Protects against accidental drainage during active gameplay
    function withdrawETH(
        address payable to,
        uint256 amount
    ) external onlyOwner whenPaused {
        require(to != address(0), "Invalid address");
        require(address(this).balance >= amount, "Insufficient ETH balance");
        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    // Allow contract to receive ETH for gas payments
    receive() external payable {
        // Contract can receive ETH to pay for gas
    }
}
