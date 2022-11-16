// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

// constructor() payable ERC20("Vault Challenge Token", "VCT") {
//         require(msg.value == 1 ether, "Must init the contract with 1 eth");
//         _deposit(msg.sender, address(this), msg.value);
//     }


/// @custom:security-contact tikisailor@protonmail.com
contract FlyEthereum is ERC4626{

    constructor(
        ERC4626 underlying_

    ) ERC4626(underlying_) ERC20("FlyEthereum", "flyETH") {
        // require(msg.value == 1 ether, "Must init the contract with 1 eth");
        // _deposit(msg.sender, address(this), msg.value, msg.value);
        // _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // _grantRole(PAUSER_ROLE, msg.sender);
        // _grantRole(MINTER_ROLE, msg.sender);
    }

    function decimals() public pure override(ERC20) returns (uint8) {
        return 18;
    }

    // function pause() public onlyRole(PAUSER_ROLE) {
    //     _pause();
    // }

    // function unpause() public onlyRole(PAUSER_ROLE) {
    //     _unpause();
    // }

    // function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
    //     _mint(to, amount);
    // }

    // function _beforeTokenTransfer(address from, address to, uint256 amount)
    //     internal
    //     whenNotPaused
    //     override
    // {
    //     super._beforeTokenTransfer(from, to, amount);
    // }

    // function deposit(uint256 assets, address receiver) public payable override returns (uint256) {
    //     require(assets <= maxDeposit(receiver), "ERC4626: deposit more than max");

    //     uint256 shares = previewDeposit(assets);
    //     _deposit(_msgSender(), receiver, assets, shares);

    //     return shares;
    // }
}