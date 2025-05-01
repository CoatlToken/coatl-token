# Coatl Token Contract

Coatl is an ERC20 token with additional features such as burnable, pausable, and whitelist/blacklist functionality. This project includes the smart contract for the Coatl token, deployment scripts, and tests.

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- npm (v11 or higher)
- Hardhat (v2.22.17 or higher)

### Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/yourusername/coatl-token.git
    cd coatl-token
    ```

2. Install the dependencies:
    ```sh
    npm install
    ```

3. Create a [.env] file in the root directory and add the following environment variables:
    ```env
    PRIVATE_KEY_MAIN=your_mainnet_private_key
    PRIVATE_KEY_TEST1=your_testnet_private_key
    INFURA_API_KEY=your_infura_api_key
    ETHERSCAN_API_KEY=your_etherscan_api_key
    DEFENDER_API_KEY=your_openzeppelin_defender_api_key
    DEFENDER_SECRET_KEY=your_openzeppelin_defender_secret_key
    ```

## Project Structure

- [contracts]: Contains the Solidity smart contracts.
  - [Coatl.sol]: The main Coatl token contract.
- [scripts]: Contains the deployment and utility scripts.
  - [deploy.js]: Script to deploy the Coatl token contract.
  - [changeFee.js]: Script to change the transfer fee.
  - [moveOwner.js]: Script to transfer ownership of the contract.
- [test]: Contains the test files.
  - [Coatl.test.js]: Test cases for the Coatl token contract.
- [hardhat.config.js]: Hardhat configuration file.
- [package.json]: Project dependencies and scripts.
- [.gitignore]: Files and directories to be ignored by Git.

## Usage

### Deploying the Contract

To deploy the Coatl token contract to sepolia, run the following command:

```sh
npx hardhat run scripts/deploy.js --network sepolia
```

Update the deployment network as needed
