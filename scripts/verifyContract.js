import pkg from 'hardhat';
const { run } = pkg;

async function verify() {
    const deployedAddress = "0x709F06D83fcD7b9C8aa0A126D3Dd794575d3c149"; // Replace with your deployed contract address
    const initialSupply = "875000000000000000000000000"; // 875M tokens with 18 decimals
    const multiSigWallet = "0x2C3F8ca14707BbbbbdFe815F810F22CC7B1b8C34";
    const feeReceiver = "0xEe1f89F8cc7690eC50F48990C199D6a0D6b2806A";
    const initialWhitelistedAccounts = [
        "0x4c1921E6577fc9857533824D46866fafD05c32D0",
        "0xd6B1EBa32957B58832DC3cbB9a5e8157b412e346",
        "0x4CE2859327E2F672d541f44a520FF1892996a41f"
    ];

    try {
        await run("verify:verify", {
            address: deployedAddress,
            constructorArguments: [
                initialSupply,
                multiSigWallet,
                feeReceiver,
                initialWhitelistedAccounts
            ]
        });
        console.log("Contract verified successfully!");
    } catch (error) {
        console.error("Verification failed:", error.message);
    }
}

verify();