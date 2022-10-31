const { expect } = require("chai");
const { ethers } = require("hardhat");
const { predictBeaconProxy } = require("../utils/helpers.js");

describe("VaultFactory", async () => {
    let deployer, unprivileged, owner, rich, whitehat, proposer, feeAddr1, feeAddr2;
    let vaultFactory, vault;
    let initializerData, salt;
    let BeaconProxyFactory;

    beforeEach(async () => {
        [deployer, owner, rich, unprivileged, whitehat, proposer, feeAddr1, feeAddr2] = await ethers.getSigners();

        BeaconProxyFactory = await ethers.getContractFactory("BeaconProxy");

        const Vault = await ethers.getContractFactory("Vault", deployer);
        vault = await Vault.connect(deployer).deploy();

        const VaultFactory = await ethers.getContractFactory("VaultFactory", deployer);
        vaultFactory = await VaultFactory.connect(deployer).deploy(owner.address, vault.address);
        await vaultFactory.connect(owner).transferFeeTo(feeAddr1.address);
        await vaultFactory.connect(feeAddr1).acceptFeeTo();

        emptyBytes = ethers.constants.HashZero;
        salt = ethers.utils.zeroPad([0], 32);
    });

    describe("constructor()", async () => {
        beforeEach(async () => {
            const VaultFactory = await ethers.getContractFactory("VaultFactory", deployer);
            vaultFactory = await VaultFactory.connect(deployer).deploy(owner.address, vault.address);
        });

        it("should set the owner", async () => {
            await expect(await vaultFactory.connect(unprivileged).owner()).to.be.equal(owner.address);
        });

        it("should set the feeTo to be the same as the owner", async () => {
            await expect(await vaultFactory.connect(unprivileged).feeTo()).to.be.equal(owner.address);
        });
    });

    describe("transferFeeTo()", async () => {
        it("should work if called by feeTo.", async () => {
            await vaultFactory.connect(feeAddr1).transferFeeTo(feeAddr2.address);
            await vaultFactory.connect(feeAddr2).acceptFeeTo();
            await expect(await vaultFactory.connect(unprivileged).feeTo()).to.be.equal(feeAddr2.address);
        });

        it("should work if rejected.", async () => {
            await vaultFactory.connect(feeAddr1).transferFeeTo(feeAddr2.address);
            await vaultFactory.connect(feeAddr2).rejectFeeTo();
            await expect(await vaultFactory.connect(unprivileged).feeTo()).to.be.equal(feeAddr1.address);
        });

        it("revert, when rejected feeTo.", async () => {
            await vaultFactory.connect(feeAddr1).transferFeeTo(feeAddr2.address);
            await vaultFactory.connect(feeAddr2).rejectFeeTo();
            await expect(vaultFactory.connect(feeAddr2).acceptFeeTo()).to.be.revertedWith(
                "VaultFactory: not pending fee receiver"
            );
        });

        it("revert, when called by owner.", async () => {
            await expect(vaultFactory.connect(owner).transferFeeTo(feeAddr2.address)).to.be.revertedWith(
                "VaultFactory: not fee receiver"
            );
        });

        it("revert, if called by other than feeTo.", async () => {
            await expect(vaultFactory.connect(unprivileged).transferFeeTo(feeAddr1.address)).to.be.revertedWith(
                "VaultFactory: not fee receiver"
            );
        });
    });

    describe("fee", async () => {
        it("defaults to 10%", async () => {
            const fee = await vaultFactory.connect(unprivileged).fee();
            const FEE_BASIS = await vaultFactory.connect(unprivileged).FEE_BASIS();
            await expect(fee / FEE_BASIS).to.be.equal(0.1);
        });
    });

    describe("setFee()", async () => {
        it("should work", async () => {
            const prevFee = await vaultFactory.connect(unprivileged).fee();
            const newFee = 1200;

            const tx = await vaultFactory.connect(feeAddr1).setFee(newFee);
            await expect(await vaultFactory.connect(unprivileged).fee()).to.be.equal(newFee);

            await expect(tx)
                .to.emit(vaultFactory, "FeeChanged")
                .withArgs((_prevFree = prevFee), (_newFree = newFee));
        });

        it("revert, when call by other than feeTo", async () => {
            await expect(vaultFactory.connect(owner).setFee(100)).to.be.revertedWith("VaultFactory: not fee receiver");
        });

        it("revert, when set to higher than FEE_BASIS", async () => {
            const FEE_BASIS = await vaultFactory.connect(unprivileged).FEE_BASIS();
            const newFeeBasis = FEE_BASIS.add(ethers.BigNumber.from("1"));
            await expect(vaultFactory.connect(feeAddr1).setFee(newFeeBasis)).to.be.revertedWith(
                "VaultFactory: newFee must be below 100_00"
            );
        });
    });

    describe("deploy()", async () => {
        it("should work.", async () => {
            let predictProxyAddr = await vaultFactory.connect(unprivileged).predict(unprivileged.address, salt);

            let tx = await vaultFactory.connect(unprivileged).deploy(owner.address, emptyBytes, salt);
            await expect(tx)
                .to.emit(vaultFactory, "Deployed")
                .withArgs(
                    (_proxy = predictProxyAddr),
                    (_sender = unprivileged.address),
                    (_salt = ethers.constants.HashZero)
                );

            let proxy = await ethers.getContractAt("Vault", predictProxyAddr);
            await expect(tx)
                .to.emit(proxy, "Initialized")
                .withArgs((version = 1));

            await expect(await proxy.owner()).to.be.equal(owner.address);
        });

        it("Deploying multiple times.", async () => {
            let predictProxyAddr = await vaultFactory.connect(unprivileged).predict(unprivileged.address, salt);

            let tx = await vaultFactory.connect(unprivileged).deploy(owner.address, emptyBytes, salt);
            await expect(tx)
                .to.emit(vaultFactory, "Deployed")
                .withArgs(
                    (_proxy = predictProxyAddr),
                    (_sender = unprivileged.address),
                    (_salt = ethers.constants.HashZero)
                );

            salt2 = ethers.utils.zeroPad([1], 32);
            let predictProxyAddr2 = await vaultFactory.connect(unprivileged).predict(unprivileged.address, salt2);
            let tx2 = await vaultFactory.connect(unprivileged).deploy(owner.address, emptyBytes, salt2);
            await expect(tx2)
                .to.emit(vaultFactory, "Deployed")
                .withArgs(
                    (_proxy = predictProxyAddr2),
                    (_sender = unprivileged.address),
                    (_salt = ethers.utils.hexlify(salt2))
                );
        });
    });

    describe("predict()", async () => {
        it("should work.", async () => {
            let contract = vaultFactory.connect(unprivileged);
            let proxyAddr = await contract.predict(unprivileged.address, salt);
            let tx = await contract.deploy(owner.address, emptyBytes, salt);
            await expect(tx)
                .to.emit(vaultFactory, "Deployed")
                .withArgs((_proxy = proxyAddr), (_sender = unprivileged.address), (_salt = ethers.constants.HashZero));

            let predictedProxyAddr = await predictBeaconProxy(unprivileged, vaultFactory, BeaconProxyFactory.bytecode);
            await expect(predictedProxyAddr).to.be.equal(proxyAddr);
        });
    });
});
