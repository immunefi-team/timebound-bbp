// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.13;

interface IWho {
    function whoami() external view returns (string memory);
}
