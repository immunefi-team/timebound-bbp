"use strict";

const { ethers } = require("hardhat");

const abiCoder = ethers.utils.defaultAbiCoder;

const readArtifact = (contractName) => {
    let source = `../../forge-artifacts/${contractName}.sol/${contractName}.json`;
    let artefact = require(source);
    return {
        contractName: contractName,
        sourceName: source,
        abi: artefact.abi,
        bytecode: artefact.bytecode.object,
        deployedBytecode: artefact.deployedBytecode.object,
        linkReferences: artefact.bytecode.linkReferences,
        deployedLinkReferences: artefact.deployedBytecode.linkReferences,
    };
};

async function getContractFactory(name, deployerAddr) {
    if (typeof deployerAddr === "undefined") {
        return await ethers.getContractFactoryFromArtifact(readArtifact(name));
    }
    return await ethers.getContractFactoryFromArtifact(readArtifact(name), deployerAddr);
}

async function getContractAt(name, deployedAddr) {
    return await ethers.getContractAtFromArtifact(readArtifact(name), deployedAddr);
}

async function blockchainNow() {
    return (await ethers.provider.getBlock("latest")).timestamp;
}

async function blockForwarder(targetBlock) {
    while ((await ethers.provider.getBlockNumber()) != targetBlock) {
        await network.provider.send("evm_mine");
    }
}

async function getBlockchainTime() {
    return (await ethers.provider.getBlock("latest")).timestamp;
}

function generateRandomSalt() {
    const buf = ethers.utils.randomBytes(32);
    const salt = ethers.utils.hexlify(buf);
    return salt;
}

async function impersonateToSigner(contract) {
    await ethers.provider.send("hardhat_impersonateAccount", [contract.address]);
    let newSigner = await ethers.getSigner(contract.address);
    await ethers.provider.send("hardhat_setBalance", [newSigner.address, "0x1000000000000000000000000000000"]);
    return newSigner;
}

async function getCreate2Addr(deployerAddr, bytecode, salt) {
    if (salt == undefined) {
        salt = ethers.utils.zeroPad([0], 32);
    }
    return ethers.utils.getCreate2Address(deployerAddr, salt, ethers.utils.keccak256(bytecode));
}

async function predictBeaconProxy(caller, vaultFactory, bytecode, salt) {
    if (salt == undefined) {
        salt = ethers.utils.zeroPad([0], 32);
    }
    let proxySalt = ethers.utils.solidityKeccak256(["address", "bytes32"], [caller.address, salt]);

    let args = abiCoder.encode(["address", "uint", "uint"], [vaultFactory.address, 64, 0]);
    let proxyByteCode = ethers.utils.hexConcat([bytecode, args]);

    return await getCreate2Addr(vaultFactory.address, proxyByteCode, proxySalt);
}

module.exports = {
    blockchainNow,
    blockForwarder,
    getBlockchainTime,
    generateRandomSalt,
    impersonateToSigner,
    getContractFactory,
    getContractAt,
    getCreate2Addr,
    predictBeaconProxy,
};
