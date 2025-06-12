import pkg from 'hardhat';
const { ethers } = pkg;

async function main() {
    // Define initial supply and multi-signature wallet address
    const initialSupply = ethers.utils.parseUnits("875000000", 18); // 875M tokens
    const multiSigWallet = "0x2C3F8ca14707BbbbbdFe815F810F22CC7B1b8C34"; // Replace with actual multi-signature wallet address
    const feeReceiver = "0xEe1f89F8cc7690eC50F48990C199D6a0D6b2806A"; // Replace with actual fee receiver address
    const initialWhitelistedAccounts = [
        "0x4c1921E6577fc9857533824D46866fafD05c32D0",
        "0xd6B1EBa32957B58832DC3cbB9a5e8157b412e346",
        "0x4CE2859327E2F672d541f44a520FF1892996a41f"
    ];

    if (!ethers.utils.isAddress(multiSigWallet)) {
        throw new Error("Invalid multi-signature wallet address");
    }
    if (!ethers.utils.isAddress(feeReceiver)) {
        throw new Error("Invalid fee receiver address");
    }

    console.log("Initial supply:", initialSupply.toString());
    console.log("Multi-signature wallet address:", multiSigWallet);
    console.log("Fee receiver address:", feeReceiver);

    const Token = await ethers.getContractFactory("Coatl");

    try {
        // Obtain the current gas price from the network
        const gasPrice = await ethers.provider.getGasPrice();
        console.log("Current Gas Price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");

        // Estimate the gas cost for deployment
        const deploymentTransaction = Token.getDeployTransaction(initialSupply, multiSigWallet, feeReceiver, initialWhitelistedAccounts);
        const gasEstimate = await ethers.provider.estimateGas(deploymentTransaction);
        const totalGasCost = gasEstimate.mul(gasPrice);
        const totalGasCostInEth = ethers.utils.formatEther(totalGasCost);

        console.log("Gas estimate for deployment:", gasEstimate.toString());
        console.log("Total Gas Cost for deployment (in ETH):", totalGasCostInEth);
    } catch (error) {
        console.error("Error during deployment:", error.message);
        console.log("Retrying deployment...");
    }
}

main().catch((error) => {
    console.error("Deployment failed:", error.message);
    process.exitCode = 1;
});