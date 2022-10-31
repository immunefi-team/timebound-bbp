// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.13;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IVaultFactory} from "../interfaces/IVaultFactory.sol";

/**
 * @title Vault Storage
 * @author Immunefi
 * @notice We use vault storage contracts to keep upgradeability
 */
contract VaultStorageV1 is OwnableUpgradeable {
    IVaultFactory public vaultFactory;
    bool public isPausedOnImmunefi;
}
