require("@nomiclabs/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");
const dotenv = require("dotenv");
dotenv.config();

const { PRIVATE_KEY_MAIN, PRIVATE_KEY_TEST1, INFURA_API_KEY, ETHERSCAN_API_KEY, DEFENDER_API_KEY, DEFENDER_SECRET_KEY } = process.env;

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
        apiKey: ETHERSCAN_API_KEY,
    },
    defender: {
        apiKey: DEFENDER_API_KEY,
        apiSecret: DEFENDER_SECRET_KEY,
    },
};
