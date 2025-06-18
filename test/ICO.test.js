import pkg from "hardhat";
const { ethers } = pkg;
import { expect } from "chai";

describe("ICO", function () {
    let Token, token, ICO, ico, owner, user1, projectWallet, priceFeed;
    // Lowered caps for testing with 20 signers
    const initialSupply = ethers.utils.parseEther("50000000"); // 50 million tokens
    const softCap = ethers.utils.parseEther("5000000");        // 5 million tokens
    const hardCap = ethers.utils.parseEther("20000000");       // 20 million tokens
    const ETH_USD_PRICE = 2000 * 1e8;

    beforeEach(async function () {
        [owner, user1, projectWallet] = await ethers.getSigners();

        Token = await ethers.getContractFactory("Coatl");
        token = await Token.deploy(initialSupply, owner.address, owner.address, []);
        await token.deployed();

        const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
        priceFeed = await MockPriceFeed.deploy(ETH_USD_PRICE);
        await priceFeed.deployed();

        const now = (await ethers.provider.getBlock("latest")).timestamp;
        const start = now + 10;
        const end = start + 90 * 24 * 60 * 60; // 90 days in seconds
        ICO = await ethers.getContractFactory("ICO");
        ico = await ICO.deploy(
            token.address,
            priceFeed.address,
            softCap,
            hardCap,
            start,
            end,
            projectWallet.address
        );
        await ico.deployed();

        await token.transfer(ico.address, hardCap);
    });

    it("should deploy with correct parameters", async function () {
        expect(await ico.token()).to.equal(token.address);
        expect(await ico.priceFeed()).to.equal(priceFeed.address);
        expect(await ico.softCap()).to.equal(softCap);
        expect(await ico.hardCap()).to.equal(hardCap);
        expect(await ico.projectWallet()).to.equal(projectWallet.address);
    });

    it("should not allow buying tokens before start", async function () {
        await expect(
            ico.connect(user1).buyTokens({ value: ethers.utils.parseEther("1") })
        ).to.be.revertedWith("ICONotActive");
    });

    it("should allow buying tokens after start and calculate tokens correctly", async function () {
        await ethers.provider.send("evm_increaseTime", [15]);
        await ethers.provider.send("evm_mine");

        await expect(
            ico.connect(user1).buyTokens({ value: ethers.utils.parseEther("1") })
        )
            .to.emit(ico, "TokensPurchased")
            .withArgs(user1.address, ethers.utils.parseEther("1"), ethers.utils.parseEther("20000"));

        expect(await token.balanceOf(user1.address)).to.equal(ethers.utils.parseEther("20000"));
        expect(await ico.contributions(user1.address)).to.equal(ethers.utils.parseEther("1"));
        expect(await ico.tokensPurchased(user1.address)).to.equal(ethers.utils.parseEther("20000"));
    });

    it("should enforce min and max contribution in USD", async function () {
        await ethers.provider.send("evm_increaseTime", [15]);
        await ethers.provider.send("evm_mine");

        const minWei = await ico.getMinWeiAllowed();
        const maxWei = await ico.getMaxWeiAllowed();

        // Test below minimum
        await expect(
            ico.connect(user1).buyTokens({ value: minWei.sub(1) })
        ).to.be.revertedWith("ContributionTooLow");

        // Test above maximum
        await expect(
            ico.connect(user1).buyTokens({ value: maxWei.add(1) })
        ).to.be.revertedWith("ContributionTooHigh");
    });

    it("should not allow buying tokens after end", async function () {
        await ethers.provider.send("evm_increaseTime", [10 + 90 * 24 * 60 * 60]);
        await ethers.provider.send("evm_mine");

        await expect(
            ico.connect(user1).buyTokens({ value: ethers.utils.parseEther("1") })
        ).to.be.revertedWith("ICONotActive");
    });

    it("should allow buying up to soft cap", async function () {
        await ethers.provider.send("evm_increaseTime", [15]);
        await ethers.provider.send("evm_mine");

        const signers = await ethers.getSigners();
        await buyUpToCap(ico, softCap, priceFeed, signers);
        // Optionally, check that softCapReached is true
        expect(await ico.softCapReached()).to.be.true;
    });

    it("should not allow buying after hard cap", async function () {
        await ethers.provider.send("evm_increaseTime", [15]);
        await ethers.provider.send("evm_mine");

        const signers = await ethers.getSigners();
        await buyUpToCap(ico, hardCap, priceFeed, signers);
        expect(await ico.totalTokensSold()).to.equal(hardCap);

        // try to do more buying. expect HardcapReached
        await expect(
            ico.connect(user1).buyTokens({ value: ethers.utils.parseEther("1") })
        ).to.be.revertedWith("HardcapReached");
    });

    it("should allow onwer to withdraw funds after softcap reached", async function () {
        await ethers.provider.send("evm_increaseTime", [15]);
        await ethers.provider.send("evm_mine");

        // should not allow owner to withdraw before soft cap
        await expect(ico.connect(owner).releaseFunds()).to.be.revertedWith("SoftcapNotReached");

        const signers = await ethers.getSigners();
        await buyUpToCap(ico, softCap, priceFeed, signers);

        const initialBalance = await ethers.provider.getBalance(projectWallet.address);
        // get current funds on ICO contract
        const icoBalance = await ethers.provider.getBalance(ico.address);
        await ico.connect(owner).releaseFunds();
        const finalBalance = await ethers.provider.getBalance(projectWallet.address);
        expect(finalBalance.sub(initialBalance)).to.equal(icoBalance);
    });

    it("should allow to claim a refund if soft cap not reached", async function () {
        await ethers.provider.send("evm_increaseTime", [15]);
        await ethers.provider.send("evm_mine");

        // buy some tokens
        await ico.connect(user1).buyTokens({ value: ethers.utils.parseEther("1") });

        // check amount contributed
        expect(await ico.contributions(user1.address)).to.equal(ethers.utils.parseEther("1"));

        // should not allow to claim refund before end
        await expect(ico.connect(user1).claimRefund()).to.be.revertedWith("ICOnotEnded");

        // fast forward to end
        await ethers.provider.send("evm_increaseTime", [10 + 90 * 24 * 60 * 60]);
        await ethers.provider.send("evm_mine");

        // now should be able to claim refund
        const initialBalance = await ethers.provider.getBalance(user1.address);
        // get current contribution
        const contribution = await ico.contributions(user1.address);

        // claim refund and get gas used
        const tx = await ico.connect(user1).claimRefund();
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);

        const finalBalance = await ethers.provider.getBalance(user1.address);

        // The final balance should be initial + refund - gas
        expect(finalBalance).to.be.closeTo(
            initialBalance.add(contribution).sub(gasUsed),
            ethers.utils.parseEther("0.0001") // small tolerance for rounding
        );

        // try to claium refund again, should fail because contribution is 0
        await expect(ico.connect(user1).claimRefund()).to.be.revertedWith("NoContribution");
    });

    it("only the owner can release funds", async function () {
        await ethers.provider.send("evm_increaseTime", [15]);
        await ethers.provider.send("evm_mine");

        const signers = await ethers.getSigners();
        await buyUpToCap(ico, softCap, priceFeed, signers);

        // try to release funds as a user
        await expect(ico.connect(user1).releaseFunds()).to.be.revertedWith("OwnableUnauthorizedAccount");

        // owner should be able to release funds
        await ico.connect(owner).releaseFunds();
    });

    it("should allow owner to withdraw unsold tokens", async function () {
        await ethers.provider.send("evm_increaseTime", [15]);
        await ethers.provider.send("evm_mine");

        // get the tokens on the ico contract
        const icoBalance = await token.balanceOf(ico.address);

        const signers = await ethers.getSigners();
        await buyUpToCap(ico, softCap, priceFeed, signers);
        expect(await ico.totalTokensSold()).to.equal(softCap);

        // not sold tokens balance should be initialSupply - softCap
        const unsoldTokens = icoBalance.sub(softCap);

        // owner should be able to withdraw tokens
        const initialBalance = await token.balanceOf(owner.address);
        // expect ico not ended when recovering unsold tokens
        await expect(ico.connect(owner).recoverUnsoldTokens(owner.address)).to.be.revertedWith("ICOnotEnded");
        await ethers.provider.send("evm_increaseTime", [10 + 90 * 24 * 60 * 60]);
        await ethers.provider.send("evm_mine");
        // try to recover unsold tokens from a not owner account
        await expect(ico.connect(user1).recoverUnsoldTokens(owner.address)).to.be.revertedWith("OwnableUnauthorizedAccount");
        await ico.connect(owner).recoverUnsoldTokens(owner.address);
     
        const finalBalance = await token.balanceOf(owner.address);
        expect(finalBalance.sub(initialBalance)).to.equal(unsoldTokens);
    });

    it("ICOStarted event should be emitted on the first buy", async function () {
        await ethers.provider.send("evm_increaseTime", [15]);
        await ethers.provider.send("evm_mine");

        // expect ICOSTarted event to be emitted on the first buy
        await expect(
            ico.connect(user1).buyTokens({ value: ethers.utils.parseEther("1") })
        ).to.emit(ico, "ICOStarted");
    });

    it("ICOStarted event should be emitted on the first buy with correct parameters", async function () {
        await ethers.provider.send("evm_increaseTime", [15]);
        await ethers.provider.send("evm_mine");

        const start = await ico.start();
        const end = await ico.end();
        const softCap = await ico.softCap();
        const hardCap = await ico.hardCap();

        await expect(
            ico.connect(user1).buyTokens({ value: ethers.utils.parseEther("1") })
        ).to.emit(ico, "ICOStarted")
         .withArgs(start, end, softCap, hardCap);
    });

    it("should only allow the owner to finalize", async function () {
        await ethers.provider.send("evm_increaseTime", [15]);
        await ethers.provider.send("evm_mine");
        await ico.connect(user1).buyTokens({ value: ethers.utils.parseEther("1") });
        await ethers.provider.send("evm_increaseTime", [10 + 90 * 24 * 60 * 60]);
        await ethers.provider.send("evm_mine");

        // Non-owner should be reverted
        await expect(
            ico.connect(user1).finalize()
        ).to.be.revertedWith("OwnableUnauthorizedAccount");

        // If unsodltokens havent been recovered, finalize is not allowed
        await expect(
            ico.connect(owner).finalize()
        ).to.be.revertedWith("UnsoldTokensNotRecovered");

        // Recover unsold tokens by other tham the onwer
        await expect(
            ico.connect(user1).recoverUnsoldTokens(owner.address)
        ).to.be.revertedWith("OwnableUnauthorizedAccount");

        // Owner should be able to recover unsold tokens
        await ico.connect(owner).recoverUnsoldTokens(owner.address);

        // Now owner can finalize
        await expect(
            ico.connect(owner).finalize()
        ).to.emit(ico, "Finalized");
    });

    it("Should only allow owenr to do an emergency withrdraw", async function () {
        await ethers.provider.send("evm_increaseTime", [15]);
        await ethers.provider.send("evm_mine");

        // Buy some tokens
        await ico.connect(user1).buyTokens({ value: ethers.utils.parseEther("1") });

        // Non-owner should be reverted
        await expect(
            ico.connect(user1).emergencyWithdraw(projectWallet.address)
        ).to.be.revertedWith("OwnableUnauthorizedAccount");

        // Owner should be able to do an emergency withdraw
        const initialBalance = await ethers.provider.getBalance(projectWallet.address);
        const icoBalance = await ethers.provider.getBalance(ico.address);

        // Expect revert when ICO has not been finalized
        await expect(
            ico.connect(owner).emergencyWithdraw(projectWallet.address)
        ).to.be.revertedWith("NotFinalized");

        // Fast forward to end
        await ethers.provider.send("evm_increaseTime", [10 + 90 * 24 * 60 * 60]);
        await ethers.provider.send("evm_mine");

        // recover unsold tokens
        await ico.connect(owner).recoverUnsoldTokens(owner.address);

        // finalize the ICO
        await ico.connect(owner).finalize();

        // Now emergency withdraw should work
        await ico.connect(owner).emergencyWithdraw(projectWallet.address);

        const finalBalance = await ethers.provider.getBalance(projectWallet.address);
        expect(finalBalance.sub(initialBalance)).to.equal(icoBalance);
    });
});

async function buyUpToCap(ico, capTokens, priceFeed, signers) {
    const TOKEN_USD_PRICE = 10;
    const ethUsd = await priceFeed.latestAnswer();
    const ethUsd18 = ethers.BigNumber.from(ethUsd).mul("10000000000");
    const maxWei = await ico.getMaxWeiAllowed();

    let tokensBought = ethers.BigNumber.from(0);
    let i = 0;

    while (tokensBought.lt(capTokens)) {
        // Calculate how many tokens remain to reach the cap
        const tokensLeft = capTokens.sub(tokensBought);
        // Calculate ETH needed for the remaining tokens (or as much as this signer can buy)
        let tokensToBuy = tokensLeft;
        // Calculate ETH needed for tokensToBuy
        let ethNeeded = tokensToBuy
            .mul(TOKEN_USD_PRICE)
            .mul(ethers.constants.WeiPerEther)
            .div(ethUsd18.mul(100));
        // Limit to maxWei per address
        if (ethNeeded.gt(maxWei)) {
            ethNeeded = maxWei;
            // Calculate how many tokens this amount of ETH will buy
            tokensToBuy = ethNeeded
                .mul(ethUsd18)
                .mul(100)
                .div(TOKEN_USD_PRICE)
                .div(ethers.constants.WeiPerEther);
        }
        await ico.connect(signers[i]).buyTokens({ value: ethNeeded });
        tokensBought = tokensBought.add(tokensToBuy);
        i++;
        if (i >= signers.length) throw new Error("Not enough signers to reach cap");
    }
}