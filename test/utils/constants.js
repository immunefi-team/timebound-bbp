"use strict";

const { ethers } = require("hardhat");

const hardhatUpgradeOpts = {
    unsafeAllow: ["constructor", "state-variable-immutable"],
};

module.exports.constants = Object.freeze({
    hardhatUpgradeOpts,
});
