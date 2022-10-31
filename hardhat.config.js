require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-tracer");
require("solidity-coverage");

module.exports = {
    solidity: {
        compilers: [
            {
                version: "0.8.13",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 1000000,
                    },
                    viaIR: true,
                },
            },
        ],
    }
};
