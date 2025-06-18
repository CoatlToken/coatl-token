import pkg from 'hardhat';
const { ethers } = pkg;

async function main() {
    // Replace these with your actual values or load from config
    const TOKEN_ADDRESS = "0xe9F7988625A37Dacf425e6062f4F73B56ffc6177";
    const PRICE_FEED_ADDRESS = "0x694AA1769357215DE4FAC081bf1f309aDC325306"; // Chainlink ETH/USD price feed address
    const SOFT_CAP = ethers.utils.parseEther("15000000"); // 15 million tokens (18 decimals)
    const HARD_CAP = ethers.utils.parseEther("350000000"); // 350 million tokens (18 decimals)
    const PROJECT_WALLET = "0x694AA1769357215DE4FAC081bf1f309aDC325306";

    const now = Math.floor(Date.now() / 1000);
    const start = now + 60; // ICO starts in 1 minute
    const end = start + 90 * 24 * 60 * 60; // 90 days after start

    const ICO = await ethers.getContractFactory("ICO");
    const ico = await ICO.deploy(
        TOKEN_ADDRESS,
        PRICE_FEED_ADDRESS,
        SOFT_CAP,
        HARD_CAP,
        start,
        end,
        PROJECT_WALLET
    );
    await ico.deployed();

    console.log("ICO deployed to:", ico.address);
    console.log("Start:", start, "End:", end);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});