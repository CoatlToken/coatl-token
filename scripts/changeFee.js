const { ethers } = require("hardhat");

async function main() {
    // change transfer fee
    const Token = await ethers.getContractFactory("Coatl");
    const token = await Token.attach("0x5cb81282F8bf43FEd13fFaD7D3E6266bc38891Bd");

    // show current transfer fee
    const fee = await token.transferFee();
    console.log("Current transfer fee:", fee.toString());

    // change transfer fee
    const [deployer] = await ethers.getSigners();
    const newFee = ethers.utils.parseEther("0.000000000000000005");
    console.log("Deploying contract with account:", deployer.address);
    console.log("New transfer fee:", newFee.toString());

    const changeFeeTx = await token.updateFee(newFee);
    await changeFeeTx.wait();

    console.log("Transfer fee changed to:", newFee.toString());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});