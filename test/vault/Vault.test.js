const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO_ADDRESS = ethers.constants.AddressZero;

describe("Vault", async () => {
    let deployer, unprivileged, owner, rich, whitehat, proposer, feeAddr1, feeAddr2;
    let vaultFactory, vault, proxy, immunefiAddr;
    let initializerData, salt, predictProxyAddr;
    let tokenA, tokenB;
    let BeaconProxyFactory;

    const FEE_PERCENT = 10;
    const GAS = 2618; // Gnosis safe eth transfer requires at least 2618 gas

    beforeEach(async () => {
        [deployer, owner, rich, unprivileged, whitehat, proposer, feeAddr1, feeAddr2] = await ethers.getSigners();

        BeaconProxyFactory = await ethers.getContractFactory("BeaconProxy");

        const Vault = await ethers.getContractFactory("Vault", deployer);
        vault = await Vault.connect(deployer).deploy();

        const VaultFactory = await ethers.getContractFactory("VaultFactory", deployer);
        vaultFactory = await VaultFactory.connect(deployer).deploy(owner.address, vault.address);

        await expect(await vaultFactory.connect(unprivileged).owner()).to.be.equal(owner.address);

        emptyBytes = ethers.constants.HashZero;
        salt = ethers.utils.zeroPad([0], 32);
        predictProxyAddr = await vaultFactory.connect(unprivileged).predict(unprivileged.address, salt);

        let tx = await vaultFactory.connect(unprivileged).deploy(owner.address, emptyBytes, salt);
        await expect(tx)
            .to.emit(vaultFactory, "Deployed")
            .withArgs(
                (_proxy = predictProxyAddr),
                (_sender = unprivileged.address),
                (_salt = ethers.constants.HashZero)
            );

        proxy = await ethers.getContractAt("Vault", predictProxyAddr);
        await expect(tx).to.emit(proxy, "OwnershipTransferred").withArgs(ZERO_ADDRESS, vaultFactory.address);
        await expect(tx).to.emit(proxy, "OwnershipTransferred").withArgs(vaultFactory.address, owner.address);
        await expect(tx).to.emit(proxy, "Initialized").withArgs(1);
        await expect(tx)
            .to.emit(proxy, "Initialized")
            .withArgs((version = 1));

        await expect(await proxy.owner()).to.be.equal(owner.address);

        const erc20Factory = await ethers.getContractFactory("MockERC20", deployer);
        let erc20MintAmount = ethers.utils.parseUnits("100000", "ether");
        tokenA = await erc20Factory.deploy(rich.address, erc20MintAmount, "tokenA", "A");
        tokenB = await erc20Factory.deploy(rich.address, erc20MintAmount, "tokenB", "B");

        await vaultFactory.connect(owner).transferFeeTo(feeAddr1.address);
        await vaultFactory.connect(feeAddr1).acceptFeeTo();
        immunefiAddr = await vaultFactory.feeTo();
    });

    it("Revert, if the contract is already initialized.", async () => {
        await expect(proxy.connect(owner).initialize(owner.address, emptyBytes)).to.be.revertedWith(
            "Initializable: contract is already initialized"
        );
    });

    describe("withdraw()", async () => {
        it("Owner should be able to withdraw", async () => {
            let numTokens = 100000;
            await tokenA.connect(rich).transfer(proxy.address, numTokens);

            await proxy.connect(owner).withdraw([[tokenA.address, numTokens]], 0);

            await expect(await tokenA.balanceOf(owner.address)).to.equal(numTokens);
        });

        it("Revert, if the vault is failed to send ether to owner.", async () => {
            let ethVal = await ethers.utils.parseEther("1.0");
            await rich.sendTransaction({
                to: proxy.address,
                value: ethVal,
            });

            await expect(await ethers.provider.getBalance(proxy.address)).to.be.equal(ethVal);
            let tx = await proxy.connect(owner).withdraw([], ethVal);
            await expect(await ethers.provider.getBalance(proxy.address)).to.be.equal(0);
        });

        it("Revert, if the vault is failed to send ether to owner.", async () => {
            await expect(await ethers.provider.getBalance(proxy.address)).to.be.equal(0);
            await expect(proxy.connect(owner).withdraw([], 100)).to.be.revertedWith(
                "Vault: Failed to send ether to owner"
            );
        });

        it("Revert, if not the owner called withdraw()", async () => {
            await expect(proxy.connect(unprivileged).withdraw([[tokenA.address, 100]], 0)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });
    });

    describe("payWhitehat()", async () => {
        let referenceId = ethers.utils.keccak256(1);

        it("should work", async () => {
            let bountyAmountA = ethers.utils.parseUnits("100", "ether");
            let feeAmountA = bountyAmountA.div(FEE_PERCENT);

            let bountyAmountB = ethers.utils.parseUnits("200", "ether");
            let feeAmountB = bountyAmountB.div(FEE_PERCENT);

            let bountyAmountC = ethers.utils.parseUnits("1", "ether");
            let feeAmountC = bountyAmountC.div(FEE_PERCENT);

            let tokenAEvent = [tokenA.address, bountyAmountA];
            tokenAEvent.token = tokenA.address;
            tokenAEvent.amount = bountyAmountA;
            let tokenBEvent = [tokenB.address, bountyAmountB];
            tokenBEvent.token = tokenB.address;
            tokenBEvent.amount = bountyAmountB;
            let expectedPayout = [tokenAEvent, tokenBEvent];

            let whitehatETHBalanceBefore = await whitehat.getBalance();
            let immunefiETHBalanceBefore = await ethers.provider.getBalance(immunefiAddr);

            await tokenA.connect(rich).transfer(proxy.address, bountyAmountA.add(feeAmountA));
            await tokenA.connect(rich).approve(proxy.address, bountyAmountA.add(feeAmountA));

            await tokenB.connect(rich).transfer(proxy.address, bountyAmountB.add(feeAmountB));
            await tokenB.connect(rich).approve(proxy.address, bountyAmountB.add(feeAmountB));

            await rich.sendTransaction({ to: proxy.address, value: bountyAmountC.add(feeAmountC) });

            await expect(await tokenA.connect(unprivileged).balanceOf(whitehat.address)).to.be.equal(0);
            await expect(await tokenA.connect(unprivileged).balanceOf(immunefiAddr)).to.be.equal(0);

            await expect(await tokenB.connect(unprivileged).balanceOf(whitehat.address)).to.be.equal(0);
            await expect(await tokenB.connect(unprivileged).balanceOf(immunefiAddr)).to.be.equal(0);

            let tx = await proxy.connect(owner).payWhitehat(
                referenceId,
                whitehat.address,
                [
                    { token: tokenA.address, amount: bountyAmountA },
                    { token: tokenB.address, amount: bountyAmountB },
                ],
                bountyAmountC,
                GAS
            );

            await expect(tx).to.emit(tokenA, "Transfer").withArgs(proxy.address, immunefiAddr, feeAmountA);
            await expect(tx).to.emit(tokenA, "Transfer").withArgs(proxy.address, whitehat.address, bountyAmountA);
            await expect(tx).to.emit(tokenB, "Transfer").withArgs(proxy.address, immunefiAddr, feeAmountB);
            await expect(tx).to.emit(tokenB, "Transfer").withArgs(proxy.address, whitehat.address, bountyAmountB);

            // We test each event argument individually since ethereum-waffle currently does not do a deep equivalency check on struct arrays
            //await expect(tx).to.emit(proxy, "PayWhitehat").withArgs(referenceId, whitehat.address, expectedPayout, bountyAmountC, feeTo, fee);
            let receipt = (await tx.wait()).events?.filter((x) => {
                return x.event == "PayWhitehat";
            });
            await expect(receipt[0].args[0]).to.equal(referenceId);
            await expect(receipt[0].args[1]).to.equal(whitehat.address);
            await expect(receipt[0].args[2]).to.deep.equal(expectedPayout);
            await expect(receipt[0].args[3]).to.equal(bountyAmountC);
            await expect(receipt[0].args[4]).to.equal(immunefiAddr);
            await expect(receipt[0].args[5]).to.equal(1000);

            await expect(await tokenA.connect(unprivileged).balanceOf(whitehat.address)).to.be.equal(bountyAmountA);
            await expect(await tokenA.connect(unprivileged).balanceOf(immunefiAddr)).to.be.equal(feeAmountA);
            await expect(await tokenB.connect(unprivileged).balanceOf(whitehat.address)).to.be.equal(bountyAmountB);
            await expect(await tokenB.connect(unprivileged).balanceOf(immunefiAddr)).to.be.equal(feeAmountB);
            await expect((await whitehat.getBalance()).sub(whitehatETHBalanceBefore)).to.be.equal(bountyAmountC);
            await expect((await ethers.provider.getBalance(immunefiAddr)).sub(immunefiETHBalanceBefore)).to.be.equal(
                feeAmountC
            );
        });

        it("Revert, if the vault doesn't have enough balance to pay the whitehat.", async () => {
            let setBalAmount = ethers.utils.parseUnits("10", "18");
            let balance = ethers.utils.hexStripZeros(setBalAmount);
            await ethers.provider.send("hardhat_setBalance", [proxy.address, balance]);

            await expect(await ethers.provider.getBalance(proxy.address)).to.be.equal(setBalAmount);

            let bountyAmountA = ethers.utils.parseUnits("100", "ether");

            await expect(
                proxy.connect(owner).payWhitehat(referenceId, whitehat.address, [], bountyAmountA, GAS)
            ).to.be.revertedWith("Vault: Failed to send ether to whitehat");
        });

        it("Revert, if the vault doesn't have enough balane to pay the feeReciever.", async () => {
            await ethers.provider.send("hardhat_setBalance", [proxy.address, "0x0"]);

            await expect(await ethers.provider.getBalance(proxy.address)).to.be.equal(0);

            let bountyAmountA = ethers.utils.parseUnits("1", "ether");

            await expect(
                proxy.connect(owner).payWhitehat(referenceId, whitehat.address, [], bountyAmountA, GAS)
            ).to.be.revertedWith("Vault: Failed to send ether to fee receiver");
        });

        it("Revert, if called by non-owner.", async () => {
            await expect(
                proxy
                    .connect(unprivileged)
                    .payWhitehat(referenceId, whitehat.address, [{ token: tokenA.address, amount: 100 }], 0, GAS)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("renounceOwnership()", async () => {
        it("Should revert even if called by the owner.", async () => {
            await expect(proxy.connect(owner).renounceOwnership()).to.be.revertedWith("renounce disabled");
        });

        it("Should revert if called by non-owner.", async () => {
            await expect(proxy.connect(unprivileged).renounceOwnership()).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });
    });

    describe("setIsPausedOnImmunefi()", async () => {
        it("Should work.", async () => {
            let tx = await proxy.connect(owner).setIsPausedOnImmunefi(true);
            await expect(tx).to.emit(proxy, "PausedOnImmunefi").withArgs(true);

            await proxy.connect(owner).setIsPausedOnImmunefi(false);
        });

        it("Revert, if called by other than owner.", async () => {
            await expect(proxy.connect(unprivileged).setIsPausedOnImmunefi(true)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });
    });
});
