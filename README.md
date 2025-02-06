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

3. Create a [.env](http://_vscodecontentref_/1) file in the root directory and add the following environment variables:
    ```env
    PRIVATE_KEY_MAIN=your_mainnet_private_key
    PRIVATE_KEY_TEST1=your_testnet_private_key
    INFURA_API_KEY=your_infura_api_key
    ETHERSCAN_API_KEY=your_etherscan_api_key
    ```

## Project Structure

- [contracts](http://_vscodecontentref_/2): Contains the Solidity smart contracts.
  - [Coatl.sol](http://_vscodecontentref_/3): The main Coatl token contract.
- [scripts](http://_vscodecontentref_/4): Contains the deployment and utility scripts.
  - [deploy.js](http://_vscodecontentref_/5): Script to deploy the Coatl token contract.
  - [changeFee.js](http://_vscodecontentref_/6): Script to change the transfer fee.
  - [moveOwner.js](http://_vscodecontentref_/7): Script to transfer ownership of the contract.
- [test](http://_vscodecontentref_/8): Contains the test files.
  - [Coatl.test.js](http://_vscodecontentref_/9): Test cases for the Coatl token contract.
- [hardhat.config.js](http://_vscodecontentref_/10): Hardhat configuration file.
- [package.json](http://_vscodecontentref_/11): Project dependencies and scripts.
- [.gitignore](http://_vscodecontentref_/12): Files and directories to be ignored by Git.

## Usage

### Deploying the Contract

To deploy the Coatl token contract to sepolia, run the following command:

```sh
npx hardhat run scripts/deploy.js --network sepolia
```

Update the deployment network as needed