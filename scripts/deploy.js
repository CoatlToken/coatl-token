const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contract with account:", deployer.address);

    const initialSupply = ethers.utils.parseUnits("875000000", 18); // 1M tokens
    const Token = await ethers.getContractFactory("Coatl");

    // Estimate the gas cost to deploy the contract
    const deploymentTransaction = Token.getDeployTransaction(initialSupply);
    const gasEstimate = await ethers.provider.estimateGas(deploymentTransaction); // Estima el gas
    console.log("Gas estimate for deploying contract:", gasEstimate.toString());

    let deployed = false;

    // while (!deployed) {
    //     // Obtain the current gas price from the network
    //     const gasPrice = await ethers.provider.getGasPrice();
    //     console.log("Current Gas Price:", ethers.utils.formatUnits(gasPrice, 'gwei'), "gwei");
    
    //     // Calculate the total gas cost for the deployment
    //     const totalGasCost = gasEstimate.mul(gasPrice);  // Costo total en wei
    //     const totalGasCostInEth = ethers.utils.formatEther(totalGasCost);  // Costo total en ETH
    //     console.log("Total Gas Cost for deployment (in ETH):", totalGasCostInEth);

    //     // check if gas price is less than 19 gwei
    //     if (gasPrice.lt(ethers.utils.parseUnits("19.6", "gwei"))) {
    //         console.log("Gas price is less than 19.6 GWEI. Deploying contract...");
    //         const token = await Token.deploy(initialSupply);
    //         console.log("Token deployed to:", token.address);
    //         deployed = true;
    //     }
    //     else {
    //         console.log("Gas prioce is greater than 19 GWEI. Waiting for gas price to decrease...");
    //         await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 1 minute
    //     }
    // }
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});