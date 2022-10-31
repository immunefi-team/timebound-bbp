// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.13;

import {IWho} from "./IWho.sol";

contract Bar is IWho {
    function whoami() external pure override returns (string memory) {
        return "I am Bar";
    }
}
