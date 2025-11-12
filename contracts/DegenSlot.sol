// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/**
 * @title DegenSlot
 * @dev 3-slot $DEGEN game with Chainlink VRF v2.5+
 *
 * Economics:
 * - Cost per spin: 100 $DEGEN
 * - Pot addition per spin: 70 $DEGEN (70%)
 * - Treasury addition per spin: 30 $DEGEN (30%)
 * - All payouts come from pot
 * - Expected steady-state pot: ~4,600 $DEGEN
 * - RTP: ~70%, House edge: 30%
 *
 * Payouts (all from pot):
 * - Jackpot (🎩🎩🎩): 50% of current pot
 * - Three-of-a-kind (non-hat): 500 $DEGEN
 * - Two-of-a-kind (any): 250 $DEGEN
 * - One hat (exactly one 🎩): 50 $DEGEN
 * - Two hats (exactly two 🎩): 350 $DEGEN
 * - No win: 0 $DEGEN
 *
 * Probabilities (Final):
 * - Jackpot: 0.15% (15 bps)
 * - Three-same non-hat: 0.96% (96 bps)
 * - Two-same: 18.00% (1800 bps)
 * - One hat: 30.00% (3000 bps)
 * - Two hats: 0.50% (50 bps)
 * - Nothing: 50.39% (5039 bps)
 */
contract DegenSlot is VRFConsumerBaseV2Plus, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ ENUMS ============

    /// @dev Result categories for spin outcomes
    enum Cat {
        Nothing,
        TwoSame,
        ThreeSame,
        Jackpot,
        OneHat,
        TwoHats
    }

    // ============ CUSTOM ERRORS ============

    /// @dev Thrown when pot is too small after top-up
    error PotTooSmall();

    /// @dev Thrown when player has pending request
    error Pending();

    /// @dev Thrown when VRF request is invalid
    error InvalidRequest();

    /// @dev Thrown when insufficient pot balance
    error InsufficientPot();

    /// @dev Thrown when no treasury funds available
    error NoTreasuryFunds();

    // ============ CONSTANTS ============

    /// @dev Cost per spin in $DEGEN tokens
    uint256 public constant COST_PER_SPIN = 100e18;

    /// @dev Amount added to pot per spin
    uint256 public constant POT_ADD_PER_SPIN = 70e18;

    /// @dev Amount added to treasury per spin
    uint256 public constant TREASURY_ADD_PER_SPIN = 30e18;

    /// @dev Initial pot seed amount (set to 0, must be seeded via addToPot)
    uint256 public constant INITIAL_POT = 0;

    // ============ PAYOUTS ============

    /// @dev Three-of-a-kind payout (non-hat only)
    uint256 public constant THREE_SAME_PAYOUT = 500e18;

    /// @dev Two-of-a-kind payout (any symbol)
    uint256 public constant TWO_SAME_PAYOUT = 250e18;

    /// @dev One hat payout (exactly one 🎩)
    uint256 public constant ONE_HAT_PAYOUT = 50e18;

    /// @dev Two hats payout (exactly two 🎩)
    uint256 public constant TWO_HATS_PAYOUT = 350e18;

    /// @dev Minimum pot size after top-up (covers largest fixed payout)
    uint256 public constant MIN_POT_AFTER_TOPUP = 500e18;

    // ============ PROBABILITY THRESHOLDS (Rebalanced) ============

    /// @dev Jackpot probability in basis points (0.15%)
    uint256 public constant P_JACKPOT_BPS = 15;

    /// @dev Three-same non-hat probability in basis points (0.96%)
    uint256 public constant P_THREE_SAME_BPS = 96;

    /// @dev Two-same probability in basis points (18.00%)
    uint256 public constant P_TWO_SAME_BPS = 1800;

    /// @dev One hat probability in basis points (30.00%)
    uint256 public constant P_ONE_HAT_BPS = 3000;

    /// @dev Two hats probability in basis points (0.50%)
    uint256 public constant P_TWO_HATS_BPS = 50;

    /// @dev Nothing probability in basis points (50.39%)
    uint256 public constant P_NOTHING_BPS = 5039;

    // ============ CUMULATIVE RANGES ============

    /// @dev Jackpot range: [0, 15)
    uint256 public constant JACKPOT_RANGE_START = 0;
    uint256 public constant JACKPOT_RANGE_END = P_JACKPOT_BPS;

    /// @dev Three-same non-hat range: [15, 111)
    uint256 public constant THREE_SAME_RANGE_START = P_JACKPOT_BPS;
    uint256 public constant THREE_SAME_RANGE_END =
        P_JACKPOT_BPS + P_THREE_SAME_BPS;

    /// @dev Two-same range: [111, 1911)
    uint256 public constant TWO_SAME_RANGE_START =
        P_JACKPOT_BPS + P_THREE_SAME_BPS;
    uint256 public constant TWO_SAME_RANGE_END =
        P_JACKPOT_BPS + P_THREE_SAME_BPS + P_TWO_SAME_BPS;

    /// @dev One hat range: [1911, 4911)
    uint256 public constant ONE_HAT_RANGE_START =
        P_JACKPOT_BPS + P_THREE_SAME_BPS + P_TWO_SAME_BPS;
    uint256 public constant ONE_HAT_RANGE_END =
        P_JACKPOT_BPS + P_THREE_SAME_BPS + P_TWO_SAME_BPS + P_ONE_HAT_BPS;

    /// @dev Two hats range: [4911, 4961)
    uint256 public constant TWO_HATS_RANGE_START =
        P_JACKPOT_BPS + P_THREE_SAME_BPS + P_TWO_SAME_BPS + P_ONE_HAT_BPS;
    uint256 public constant TWO_HATS_RANGE_END =
        P_JACKPOT_BPS +
            P_THREE_SAME_BPS +
            P_TWO_SAME_BPS +
            P_ONE_HAT_BPS +
            P_TWO_HATS_BPS;

    /// @dev Nothing range: [4961, 10000)
    uint256 public constant NOTHING_RANGE_START =
        P_JACKPOT_BPS +
            P_THREE_SAME_BPS +
            P_TWO_SAME_BPS +
            P_ONE_HAT_BPS +
            P_TWO_HATS_BPS;
    uint256 public constant NOTHING_RANGE_END = 10000;

    // ============ STATE VARIABLES ============

    /// @dev $DEGEN token contract
    IERC20 public immutable degenToken;

    /// @dev Treasury address for house profits
    address public immutable treasury;

    /// @dev Current pot balance
    uint256 public pot;

    /// @dev Treasury balance
    uint256 public treasuryBalance;

    /// @dev VRF request ID to player mapping
    mapping(uint256 => address) public requestToPlayer;

    /// @dev Player to pending request mapping (prevents multiple pending requests)
    mapping(address => bool) public hasPendingRequest;

    // NFT free spin feature
    IERC721 public nftContract;
    bool public nftFreeSpinsEnabled;
    mapping(address => uint256) public lastFreeSpinTimestamp;
    uint256 private constant ONE_WEEK = 604800; // 7 days in seconds

    // ============ EVENTS ============

    /// @dev Emitted when a spin is initiated
    event SpinInitiated(
        address indexed player,
        uint256 indexed requestId,
        uint256 potBefore
    );

    /// @dev Emitted when a spin result is fulfilled
    event SpinResult(
        address indexed player,
        uint16 roll,
        uint8 category, // Cat enum as uint8
        uint256 payout,
        uint256 potAfter
    );

    /// @dev Emitted when pot is seeded
    event PotSeeded(uint256 amount, uint256 newPot);

    /// @dev Emitted when treasury is withdrawn
    event TreasuryWithdrawn(address indexed to, uint256 amount);

    /// @dev Emitted when a stuck pending request is cleared
    event StuckRequestCleared(address indexed player);

    /// @dev Emitted when a free spin is used
    event FreeSpinUsed(address indexed player, uint256 timestamp);

    /// @dev Emitted when NFT free spins are toggled
    event NftFreeSpinsToggled(bool enabled);

    /// @dev Emitted when NFT contract is updated
    event NftContractUpdated(address indexed nftContract);

    // ============ CONSTRUCTOR ============

    constructor(
        address _degenToken,
        address _treasury,
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint256 _subscriptionId
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        degenToken = IERC20(_degenToken);
        treasury = _treasury;

        // Set VRF parameters
        KEY_HASH = _keyHash;
        SUBSCRIPTION_ID = _subscriptionId;

        // Pot starts at 0 - must be seeded via addToPot function
        pot = 0;
    }

    // ============ VRF PARAMETERS ============

    bytes32 private immutable KEY_HASH;
    uint256 private immutable SUBSCRIPTION_ID;
    uint16 private constant REQUEST_CONFIRMATIONS = 0; // Base Sepolia: 0 confs; Base Mainnet: use 2+
    uint32 private constant CALLBACK_GAS_LIMIT = 200000; // headroom for fulfill
    uint32 private constant NUM_WORDS = 1;

    // ============ MAIN FUNCTIONS ============

    /**
     * @dev Initiate a spin by paying cost and requesting VRF
     * @notice Player must have approved this contract to spend $DEGEN tokens (unless using free spin)
     */
    function spin() external nonReentrant whenNotPaused {
        if (hasPendingRequest[msg.sender]) {
            revert Pending();
        }

        bool isFreeSpin = false;

        // Check if NFT free spin is available
        if (nftFreeSpinsEnabled && address(nftContract) != address(0)) {
            // Check if player owns at least one NFT
            if (nftContract.balanceOf(msg.sender) > 0) {
                // Check if 7 days have passed since last free spin
                if (
                    block.timestamp >=
                    lastFreeSpinTimestamp[msg.sender] + ONE_WEEK
                ) {
                    isFreeSpin = true;
                    lastFreeSpinTimestamp[msg.sender] = block.timestamp;
                    emit FreeSpinUsed(msg.sender, block.timestamp);
                }
            }
        }

        // If not eligible for free spin, process payment
        if (!isFreeSpin) {
            // Transfer cost from player
            degenToken.safeTransferFrom(msg.sender, address(this), COST_PER_SPIN);

            // Update pot and treasury
            pot += POT_ADD_PER_SPIN;
            treasuryBalance += TREASURY_ADD_PER_SPIN;
        }

        // Safety guard: ensure pot can cover largest fixed payout
        if (pot < MIN_POT_AFTER_TOPUP) {
            revert PotTooSmall();
        }

        // Request VRF
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

        // Store mapping
        requestToPlayer[requestId] = msg.sender;
        hasPendingRequest[msg.sender] = true;

        emit SpinInitiated(msg.sender, requestId, pot - POT_ADD_PER_SPIN);
    }

    /**
     * @dev VRF callback to fulfill spin result
     * @param requestId The VRF request ID
     * @param randomWords Array of random words from VRF
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        address player = requestToPlayer[requestId];
        if (player == address(0)) {
            revert InvalidRequest();
        }

        // Clear pending request
        hasPendingRequest[player] = false;
        delete requestToPlayer[requestId];

        // Generate roll (0-9999)
        uint256 roll = randomWords[0] % 10000;

        // Cache pot for gas optimization
        uint256 currentPot = pot;

        // Determine category and payout
        (Cat category, uint256 payout) = _determineResult(roll, currentPot);

        // Process payout if any
        if (payout > 0) {
            if (currentPot < payout) {
                revert InsufficientPot();
            }
            currentPot -= payout;
            pot = currentPot; // Write back to storage
            degenToken.safeTransfer(player, payout);
        }

        emit SpinResult(
            player,
            uint16(roll),
            uint8(category),
            payout,
            currentPot
        );
    }

    /**
     * @dev Determine spin result based on roll
     * @param roll Random number 0-9999
     * @param currentPot Current pot balance for percentage-based jackpot
     * @return category Result category enum
     * @return payout Payout amount in wei
     */
    function _determineResult(
        uint256 roll,
        uint256 currentPot
    ) internal pure returns (Cat category, uint256 payout) {
        if (roll >= JACKPOT_RANGE_START && roll < JACKPOT_RANGE_END) {
            // Jackpot: 50% of current pot
            return (Cat.Jackpot, currentPot / 2);
        } else if (
            roll >= THREE_SAME_RANGE_START && roll < THREE_SAME_RANGE_END
        ) {
            return (Cat.ThreeSame, THREE_SAME_PAYOUT);
        } else if (roll >= TWO_SAME_RANGE_START && roll < TWO_SAME_RANGE_END) {
            return (Cat.TwoSame, TWO_SAME_PAYOUT);
        } else if (roll >= ONE_HAT_RANGE_START && roll < ONE_HAT_RANGE_END) {
            return (Cat.OneHat, ONE_HAT_PAYOUT);
        } else if (roll >= TWO_HATS_RANGE_START && roll < TWO_HATS_RANGE_END) {
            return (Cat.TwoHats, TWO_HATS_PAYOUT);
        } else {
            return (Cat.Nothing, 0);
        }
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @dev Add funds to pot (for initial seeding or emergency)
     * @param amount Amount to add to pot
     */
    function addToPot(uint256 amount) external onlyOwner {
        degenToken.safeTransferFrom(msg.sender, address(this), amount);
        pot += amount;
        emit PotSeeded(amount, pot);
    }

    /**
     * @dev Withdraw treasury funds
     */
    function withdrawTreasury() external onlyOwner {
        uint256 amount = treasuryBalance;
        if (amount == 0) {
            revert NoTreasuryFunds();
        }

        treasuryBalance = 0;
        degenToken.safeTransfer(treasury, amount);

        emit TreasuryWithdrawn(treasury, amount);
    }

    /**
     * @dev Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Clear stuck pending request (emergency function)
     * @param player The player whose pending request should be cleared
     */
    function clearStuckPendingRequest(address player) external onlyOwner {
        if (!hasPendingRequest[player]) {
            revert InvalidRequest();
        }

        hasPendingRequest[player] = false;
        emit StuckRequestCleared(player);
    }

    /**
     * @dev Set the NFT contract for free spins
     * @param _nftContract Address of the NFT contract
     */
    function setNftContract(address _nftContract) external onlyOwner {
        nftContract = IERC721(_nftContract);
        emit NftContractUpdated(_nftContract);
    }

    /**
     * @dev Toggle NFT free spins feature
     * @param _enabled Whether to enable or disable free spins
     */
    function setNftFreeSpinsEnabled(bool _enabled) external onlyOwner {
        nftFreeSpinsEnabled = _enabled;
        emit NftFreeSpinsToggled(_enabled);
    }

    /**
     * @dev Set last free spin timestamp for a player (admin function for testing/emergency)
     * @param player The player address
     * @param timestamp The timestamp to set
     */
    function setLastFreeSpinTimestamp(address player, uint256 timestamp) external onlyOwner {
        lastFreeSpinTimestamp[player] = timestamp;
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @dev Get current pot balance
     */
    function getPot() external view returns (uint256) {
        return pot;
    }

    /**
     * @dev Get current treasury balance
     */
    function getTreasuryBalance() external view returns (uint256) {
        return treasuryBalance;
    }

    /**
     * @dev Get contract owner address
     */
    function getOwner() external view returns (address) {
        return owner();
    }

    /**
     * @dev Get all probability thresholds for frontend
     */
    function getAllThresholds() external pure returns (uint256[12] memory t) {
        t = [
            JACKPOT_RANGE_START,
            JACKPOT_RANGE_END,
            THREE_SAME_RANGE_START,
            THREE_SAME_RANGE_END,
            TWO_SAME_RANGE_START,
            TWO_SAME_RANGE_END,
            ONE_HAT_RANGE_START,
            ONE_HAT_RANGE_END,
            TWO_HATS_RANGE_START,
            TWO_HATS_RANGE_END,
            NOTHING_RANGE_START,
            NOTHING_RANGE_END
        ];
    }

    /**
     * @dev Get fixed payout amounts for frontend
     */
    function getFixedPayouts()
        external
        pure
        returns (
            uint256 threeSame,
            uint256 twoSame,
            uint256 oneHat,
            uint256 twoHats,
            uint16 jackpotShareBps
        )
    {
        return (
            THREE_SAME_PAYOUT,
            TWO_SAME_PAYOUT,
            ONE_HAT_PAYOUT,
            TWO_HATS_PAYOUT,
            5000
        );
    }

    /**
     * @dev Get game constants for frontend
     */
    function getGameConstants()
        external
        pure
        returns (
            uint256 costPerSpin,
            uint256 potAddPerSpin,
            uint256 treasuryAddPerSpin,
            uint256 initialPot
        )
    {
        return (
            COST_PER_SPIN,
            POT_ADD_PER_SPIN,
            TREASURY_ADD_PER_SPIN,
            INITIAL_POT
        );
    }
}
