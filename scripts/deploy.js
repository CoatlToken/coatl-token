import pkg from 'hardhat';
const { ethers } = pkg;

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contract with account:", deployer.address);

    // Define initial supply and multi-signature wallet address
    const initialSupply = ethers.utils.parseUnits("875000000", 18); // 875M tokens
    const multiSigWallet = "0x2C3F8ca14707BbbbbdFe815F810F22CC7B1b8C34"; // Replace with actual multi-signature wallet address

    if (!ethers.utils.isAddress(multiSigWallet)) {
        throw new Error("Invalid multi-signature wallet address");
    }

    console.log("Initial supply:", initialSupply.toString());
    console.log("Multi-signature wallet address:", multiSigWallet);

    const Token = await ethers.getContractFactory("Coatl");

    let deployed = false;
    const gasPriceThreshold = ethers.utils.parseUnits("19.6", "gwei"); // Configurable gas price threshold

    while (!deployed) {
        try {
            // Obtain the current gas price from the network
            const gasPrice = await ethers.provider.getGasPrice();
            console.log("Current Gas Price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");

            // Estimate the gas cost for deployment
            const deploymentTransaction = Token.getDeployTransaction(initialSupply, multiSigWallet);
            const gasEstimate = await ethers.provider.estimateGas(deploymentTransaction);
            const totalGasCost = gasEstimate.mul(gasPrice);
            const totalGasCostInEth = ethers.utils.formatEther(totalGasCost);

            console.log("Gas estimate for deployment:", gasEstimate.toString());
            console.log("Total Gas Cost for deployment (in ETH):", totalGasCostInEth);

            // Check if gas price is below the threshold
            if (gasPrice.lt(gasPriceThreshold)) {
                console.log("Gas price is below threshold. Deploying contract...");
                const token = await Token.deploy(initialSupply, multiSigWallet, { gasPrice });
                await token.deployed();
                console.log("Token deployed to:", token.address);
                deployed = true;
            } else {
                console.log("Gas price is above threshold. Waiting for gas price to decrease...");
                await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait for 1 minute
            }
        } catch (error) {
            console.error("Error during deployment:", error.message);
            console.log("Retrying deployment...");
        }
    }
}

main().catch((error) => {
    console.error("Deployment failed:", error.message);
    process.exitCode = 1;
});