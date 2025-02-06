const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("Coatl", function () {
  let Coatl, coatl, owner, addr1, addr2;

  beforeEach(async function () {
    // Reset contract state
    await ethers.provider.send("hardhat_reset", []);

    // Get signers
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy the contract
    Coatl = await ethers.getContractFactory("Coatl");
    coatl = await Coatl.deploy(ethers.utils.parseEther("1000")); // Initial supply of 1000 tokens
    await coatl.deployed();
  });

  it("Should assign the total supply of tokens to the owner", async function () {
    const ownerBalance = await coatl.balanceOf(owner.address);
    expect(ownerBalance.toString()).to.equal(ethers.utils.parseEther("1000").toString());
  });

  it("Should transfer tokens between accounts", async function () {
    await coatl.transfer(addr1.address, ethers.utils.parseEther("100"));
    const addr1Balance = await coatl.balanceOf(addr1.address);
    expect(addr1Balance.toString()).to.equal(ethers.utils.parseEther("100").toString());
  });

  it("should allow the owner to pause and unpause the contract", async function () {
    await coatl.pause();
    expect(await coatl.paused()).to.equal(true);

    try {
        await coatl.transfer(addr1.address, ethers.utils.parseEther("100"));
        const addr1Balance = await coatl.balanceOf(addr1.address);
        expect(addr1Balance.toString()).to.equal(ethers.utils.parseEther("100").toString());
    }
    catch (err) {
        expect(err.message).to.equal("VM Exception while processing transaction: reverted with custom error 'EnforcedPause()'");
    }

    await coatl.unpause();
    expect(await coatl.paused()).to.equal(false);

    await coatl.transfer(addr1.address, ethers.utils.parseEther("100"));
    addr1Balance = await coatl.balanceOf(addr1.address);
    expect(addr1Balance.toString()).to.equal(ethers.utils.parseEther("100").toString());
  });

  it("Should allow to burn tokens", async function () {
    await coatl.burn(ethers.utils.parseEther("100"));
    const ownerBalance = await coatl.balanceOf(owner.address);
    expect(ownerBalance.toString()).to.equal(ethers.utils.parseEther("900").toString());
  });

  it("SHould allow to pause the contract only by the owner", async function () {
    try {
        await coatl.connect(addr1).pause();
        expect(await coatl.paused()).to.equal(false);
    }
    catch (err) {
        expect(err.message).to.contains("VM Exception while processing transaction: reverted with custom error 'OwnableUnauthorizedAccount");
    }
  });

  it("Should allow to unpause the contract only by the owner", async function () {
    await coatl.pause();
    expect(await coatl.paused()).to.equal(true);
    try {
        await coatl.connect(addr1).unpause();
        expect(await coatl.paused()).to.equal(true);
    }
    catch (err) {
        expect(err.message).to.contains("VM Exception while processing transaction: reverted with custom error 'OwnableUnauthorizedAccount");
    }
    await coatl.unpause();
  });

  it("Should allow to add or remove addresses to the blacklist only by the owner", async function () {
    try {
        await coatl.connect(addr1).addBlacklist(addr2.address);
        expect(await coatl.isBlacklisted(addr2.address)).to.equal(false);
    }
    catch (err) {
        expect(err.message).to.contains("VM Exception while processing transaction: reverted with custom error 'OwnableUnauthorizedAccount");
    }

    await coatl.addBlacklist(addr2.address);
    expect(await coatl.isBlacklisted(addr2.address)).to.equal(true);

    try {
        await coatl.connect(addr1).removeBlacklist(addr2.address);
        expect(await coatl.isBlacklisted(addr2.address)).to.equal(true);
    }
    catch (err) {
        expect(err.message).to.contains("VM Exception while processing transaction: reverted with custom error 'OwnableUnauthorizedAccount");
    }

    await coatl.removeBlacklist(addr2.address);
    expect(await coatl.isBlacklisted(addr2.address)).to.equal(false);
  });

  it("SHould allow to add or remove addresses to the whitelist only by the owner", async function () {
    try {
        await coatl.connect(addr1).addWhitelist(addr2.address);
        expect(await coatl.isWhitelisted(addr2.address)).to.equal(false);
    }
    catch (err) {
        expect(err.message).to.contains("VM Exception while processing transaction: reverted with custom error 'OwnableUnauthorizedAccount");
    }

    await coatl.addWhitelist(addr2.address);
    expect(await coatl.isWhitelisted(addr2.address)).to.equal(true);

    try {
        await coatl.connect(addr1).removeWhitelist(addr2.address);
        expect(await coatl.isWhitelisted(addr2.address)).to.equal(true);
    }
    catch (err) {
        expect(err.message).to.contains("VM Exception while processing transaction: reverted with custom error 'OwnableUnauthorizedAccount");
    }

    await coatl.removeWhitelist(addr2.address);
    expect(await coatl.isWhitelisted(addr2.address)).to.equal(false);
  });

  it("Should allow to transfer tokens only if the contract is not paused", async function () {
    await coatl.pause();
    expect(await coatl.paused()).to.equal(true);

    try {
        await coatl.transfer(addr1.address, ethers.utils.parseEther("100"));
        const addr1Balance = await coatl.balanceOf(addr1.address);
        expect(addr1Balance.toString()).to.equal(ethers.utils.parseEther("100").toString());
    }
    catch (err) {
        expect(err.message).to.equal("VM Exception while processing transaction: reverted with custom error 'EnforcedPause()'");
    }
  });

  it("Should allow to transfer tokens only if the sender is not blacklisted", async function () {
    await coatl.addBlacklist(owner.address);
    expect(await coatl.isBlacklisted(owner.address)).to.equal(true);

    try {
        await coatl.transfer(addr1.address, ethers.utils.parseEther("100"));
        const addr1Balance = await coatl.balanceOf(addr1.address);
        expect(addr1Balance.toString()).to.equal(ethers.utils.parseEther("100").toString());
    }
    catch (err) {
        expect(err.message).to.equal("VM Exception while processing transaction: reverted with reason string 'Coatl: sender is blacklisted'");
    }
  });

  it("Should allow to transfer tokens only if the recipient is not blacklisted", async function () {
    await coatl.addBlacklist(addr1.address);
    expect(await coatl.isBlacklisted(addr1.address)).to.equal(true);

    try {
        await coatl.transfer(addr1.address, ethers.utils.parseEther("100"));
        const addr1Balance = await coatl.balanceOf(addr1.address);
        expect(addr1Balance.toString()).to.equal(ethers.utils.parseEther("100").toString());
    }
    catch (err) {
        expect(err.message).to.equal("VM Exception while processing transaction: reverted with reason string 'Coatl: recipient is blacklisted'");
    }
  });

  it("Should allow to transfer contract ownership only by the owner", async function () {
    try {
        await coatl.connect(addr1).transferOwnership(addr2.address);
        expect(await coatl.owner()).to.equal(owner.address);
    }
    catch (err) {
        expect(err.message).to.contains("VM Exception while processing transaction: reverted with custom error 'OwnableUnauthorizedAccount");
    }

    await coatl.transferOwnership(addr2.address);
    expect(await coatl.owner()).to.equal(addr2.address);
  });  
});
