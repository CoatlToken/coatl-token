import pkg from "hardhat";
const { ethers } = pkg;
import { expect } from "chai";

describe("CoatlVesting", function () {
  let Token, Vesting, token, vesting;
  let owner, founder, contributor, other;
  const initialSupply = ethers.utils.parseEther("1000000");

  beforeEach(async function () {
    [owner, founder, contributor, other] = await ethers.getSigners();

    Token = await ethers.getContractFactory("Coatl");
    token = await Token.deploy(
      initialSupply,
      owner.address,
      owner.address,
      []
    );
    await token.deployed();

    Vesting = await ethers.getContractFactory("CoatlVesting");
    vesting = await Vesting.deploy(token.address);
    await vesting.deployed();

    await token.transfer(vesting.address, ethers.utils.parseEther("100000"));
  });

  describe("Deployment", function () {
    it("should deploy with correct token address", async function () {
      expect(await vesting.token()).to.equal(token.address);
    });

    it("should revert if token address is zero", async function () {
      const VestingBad = await ethers.getContractFactory("CoatlVesting");
      await expect(
        VestingBad.deploy(ethers.constants.AddressZero)
      ).to.be.revertedWith("ZeroAddressNotAllowed");
    });
  });

  describe("Adding Vesting Schedules", function () {
    it("should allow owner to add founder vesting", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const start = now + 60;
      const cliff = start + 30 * 24 * 60 * 60;
      await expect(
        vesting.addFounder(founder.address, ethers.utils.parseEther("1200"), start, cliff)
      ).to.emit(vesting, "VestingAdded");
    });

    it("should allow owner to add contributor vesting", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const start = now + 60;
      const cliff = start + 30 * 24 * 60 * 60;
      const end = start + 365 * 24 * 60 * 60;
      await expect(
        vesting.addContributor(contributor.address, ethers.utils.parseEther("1000"), start, cliff, end)
      ).to.emit(vesting, "VestingAdded");
    });

    it("should revert if beneficiary is zero address", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const start = now + 60;
      const cliff = start + 30 * 24 * 60 * 60;
      await expect(
        vesting.addFounder(ethers.constants.AddressZero, ethers.utils.parseEther("1200"), start, cliff)
      ).to.be.revertedWith("ZeroAddressNotAllowed");
    });

    it("should revert if total amount is zero", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const start = now + 60;
      const cliff = start + 30 * 24 * 60 * 60;
      await expect(
        vesting.addFounder(founder.address, 0, start, cliff)
      ).to.be.revertedWith("AmountZero");
    });

    it("should revert if start date is in the past", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const start = now - 100;
      const cliff = start + 30 * 24 * 60 * 60;
      await expect(
        vesting.addFounder(founder.address, ethers.utils.parseEther("1200"), start, cliff)
      ).to.be.revertedWith("StartDateInPast");
    });

    it("should revert if end date is before or equal to start date (contributor)", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const start = now + 60;
      const cliff = start + 30 * 24 * 60 * 60;
      const end = start;
      await expect(
        vesting.addContributor(contributor.address, ethers.utils.parseEther("1000"), start, cliff, end)
      ).to.be.revertedWith("EndBeforeStart");
    });

    it("should revert if beneficiary already has a vesting schedule", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const start = now + 60;
      const cliff = start + 30 * 24 * 60 * 60;
      await vesting.addFounder(founder.address, ethers.utils.parseEther("1200"), start, cliff);
      await expect(
        vesting.addFounder(founder.address, ethers.utils.parseEther("1200"), start, cliff)
      ).to.be.revertedWith("AlreadyVested");
    });

    it("should revert if contract does not have enough tokens", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const start = now + 60;
      const cliff = start + 30 * 24 * 60 * 60;
      await expect(
        vesting.addFounder(other.address, ethers.utils.parseEther("1000000"), start, cliff)
      ).to.be.revertedWith("InsufficientTokensForVesting");
    });
  });

  describe("Releasing Tokens", function () {
    beforeEach(async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const start = now + 60;
      const cliff = now + 90 * 24 * 60 * 60;
      const end = now + 120;
      await vesting.addFounder(founder.address, ethers.utils.parseEther("1200"), start, cliff);
    });

    it("should not allow release before vesting starts", async function () {
      await expect(
        vesting.connect(founder).release()
      ).to.be.revertedWith("NothingToRelease");
    });

    it("should allow release after vesting starts", async function () {
      await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      const releasable = await vesting.releasableAmount(founder.address);
      expect(releasable).to.be.gt(0);
      await expect(
        vesting.connect(founder).release()
      ).to.emit(vesting, "TokensReleased");
    });

    it("should not allow release if nothing is releasable", async function () {
      await expect(
        vesting.connect(contributor).release()
      ).to.be.revertedWith("NothingToRelease");
    });

    it("should allow full release after vesting ends", async function () {
      await ethers.provider.send("evm_increaseTime", [366 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      const releasable = await vesting.releasableAmount(founder.address);
      expect(releasable).to.equal(ethers.utils.parseEther("1200"));
      await expect(
        vesting.connect(founder).release()
      ).to.emit(vesting, "TokensReleased");
      await expect(
        vesting.connect(founder).release()
      ).to.be.revertedWith("NothingToRelease");
    });
  });

  describe("Revoking Vesting", function () {
    beforeEach(async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      await vesting.addFounder(founder.address, ethers.utils.parseEther("1200"), now + 60, now + 120);
    });

    it("should allow owner to revoke vesting", async function () {
      await expect(
        vesting.revokeVesting(founder.address)
      ).to.emit(vesting, "VestingRevoked");
    });

    it("should prevent further releases after revocation", async function () {
      await vesting.revokeVesting(founder.address);
      await ethers.provider.send("evm_increaseTime", [366 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      await expect(
        vesting.connect(founder).release()
      ).to.be.revertedWith("NothingToRelease");
    });
  });

  describe("Recovering Unused Tokens", function () {
    it("should allow owner to recover only unused tokens", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      await vesting.addFounder(founder.address, ethers.utils.parseEther("1200"), now + 60, now + 120);
      const before = await token.balanceOf(owner.address);
      await vesting.recoverUnusedTokens(owner.address, ethers.utils.parseEther("100000").sub(ethers.utils.parseEther("1200")));
      const afterBal = await token.balanceOf(owner.address);
      expect(afterBal.sub(before)).to.equal(ethers.utils.parseEther("100000").sub(ethers.utils.parseEther("1200")));
    });

    it("should revert if trying to recover more than available", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      await vesting.addFounder(founder.address, ethers.utils.parseEther("1200"), now + 60, now + 120);
      await expect(
        vesting.recoverUnusedTokens(owner.address, ethers.utils.parseEther("100000"))
      ).to.be.revertedWith("CannotWithdrawVestedTokens");
    });
  });

  describe("View Functions", function () {
    it("should return correct contract token balance", async function () {
      expect(await vesting.contractTokenBalance()).to.equal(ethers.utils.parseEther("100000"));
    });

    it("should return correct total unclaimed obligation", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const start = now + 60;
      const cliff = now + 90 * 24 * 60 * 60;
      const end = now + 120;
      await vesting.addFounder(founder.address, ethers.utils.parseEther("1200"), start, cliff);
      expect(await vesting.totalUnclaimedObligation()).to.equal(ethers.utils.parseEther("1200"));
    });

    it("should return correct vested accounts", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const start = now + 60;
      const cliff = now + 90 * 24 * 60 * 60;
      const end = now + 120;
      await vesting.addFounder(founder.address, ethers.utils.parseEther("1200"), start, cliff);
      const cStart = now + 60;
      const cCliff = now + 60 + 30 * 24 * 60 * 60;
      const cEnd = now + 60 + 180 * 24 * 60 * 60;
      await vesting.addContributor(contributor.address, ethers.utils.parseEther("600"), cStart, cCliff, cEnd);
      const accounts = await vesting.getVestedAccounts();
      expect(accounts).to.include.members([founder.address, contributor.address]);
    });
  });
});

describe("CoatlVesting - Time Manipulation Pattern", function () {
  let Token, Vesting, token, vesting, owner, founder;
  const initialSupply = ethers.utils.parseEther("1000000");

  beforeEach(async function () {
    [owner, founder] = await ethers.getSigners();

    Token = await ethers.getContractFactory("Coatl");
    token = await Token.deploy(initialSupply, owner.address, owner.address, []);
    await token.deployed();

    Vesting = await ethers.getContractFactory("CoatlVesting");
    vesting = await Vesting.deploy(token.address);
    await vesting.deployed();

    await token.transfer(vesting.address, ethers.utils.parseEther("100000"));

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const start = now + 60;
    const cliff = now + 60 + 30 * 24 * 60 * 60;
    await vesting.addFounder(founder.address, ethers.utils.parseEther("1200"), start, cliff);
  });

  it("should allow release after 1 month", async function () {
    await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    const releasable = await vesting.releasableAmount(founder.address);
    expect(releasable).to.be.gt(0);

    await expect(
      vesting.connect(founder).release()
    ).to.emit(vesting, "TokensReleased");
  });

  it("should allow full release after vesting ends", async function () {
    await ethers.provider.send("evm_increaseTime", [366 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    const releasable = await vesting.releasableAmount(founder.address);
    expect(releasable).to.be.gt(0);
    await expect(
      vesting.connect(founder).release()
    ).to.emit(vesting, "TokensReleased");
  });

  it("should not allow release before the cliff", async function () {
    await ethers.provider.send("evm_increaseTime", [10 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    await expect(
      vesting.connect(founder).release()
    ).to.be.revertedWith("NothingToRelease");
  });

  it("should allow release after the cliff for all vested tokens since start", async function () {
    await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    const releasable = await vesting.releasableAmount(founder.address);
    expect(releasable).to.be.gt(0);
    await expect(
      vesting.connect(founder).release()
    ).to.emit(vesting, "TokensReleased");
  });
});

describe("CoatlVesting with Cliff", function () {
  let Token, Vesting, token, vesting;
  let owner, founder, contributor, other;
  const initialSupply = ethers.utils.parseEther("1000000");

  beforeEach(async function () {
    [owner, founder, contributor, other] = await ethers.getSigners();

    Token = await ethers.getContractFactory("Coatl");
    token = await Token.deploy(
      initialSupply,
      owner.address,
      owner.address,
      []
    );
    await token.deployed();

    Vesting = await ethers.getContractFactory("CoatlVesting");
    vesting = await Vesting.deploy(token.address);
    await vesting.deployed();

    await token.transfer(vesting.address, ethers.utils.parseEther("100000"));
  });

  describe("Adding Vesting Schedules with Cliff", function () {
    it("should allow owner to add founder vesting with cliff", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const start = now + 60;
      const cliff = start + 90 * 24 * 60 * 60;
      const end = start + 365 * 24 * 60 * 60;
      await expect(
        vesting.addFounder(founder.address, ethers.utils.parseEther("1200"), start, cliff)
      ).to.emit(vesting, "VestingAdded");
    });

    it("should revert if cliff is before start", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const start = now + 100;
      const cliff = start - 10;
      const end = start + 365 * 24 * 60 * 60;
      await expect(
        vesting.addFounder(founder.address, ethers.utils.parseEther("1200"), start, cliff)
      ).to.be.revertedWith("EndBeforeStart");
    });

    it("should allow owner to add contributor vesting with cliff", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const start = now + 60;
      const cliff = start + 60 * 24 * 60 * 60;
      const end = start + 180 * 24 * 60 * 60;
      await expect(
        vesting.addContributor(contributor.address, ethers.utils.parseEther("600"), start, cliff, end)
      ).to.emit(vesting, "VestingAdded");
    });
  });

  describe("Cliff Logic", function () {
    beforeEach(async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      this.start = now + 60;
      this.cliff = this.start + 90 * 24 * 60 * 60;
      this.end = this.start + 365 * 24 * 60 * 60;
      await vesting.addFounder(founder.address, ethers.utils.parseEther("1200"), this.start, this.cliff);
    });

    it("should not allow release before the cliff", async function () {
      await ethers.provider.send("evm_increaseTime", [89 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      await expect(
        vesting.connect(founder).release()
      ).to.be.revertedWith("NothingToRelease");
    });

    it("should allow release after the cliff for all vested tokens since start", async function () {
      await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      const releasable = await vesting.releasableAmount(founder.address);
      expect(releasable).to.be.gt(0);
      await expect(
        vesting.connect(founder).release()
      ).to.emit(vesting, "TokensReleased");
    });

    it("should allow full release after vesting ends", async function () {
      await ethers.provider.send("evm_increaseTime", [366 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      const releasable = await vesting.releasableAmount(founder.address);
      expect(releasable).to.equal(ethers.utils.parseEther("1200"));
      await expect(
        vesting.connect(founder).release()
      ).to.emit(vesting, "TokensReleased");
    });
  });
});