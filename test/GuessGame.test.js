const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GuessGame", function () {
    let guessGame;
    let degenToken;
    let owner;
    let player1;
    let player2;
    let treasury;

    beforeEach(async function () {
        [owner, player1, player2, treasury] = await ethers.getSigners();

        // Deploy mock DEGEN token
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        degenToken = await MockERC20.deploy("DEGEN", "DEGEN", ethers.utils.parseEther("1000000"));
        await degenToken.deployed();

        // Deploy GuessGame contract
        const GuessGame = await ethers.getContractFactory("GuessGame");
        guessGame = await GuessGame.deploy(
            degenToken.address,
            treasury.address,
            "0x0000000000000000000000000000000000000000", // Mock VRF coordinator
            "0x0000000000000000000000000000000000000000000000000000000000000000", // Mock key hash
            1 // Mock subscription ID
        );
        await guessGame.deployed();

        // Transfer DEGEN tokens to players
        await degenToken.transfer(player1.address, ethers.utils.parseEther("1000"));
        await degenToken.transfer(player2.address, ethers.utils.parseEther("1000"));
    });

    describe("Deployment", function () {
        it("Should set the correct DEGEN token address", async function () {
            expect(await guessGame.degen()).to.equal(degenToken.address);
        });

        it("Should set the correct treasury address", async function () {
            expect(await guessGame.treasury()).to.equal(treasury.address);
        });

        it("Should initialize pot to zero", async function () {
            expect(await guessGame.getPot()).to.equal(0);
        });
    });

    describe("Game Logic", function () {
        it("Should reject invalid guess range", async function () {
            const permitData = {
                value: ethers.utils.parseEther("100"),
                deadline: Math.floor(Date.now() / 1000) + 3600,
                v: 0,
                r: "0x0000000000000000000000000000000000000000000000000000000000000000",
                s: "0x0000000000000000000000000000000000000000000000000000000000000000"
            };

            await expect(
                guessGame.connect(player1).guess(0, permitData)
            ).to.be.revertedWith("Invalid guess range");

            await expect(
                guessGame.connect(player1).guess(101, permitData)
            ).to.be.revertedWith("Invalid guess range");
        });

        it("Should require sufficient DEGEN balance", async function () {
            // Transfer only 50 DEGEN to player1
            await degenToken.transfer(player1.address, ethers.utils.parseEther("50"));

            const permitData = {
                value: ethers.utils.parseEther("100"),
                deadline: Math.floor(Date.now() / 1000) + 3600,
                v: 0,
                r: "0x0000000000000000000000000000000000000000000000000000000000000000",
                s: "0x0000000000000000000000000000000000000000000000000000000000000000"
            };

            await expect(
                guessGame.connect(player1).guess(50, permitData)
            ).to.be.revertedWith("Insufficient DEGEN balance");
        });
    });

    describe("Pause Functionality", function () {
        it("Should allow owner to pause", async function () {
            await guessGame.pause();
            expect(await guessGame.paused()).to.be.true;
        });

        it("Should not allow non-owner to pause", async function () {
            await expect(
                guessGame.connect(player1).pause()
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should not allow guesses when paused", async function () {
            await guessGame.pause();

            const permitData = {
                value: ethers.utils.parseEther("100"),
                deadline: Math.floor(Date.now() / 1000) + 3600,
                v: 0,
                r: "0x0000000000000000000000000000000000000000000000000000000000000000",
                s: "0x0000000000000000000000000000000000000000000000000000000000000000"
            };

            await expect(
                guessGame.connect(player1).guess(50, permitData)
            ).to.be.revertedWith("Pausable: paused");
        });
    });
});

