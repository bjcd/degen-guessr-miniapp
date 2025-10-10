// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";

contract GuessGame is VRFConsumerBaseV2, ReentrancyGuard, Ownable, Pausable {
    // Chainlink VRF
    VRFCoordinatorV2Interface private immutable COORDINATOR;
    bytes32 private immutable KEY_HASH;
    uint64 private immutable SUBSCRIPTION_ID;
    uint32 private constant CALLBACK_GAS_LIMIT = 100000;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    // Game constants
    uint256 private constant GUESS_COST = 100 * 10 ** 18; // 100 DEGEN
    uint256 private constant POT_SHARE = 90 * 10 ** 18; // 90 DEGEN to pot
    uint256 private constant TREASURY_SHARE = 10 * 10 ** 18; // 10 DEGEN to treasury
    uint8 private constant MIN_GUESS = 1;
    uint8 private constant MAX_GUESS = 100;

    // State variables
    IERC20 public immutable degen;
    address public immutable treasury;
    uint256 public pot;

    // Struct for storing guess data
    struct Guess {
        address player;
        uint8 number;
        uint256 potAtTime;
    }

    // Mappings
    mapping(uint256 => Guess) public guesses; // requestId => Guess
    mapping(address => uint256) public playerWins;

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

    // Permit data structure
    struct PermitData {
        uint256 value;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    constructor(
        address _degen,
        address _treasury,
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint64 _subscriptionId
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        degen = IERC20(_degen);
        treasury = _treasury;
        COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
        KEY_HASH = _keyHash;
        SUBSCRIPTION_ID = _subscriptionId;
    }

    /**
     * @dev Submit a guess using ERC20Permit for gasless approval
     * @param number The number to guess (1-100)
     * @param permit The permit data for gasless token transfer
     */
    function guess(
        uint8 number,
        PermitData calldata permit
    ) external whenNotPaused nonReentrant {
        require(
            number >= MIN_GUESS && number <= MAX_GUESS,
            "Invalid guess range"
        );
        require(
            degen.balanceOf(msg.sender) >= GUESS_COST,
            "Insufficient DEGEN balance"
        );

        // Use permit to approve tokens
        IERC20Permit(address(degen)).permit(
            msg.sender,
            address(this),
            permit.value,
            permit.deadline,
            permit.v,
            permit.r,
            permit.s
        );

        // Transfer tokens
        degen.transferFrom(msg.sender, address(this), GUESS_COST);

        // Distribute tokens
        pot += POT_SHARE;
        degen.transfer(treasury, TREASURY_SHARE);

        // Request randomness
        uint256 requestId = COORDINATOR.requestRandomWords(
            KEY_HASH,
            SUBSCRIPTION_ID,
            REQUEST_CONFIRMATIONS,
            CALLBACK_GAS_LIMIT,
            NUM_WORDS
        );

        // Store guess data
        guesses[requestId] = Guess({
            player: msg.sender,
            number: number,
            potAtTime: pot
        });

        emit GuessSubmitted(requestId, msg.sender, number, pot);
        emit PotUpdated(pot);
    }

    /**
     * @dev Callback function used by VRF Coordinator
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal override {
        Guess memory guessData = guesses[requestId];
        require(guessData.player != address(0), "Invalid request ID");

        // Calculate winning number
        uint8 winningNumber = uint8((randomWords[0] % 100) + 1);

        if (guessData.number == winningNumber) {
            // Player wins!
            uint256 winAmount = pot;
            pot = 0;

            degen.transfer(guessData.player, winAmount);
            playerWins[guessData.player] += winAmount;

            emit Win(
                guessData.player,
                guessData.number,
                winningNumber,
                winAmount
            );
            emit PotUpdated(pot);
        } else {
            // Player misses, pot continues growing
            emit Miss(guessData.player, guessData.number, winningNumber, pot);
        }

        // Clean up storage
        delete guesses[requestId];
    }

    /**
     * @dev Get current pot amount
     */
    function getPot() external view returns (uint256) {
        return pot;
    }

    /**
     * @dev Get player's total wins
     */
    function getPlayerWins(address player) external view returns (uint256) {
        return playerWins[player];
    }

    /**
     * @dev Emergency function to pause the game
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the game
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency function to withdraw stuck tokens (only DEGEN)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = degen.balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        degen.transfer(owner(), balance);
    }
}

