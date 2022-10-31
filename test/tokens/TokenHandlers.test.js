const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenHandler", async () => {
    let deployer, user1, user2, unprivileged;
    let tokenHandler, token677, token777, token1363, token677Reciever, token1363Reciever;

    const erc677InterfaceId = "0x01ffc9a7";
    const erc1363InterfaceId = "0x01ffc9a7";
    const nonInterfaceId = "0xdeadbeef";

    beforeEach(async () => {
        [deployer, user1, user2, unprivileged] = await ethers.getSigners();

        const TokenHandler = await ethers.getContractFactory("TokenHandler", deployer);
        const ERC677Factory = await ethers.getContractFactory("MockERC677", deployer);
        const ERC677TokenReciever = await ethers.getContractFactory("MockERC677Receiver", deployer);
        const ERC777Factory = await ethers.getContractFactory("MockERC777", deployer);
        const ERC1363Factory = await ethers.getContractFactory("MockERC1363", deployer);
        const ERC1363TokenReciever = await ethers.getContractFactory("MockERC1363Receiver", deployer);
        const Vault = await ethers.getContractFactory("Vault", deployer);

        vault = await Vault.connect(deployer).deploy();
        tokenHandler = await TokenHandler.deploy();
        token677 = await ERC677Factory.deploy();
        token777 = await ERC777Factory.deploy(vault.address, 100, "ERC777Test", "777", [deployer.address]);
        token677Reciever = await ERC677TokenReciever.deploy();
        token1363 = await ERC1363Factory.deploy();
        token1363Reciever = await ERC1363TokenReciever.deploy();
    });

    describe("transferAndCall()", async () => {
        let numTokens = 100;

        it("Should work with mockERC6777Reciever", async () => {
            await expect(await token677.connect(unprivileged).balanceOf(token677Reciever.address)).to.be.equal(0);

            let tx = await token677.connect(deployer).transferAndCall(token677Reciever.address, numTokens, []);
            await expect(tx).to.emit(token677Reciever, "OnTransferReceived").withArgs(deployer.address, numTokens, []);

            await expect(await token677.connect(unprivileged).balanceOf(token677Reciever.address)).to.be.equal(
                numTokens
            );

            await expect(await token677.connect(unprivileged).balanceOf(vault.address)).to.be.equal(0);
            await token677.connect(deployer).transferAndCall(vault.address, numTokens, []);
            await expect(await token677.connect(unprivileged).balanceOf(vault.address)).to.be.equal(numTokens);
        });

        it("Revert, ERC1363 reciever if the spender is not an contract", async () => {
            await expect(
                token1363.connect(deployer)["transferAndCall(address,uint256)"](unprivileged.address, 100)
            ).to.be.revertedWith("ERC1363: transfer to non contract address");
        });

        it("Should work with ERC1363", async () => {
            await expect(await token1363.connect(unprivileged).balanceOf(token1363Reciever.address)).to.be.equal(0);
            await token1363.connect(deployer)["transferAndCall(address,uint256)"](token1363Reciever.address, 100);
            await expect(await token1363.connect(unprivileged).balanceOf(token1363Reciever.address)).to.be.equal(100);

            await expect(await token1363.connect(unprivileged).balanceOf(vault.address)).to.be.equal(0);
            await token1363.connect(deployer)["transferAndCall(address,uint256)"](vault.address, 100);
            await expect(await token1363.connect(unprivileged).balanceOf(vault.address)).to.be.equal(100);
        });

        it("Should work with ERC777", async () => {
            await expect(await token777.connect(unprivileged).balanceOf(vault.address)).to.be.equal(100);
        });
    });

    describe("TokenHandler supportsInterface()", async () => {
        it("Should return true for the ERC677 token677 interfaceID.", async () => {
            await expect(await tokenHandler.connect(unprivileged).supportsInterface(erc677InterfaceId)).to.be.true;
        });

        it("Should return true for the ERC1363 interfaceID.", async () => {
            await expect(await tokenHandler.connect(unprivileged).supportsInterface(erc1363InterfaceId)).to.be.true;
        });

        it("Should return false for non supported interfaceID.", async () => {
            await expect(await tokenHandler.connect(unprivileged).supportsInterface(nonInterfaceId)).to.be.false;
        });
    });
});
