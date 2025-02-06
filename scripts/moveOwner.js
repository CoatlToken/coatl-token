const { ethers } = require("hardhat");

async function main() {
    // get token contract
    const Token = await ethers.getContractFactory("MyToken");
    const token = await Token.attach("0x5cb81282F8bf43FEd13fFaD7D3E6266bc38891Bd");

    // show current contract owner
    const owner = await token.owner();
    console.log("Current owner:", owner);

    // move ownership of token contract to a new owner
    const deployer = await ethers.getSigner("0xFE3ad0CFCF6EC1dE063d9163A81616dFC6bF006d");
    const newOwner = await ethers.getSigner("0x4CE2859327E2F672d541f44a520FF1892996a41f");
    const newTest = await ethers.getSigner("0x13CB6AE34A13a0977F4d7101eBc24B87Bb23F0d5");
    console.log("Deploying contract with account:", deployer.address);
    console.log("New owner account:", newOwner.address);
    console.log("New test account:", newTest.address);


    const transferOwnershipTx = await token.transferOwnership(newOwner.address);
    await transferOwnershipTx.wait();

    console.log("Ownership transferred to:", newOwner.address);
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});