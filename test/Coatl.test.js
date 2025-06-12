import pkg from 'hardhat';
const { ethers } = pkg;
import { expect } from "chai";

describe("Coatl", function () {
  let Coatl, coatl, owner, addr1, addr2, multiSigWallet, feeReceiver;

  beforeEach(async function () {
    // Reset contract state
    await ethers.provider.send("hardhat_reset", []);

    // Get signers
    [owner, addr1, addr2, multiSigWallet, feeReceiver] = await ethers.getSigners();

    // Deploy the contract
    Coatl = await ethers.getContractFactory("Coatl");
    coatl = await Coatl.deploy(ethers.utils.parseUnits("875000000", 18), multiSigWallet.address, feeReceiver.address); // Initial supply minted to multiSigWallet
    await coatl.deployed();

    // Distribute tokens from the multi-signature wallet to other accounts for testing
    await coatl.connect(multiSigWallet).transfer(owner.address, ethers.utils.parseEther("500")); // Transfer 500 tokens to the owner
    await coatl.connect(multiSigWallet).transfer(addr1.address, ethers.utils.parseEther("200")); // Transfer 200 tokens to addr1
    await coatl.connect(multiSigWallet).transfer(addr2.address, ethers.utils.parseEther("100")); // Transfer 100 tokens to addr2
  });

  it("Should mint the total supply to the multi-signature wallet", async function () {
    const totalSupply = ethers.utils.parseUnits("875000000", 18); // Initial supply
    const distributedTokens = ethers.utils.parseEther("500") // To owner
        .add(ethers.utils.parseEther("200")) // To addr1
        .add(ethers.utils.parseEther("100")); // To addr2

    const expectedBalance = totalSupply.sub(distributedTokens); // Remaining balance in multiSigWallet
    const multiSigBalance = await coatl.balanceOf(multiSigWallet.address);

    expect(multiSigBalance.toString()).to.equal(expectedBalance.toString());
  });

  it("Should check that the owner has the transferred supply less the fee", async function () {
    const ownerBalance = await coatl.balanceOf(owner.address);
    const feePercentage = await coatl.transferFee();
    const transferAmount = ethers.utils.parseEther("500");
    const fee = transferAmount.mul(feePercentage).div(100);
    const netTransferAmount = transferAmount.sub(fee);
    expect(ownerBalance.toString()).to.equal(netTransferAmount.toString()); // Owner should have 500 tokens
  });

  it("Should transfer tokens between accounts", async function () {
    // Get the current transfer fee percentage
    const feePercentage = await coatl.transferFee(); // Assume this returns the fee as a percentage (e.g., 1 for 1%)

    // Define the transfer amount
    const transferAmount = ethers.utils.parseEther("100");

    // Calculate the fee and net transfer amount
    const fee = transferAmount.mul(feePercentage).div(100); // Fee based on the current percentage
    const netTransferAmount = transferAmount.sub(fee); // Amount received by addr1 after deducting the fee

    // Check the fee receiver's balance before the transfer
    const feeReceiverBalance = await coatl.balanceOf(feeReceiver.address);

    const addr1BalanceBefore = await coatl.balanceOf(addr1.address);

    // Perform the transfer
    await coatl.connect(owner).transfer(addr1.address, transferAmount);

    // Check the recipient's balance
    const addr1Balance = await coatl.balanceOf(addr1.address);
    expect(addr1Balance.toString()).to.equal(addr1BalanceBefore.add(netTransferAmount).toString()); // addr1 starts with 200 tokens

    // Check the multi-signature wallet's balance after the transfer
    const feeReceiverBalanceAfter = await coatl.balanceOf(feeReceiver.address);
    const expectedFeeReceiverBalance = feeReceiverBalance.add(fee); // MultiSig wallet receives the fee
    expect(feeReceiverBalanceAfter.toString()).to.equal(expectedFeeReceiverBalance.toString());
  });

  it("Should allow to burn tokens", async function () {
    const feeReceiverBalance = await coatl.balanceOf(feeReceiver.address);
    const ownerBalanceBefore = await coatl.balanceOf(owner.address);
    const burnFee = await coatl.burnFee(); // Assume this returns the burn fee as a percentage (e.g., 1 for 1%)
    const burnAmount = ethers.utils.parseEther("100");
    const fee = burnAmount.mul(burnFee).div(100); // Fee based on the current percentage
    await coatl.connect(owner).burn(burnAmount);
    const ownerBalance = await coatl.balanceOf(owner.address);
    expect(ownerBalance.toString()).to.equal(ownerBalanceBefore.sub(burnAmount).toString()); // Owner now has 500 - 100 = 400 tokens
    // check fee receiver balance
    const feeReceiverBalanceAfter = await coatl.balanceOf(feeReceiver.address);
    const expectedFeeReceiverBalance = feeReceiverBalance.add(fee); // Fee receiver receives the fee
    expect(feeReceiverBalanceAfter.toString()).to.equal(expectedFeeReceiverBalance.toString());
  });

  it("Should allow transfers only if the sender and recipient are not blacklisted", async function () {
    // MultiSig wallet adds addr1 to the blacklist
    await coatl.connect(multiSigWallet).addBlacklist(addr1.address);
    expect(await coatl.isBlacklisted(addr1.address)).to.equal(true);

    // Attempt to transfer tokens to a blacklisted address
    try {
      await coatl.connect(owner).transfer(addr1.address, ethers.utils.parseEther("100"));
    } catch (err) {
      expect(err.message).to.contains("VM Exception while processing transaction: reverted with custom error 'RecipientBlacklisted");
    }

    // Remove addr1 from the blacklist
    await coatl.connect(multiSigWallet).removeBlacklist(addr1.address);
    expect(await coatl.isBlacklisted(addr1.address)).to.equal(false);

    // Transfer tokens successfully
    const feePercentage = await coatl.transferFee();
    const transferAmount = ethers.utils.parseEther("100");
    const fee = transferAmount.mul(feePercentage).div(100);
    const netTransferAmount = transferAmount.sub(fee);
    const addr1BalanceBefore = await coatl.balanceOf(addr1.address);

    await coatl.connect(owner).transfer(addr1.address, transferAmount);
    const addr1Balance = await coatl.balanceOf(addr1.address);
    expect(addr1Balance.toString()).to.equal(addr1BalanceBefore.add(netTransferAmount).toString()); // addr1 now has 200 + netTransferAmount
  });

  it("Should allow the multi-signature wallet to update the multi-signature wallet address", async function () {
    // Update the multi-signature wallet address using the current multi-signature wallet
    await coatl.connect(multiSigWallet).updateMultiSigWallet(addr1.address);
    expect(await coatl.multiSigWallet()).to.equal(addr1.address);

    // Ensure the new multi-signature wallet can manage the blacklist
    await coatl.connect(addr1).addBlacklist(addr2.address);
    expect(await coatl.isBlacklisted(addr2.address)).to.equal(true);
  });

  it("Should not allow non-owners to update the multi-signature wallet address", async function () {
    try {
      await coatl.connect(addr1).updateMultiSigWallet(addr2.address);
    } catch (err) {
      expect(err.message).to.contains("VM Exception while processing transaction: reverted with custom error 'UnauthorizedCaller()'");
    }
    expect(await coatl.multiSigWallet()).to.equal(multiSigWallet.address);
  });

  it("Should not allow non-multi-signature wallet addresses to update the multi-signature wallet address", async function () {
    // Attempt to update the multi-signature wallet address using the owner
    try {
        await coatl.connect(owner).updateMultiSigWallet(addr1.address);
    } catch (err) {
        expect(err.message).to.contains("VM Exception while processing transaction: reverted with custom error 'UnauthorizedCaller()'");
    }

    // Ensure the multi-signature wallet address remains unchanged
    expect(await coatl.multiSigWallet()).to.equal(multiSigWallet.address);

    // Attempt to update the multi-signature wallet address using another non-multi-signature wallet address
    try {
        await coatl.connect(addr2).updateMultiSigWallet(addr1.address);
    } catch (err) {
        expect(err.message).to.contains("VM Exception while processing transaction: reverted with custom error 'UnauthorizedCaller()'");
    }

    // Ensure the multi-signature wallet address remains unchanged
    expect(await coatl.multiSigWallet()).to.equal(multiSigWallet.address);
  });

  it("Should apply transfer fees correctly", async function () {
    // Set transfer fee to 2%
    await coatl.connect(owner).updateFee(2);

    // Define the transfer amount
    const transferAmount = ethers.utils.parseEther("100");
    const fee = transferAmount.mul(2).div(100); // 2% fee
    const netTransferAmount = transferAmount.sub(fee); // Amount received by addr1 after deducting the fee

    // Check the multi-signature wallet's balance before the transfer
    const feeReceiverBalanceABefore = await coatl.balanceOf(feeReceiver.address);
    const addr1BalanceBefore = await coatl.balanceOf(addr1.address);

    // Perform the transfer
    await coatl.connect(owner).transfer(addr1.address, transferAmount);

    // Check the recipient's balance
    const addr1Balance = await coatl.balanceOf(addr1.address);
    expect(addr1Balance.toString()).to.equal(addr1BalanceBefore.add(netTransferAmount).toString()); // addr1 now has 200 + netTransferAmount

    // Check the fee receiver's balance after the transfer
    const feeReceiverBalanceAfter = await coatl.balanceOf(feeReceiver.address);
    const expectedFeeReceiverBalance = feeReceiverBalanceABefore.add(fee); // Fee receiver receives the fee
    expect(feeReceiverBalanceAfter.toString()).to.equal(expectedFeeReceiverBalance.toString());
  });

  it("Should emit events for blacklist and whitelist updates", async function () {
    // Add addr1 to the blacklist
    await expect(coatl.connect(multiSigWallet).addBlacklist(addr1.address))
        .to.emit(coatl, "ListStatusUpdated")
        .withArgs(addr1.address, false, true); // addr1 is blacklisted

    // Remove addr1 from the blacklist
    await expect(coatl.connect(multiSigWallet).removeBlacklist(addr1.address))
        .to.emit(coatl, "ListStatusUpdated")
        .withArgs(addr1.address, false, false); // addr1 is no longer blacklisted

    // Add addr1 to the whitelist
    await expect(coatl.connect(multiSigWallet).addWhitelist(addr1.address))
        .to.emit(coatl, "ListStatusUpdated")
        .withArgs(addr1.address, true, false); // addr1 is whitelisted

    // Remove addr1 from the whitelist
    await expect(coatl.connect(multiSigWallet).removeWhitelist(addr1.address))
        .to.emit(coatl, "ListStatusUpdated")
        .withArgs(addr1.address, false, false); // addr1 is no longer whitelisted
  });
});
