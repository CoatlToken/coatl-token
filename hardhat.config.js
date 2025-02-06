require("@nomiclabs/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

const { PRIVATE_KEY_MAIN, PRIVATE_KEY_TEST1, INFURA_API_KEY, ETHERSCAN_API_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: "0.8.28",
    networks: {
        sepolia: {
            url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [`0x${PRIVATE_KEY_MAIN}`, `0x${PRIVATE_KEY_TEST1}`],
        },
        mainnet: {
            url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [`0x${PRIVATE_KEY_MAIN}`],
        },
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY
    }
};
