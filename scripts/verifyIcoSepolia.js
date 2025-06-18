import pkg from "hardhat";
const { run } = pkg;

async function main() {
    const ICO_ADDRESS = "0x8Cb625a258f5f31347a6417f0C213512599D3180";

    const TOKEN_ADDRESS = "0xe9F7988625A37Dacf425e6062f4F73B56ffc6177";
    const PRICE_FEED_ADDRESS = "0x694AA1769357215DE4FAC081bf1f309aDC325306"; // Chainlink ETH/USD price feed address
    const SOFT_CAP = ethers.utils.parseEther("15000000"); // 15 million tokens (18 decimals)
    const HARD_CAP = ethers.utils.parseEther("350000000"); // 350 million tokens (18 decimals)
    const PROJECT_WALLET = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
    const START = 1750123578; // Replace with your actual start timestamp
    const END = 1757899578;   // Replace with your actual end timestamp

    await run("verify:verify", {
        address: ICO_ADDRESS,
        constructorArguments: [
            TOKEN_ADDRESS,
            PRICE_FEED_ADDRESS,
            SOFT_CAP,
            HARD_CAP,
            START,
            END,
            PROJECT_WALLET
        ],
    });

    console.log("Verification submitted for:", ICO_ADDRESS);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});