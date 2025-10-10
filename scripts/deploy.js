const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // Configuration
    const DEGEN_TOKEN = process.env.DEGEN_TOKEN || "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed";
    const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || deployer.address;
    const VRF_COORDINATOR = process.env.VRF_COORDINATOR || "0x271682DEB8C4E0901D1a1550aD2e64D568E69909";
    const VRF_KEY_HASH = process.env.VRF_KEY_HASH || "0x8af398995b04c28e9951adb9721ef74c74f93e6a478f39e7e077fbe33a8f4";
    const VRF_SUBSCRIPTION_ID = process.env.VRF_SUBSCRIPTION_ID || "1";

    console.log("Configuration:");
    console.log("- DEGEN Token:", DEGEN_TOKEN);
    console.log("- Treasury:", TREASURY_ADDRESS);
    console.log("- VRF Coordinator:", VRF_COORDINATOR);
    console.log("- VRF Key Hash:", VRF_KEY_HASH);
    console.log("- VRF Subscription ID:", VRF_SUBSCRIPTION_ID);

    // Deploy the contract
    const GuessGame = await ethers.getContractFactory("GuessGame");
    const guessGame = await GuessGame.deploy(
        DEGEN_TOKEN,
        TREASURY_ADDRESS,
        VRF_COORDINATOR,
        VRF_KEY_HASH,
        VRF_SUBSCRIPTION_ID
    );

    await guessGame.deployed();

    console.log("GuessGame deployed to:", guessGame.address);
    console.log("Transaction hash:", guessGame.deployTransaction.hash);

    // Verify the contract (optional)
    if (process.env.VERIFY_CONTRACT === "true") {
        console.log("Waiting for block confirmations...");
        await guessGame.deployTransaction.wait(6);

        try {
            await hre.run("verify:verify", {
                address: guessGame.address,
                constructorArguments: [
                    DEGEN_TOKEN,
                    TREASURY_ADDRESS,
                    VRF_COORDINATOR,
                    VRF_KEY_HASH,
                    VRF_SUBSCRIPTION_ID
                ],
            });
            console.log("Contract verified successfully!");
        } catch (error) {
            console.log("Verification failed:", error.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

