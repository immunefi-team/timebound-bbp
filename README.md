# Protocol MVP
Immunefi wants to resolve the trust issue that currently exists in bug bounty programs by creating a decentralized version of the bounty programs we currently run on our “Web2” infrastructure.
This protocol provides a way for projects to lock collateral for bug bounties to further incentivize hackers to review their projects.

## Deployments

| Asset          | Address                                    | Network |
| ---------------- | ------------------------------------------ | ------------------------------------------ |
| [Vault Factory](./contracts/vault/VaultFactory.sol)  | [0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512](https://goerli.etherscan.io/address/0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512) | Goerli Network |
| [Vault Implementation](./contracts/vault/Vault.sol)  | [0x5FbDB2315678afecb367f032d93F642f64180aa3](https://goerli.etherscan.io/address/0x5FbDB2315678afecb367f032d93F642f64180aa3) | Goerli Network |

## Environment Variables
| Name             | Example                                    |
| ---------------- | ------------------------------------------ |
| PRIVKEY | [PK] |
| FEETO | [ETH_ADDRESS] |
| ETHERSCAN_API_KEY | [API_KEY] |
<!-- | ALCHEMY_API | https://eth-mainnet.alchemyapi.io/v2/[API_KEY] | -->

## Install
To install dependencies run:

```bash
npm install
```

To compile run:

```bash
forge install
forge build --hardhat
```

## Tests
To run hardhat tests written in javascript:

```bash
npx hardhat test
```


## Deployment
Export relevant environment variables, then run the following for Goerli test network:
```
npx hardhat run scripts/deployMVP.js --network goerli
```
To upgrade the Vault implementation contract, define the VAULT_FACTORY environment variable to point to the correct contract on the target network and run:
```
npx hardhat run scripts/upgradeVault.js --network goerli
```

## Foundry Tests
To run foundry tests:
```
forge test -vvv
```
If you are missing foundry dependencies, run:
```
forge install
```

## Verify Contracts
Export ETHERSCAN_API_KEY
```
npx hardhat verify --network goerli [CONTRACT_ADDRESS]
```

## Audits

## License
