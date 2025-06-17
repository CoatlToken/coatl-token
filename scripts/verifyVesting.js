import pkg from "hardhat";
const { run } = pkg;

// Replace with your deployed contract address and constructor arguments
const vestingAddress = "0xd3aD4a250f70Da1d4C6704761A3E7e545675BE72";
const coatlTokenAddress = "0xe9F7988625A37Dacf425e6062f4F73B56ffc6177";

async function main() {
    await run("verify:verify", {
        address: vestingAddress,
        constructorArguments: [coatlTokenAddress],
    });
    console.log("Verification submitted for:", vestingAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});