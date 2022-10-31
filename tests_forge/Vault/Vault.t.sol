pragma solidity 0.8.13;

import "../../contracts/vault/Vault.sol";
import "../../contracts/vault/VaultFactory.sol";
import "../../contracts/mock/MockERC20.sol";

import "forge-std/Test.sol";

contract SafeTest is Test {
    address payable public whitehat = payable(makeAddr("whitehat"));
    address payable public unprivileged = payable(makeAddr("unprivileged"));
    uint256 public gas = 2618; // Gnosis safe eth transfer requires at least 2618 gas
    uint256 public fee = 1000;
    uint256 public feeBasis = 10000;
    Vault public vaultImplementation;
    VaultFactory public vaultFactory;
    Vault public deployedVault;
    MockERC20 public erc20A;
    MockERC20 public erc20B;
    address public owner;

    bytes private constant _EMPTY_BYTES = abi.encodePacked(bytes32(0));

    // Needed so the test contract itself can receive ether
    // when withdrawing
    receive() external payable {}

    function setUp() public {
        vaultImplementation = new Vault();
        vaultFactory = new VaultFactory(address(this), address(vaultImplementation));

        bytes32 salt;
        address payable predictedAddress = payable(vaultFactory.predict(address(this), salt));

        vaultFactory.deploy(address(this), _EMPTY_BYTES, salt);

        owner = Vault(predictedAddress).owner();
        assertEq(owner, address(this)); // this current contract is the owner of the vault contract.
        deployedVault = Vault(predictedAddress);
    }

    function testWithdrawNotOwner(uint256 anyAmount) public {
        vm.deal(address(this), anyAmount);

        (bool success, ) = payable(address(deployedVault)).call{value: anyAmount}("");
        assertTrue(success);

        Vault.ERC20Payment[] memory payment;

        vm.prank(unprivileged, unprivileged);
        vm.expectRevert(abi.encodePacked("Ownable: caller is not the owner"));
        deployedVault.withdraw(payment, anyAmount);
    }

    function testPayWhitehatNotOwner(uint256 anyAmount) public {
        vm.deal(address(this), anyAmount);

        bytes32 referenceId = keccak256(abi.encodePacked(uint256(0)));
        (bool success, ) = payable(address(deployedVault)).call{value: anyAmount}("");
        assertTrue(success);

        Vault.ERC20Payment[] memory payment;

        vm.prank(unprivileged, unprivileged);
        vm.expectRevert(abi.encodePacked("Ownable: caller is not the owner"));
        deployedVault.payWhitehat(referenceId, whitehat, payment, anyAmount, gas);
    }

    function testInitialize() public {
        vm.expectRevert(abi.encodePacked("Initializable: contract is already initialized"));
        deployedVault.initialize(owner, _EMPTY_BYTES);
    }

    function testEthWithdraw(uint256 ethDepositAmount, uint256 ethWithdrawAmount) public {
        vm.assume(ethWithdrawAmount <= ethDepositAmount);
        vm.deal(address(this), ethDepositAmount);

        // Arrange
        (bool success, ) = payable(address(deployedVault)).call{value: ethDepositAmount}("");
        assertTrue(success);
        assertEq(address(deployedVault).balance, ethDepositAmount);

        // Act
        Vault.ERC20Payment[] memory payment;
        deployedVault.withdraw(payment, ethWithdrawAmount);

        // Assert
        assertEq(address(deployedVault).balance, ethDepositAmount - ethWithdrawAmount);
        assertEq(address(this).balance, ethWithdrawAmount);
    }

    function testTokenWithdraw(
        uint256 depositAmountA,
        uint256 withdrawAmountA,
        uint256 depositAmountB,
        uint256 withdrawAmountB
    ) public {
        vm.assume(withdrawAmountA <= depositAmountA);
        vm.assume(withdrawAmountB <= depositAmountB);

        // Arrange
        erc20A = new MockERC20(address(this), depositAmountA, "tokenA", "A");
        erc20B = new MockERC20(address(this), depositAmountB, "tokenB", "B");

        erc20A.transfer(address(deployedVault), depositAmountA);
        assertEq(erc20A.balanceOf(address(deployedVault)), depositAmountA);

        erc20B.transfer(address(deployedVault), depositAmountB);
        assertEq(erc20B.balanceOf(address(deployedVault)), depositAmountB);

        // Act
        Vault.ERC20Payment[] memory payment = new Vault.ERC20Payment[](2);
        payment[0] = Vault.ERC20Payment(address(erc20A), withdrawAmountA);
        payment[1] = Vault.ERC20Payment(address(erc20B), withdrawAmountB);
        deployedVault.withdraw(payment, 0);

        // Assert
        assertEq(erc20A.balanceOf(address(deployedVault)), depositAmountA - withdrawAmountA);
        assertEq(erc20B.balanceOf(address(deployedVault)), depositAmountB - withdrawAmountB);
        assertEq(erc20A.balanceOf(address(this)), withdrawAmountA);
        assertEq(erc20B.balanceOf(address(this)), withdrawAmountB);
    }

    function testEthPayment(uint256 ethDepositAmount, uint256 ethPaymentAmount) public {
        vm.assume(ethPaymentAmount < type(uint256).max / fee);
        vm.assume(ethDepositAmount > ethPaymentAmount + (ethPaymentAmount * fee) / feeBasis);
        vm.deal(address(this), ethDepositAmount);

        // Arrange
        bytes32 referenceId = keccak256(abi.encodePacked(uint256(0)));
        (bool success, ) = payable(address(deployedVault)).call{value: ethDepositAmount}("");
        assertTrue(success);
        assertEq(address(deployedVault).balance, ethDepositAmount);

        // Act
        Vault.ERC20Payment[] memory payment;
        deployedVault.payWhitehat(referenceId, whitehat, payment, ethPaymentAmount, gas);

        // Assert
        assertEq(
            address(deployedVault).balance,
            ethDepositAmount - ethPaymentAmount - (ethPaymentAmount * fee) / feeBasis
        );
        assertEq(address(whitehat).balance, ethPaymentAmount);
        assertEq(address(vaultFactory.feeTo()).balance, (ethPaymentAmount * fee) / feeBasis);
    }

    function testTokenPayment(
        uint256 depositAmountA,
        uint256 paymentAmountA,
        uint256 depositAmountB,
        uint256 paymentAmountB
    ) public {
        vm.assume(paymentAmountA < type(uint256).max / fee);
        vm.assume(depositAmountA > paymentAmountA + (paymentAmountA * fee) / feeBasis);
        vm.assume(paymentAmountB < type(uint256).max / fee);
        vm.assume(depositAmountB > paymentAmountB + (paymentAmountB * fee) / feeBasis);

        // Arrange
        bytes32 referenceId = keccak256(abi.encodePacked(uint256(0)));

        erc20A = new MockERC20(address(this), depositAmountA, "tokenA", "A");
        erc20B = new MockERC20(address(this), depositAmountB, "tokenB", "B");

        erc20A.transfer(address(deployedVault), depositAmountA);
        assertEq(erc20A.balanceOf(address(deployedVault)), depositAmountA);

        erc20B.transfer(address(deployedVault), depositAmountB);
        assertEq(erc20B.balanceOf(address(deployedVault)), depositAmountB);

        // Act
        Vault.ERC20Payment[] memory payment = new Vault.ERC20Payment[](2);
        payment[0] = Vault.ERC20Payment(address(erc20A), paymentAmountA);
        payment[1] = Vault.ERC20Payment(address(erc20B), paymentAmountB);
        deployedVault.payWhitehat(referenceId, whitehat, payment, 0, gas);

        // Assert
        assertEq(
            erc20A.balanceOf(address(deployedVault)),
            depositAmountA - paymentAmountA - (paymentAmountA * fee) / feeBasis
        );
        assertEq(
            erc20B.balanceOf(address(deployedVault)),
            depositAmountB - paymentAmountB - (paymentAmountB * fee) / feeBasis
        );
        assertEq(erc20A.balanceOf(address(whitehat)), paymentAmountA);
        assertEq(erc20B.balanceOf(address(whitehat)), paymentAmountB);
        assertEq(erc20A.balanceOf(vaultFactory.feeTo()), (paymentAmountA * fee) / feeBasis);
        assertEq(erc20B.balanceOf(vaultFactory.feeTo()), (paymentAmountB * fee) / feeBasis);
    }
}
