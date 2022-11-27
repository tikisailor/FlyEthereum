// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

    interface IAlchemistV2Eth {
        function approveMint(address spender, uint256 amount) external;
        function mint(uint256 amount, address receiver) external;
        function depositUnderlying(address _yieldToken, uint256 _amount, address _receipient, uint256 _minimumAmountOut) external returns (uint256 shares);
        function accounts(address owner) external view returns (int256 debt, address[] calldata lastAccruedWeights);
    }

    interface IWETH9 is IERC20{
        function deposit() external payable;
        function decimals() external view returns (uint256);
    }

contract mockAlchemist {

    address[] internal addys;
    address public constant ALCHEMIST_CONTRACT = 0x062Bf725dC4cDF947aa79Ca2aaCCD4F385b13b5c;
    address public constant ALCHEMIST_YIELD_TOKEN_CONTRACT = 0xa258C4606Ca8206D8aA700cE2143D7db854D168c;
    address public constant ALCHEMIST_DEBT_TOKEN_CONTRACT= 0x0100546F2cD4C9D97f798fFC9755E47865FF7Ee6;
    address public constant CURVE_ALETH_POOL_CONTRACT = 0xC4C319E2D4d66CcA4464C0c2B32c9Bd23ebe784e;
    uint256 public constant ALCHEMIST_MIN_DY_YIELD_TOKEN = 98;

    IWETH9 internal weth9;

    IAlchemistV2Eth alchemist = IAlchemistV2Eth(ALCHEMIST_CONTRACT);


    function approveMint(address spender, uint256 amount) public {
        // alchemist.approveMint(address(alchemist), amount);
    }
    function mint(uint256 amount, address receiver) public {
        // alchemist.mint(amount, receiver);
    }
    function depositUnderlying(address _yieldToken, uint256 _amount, address receiver, uint256 _minimumAmountOut) external payable returns (uint256 shares) {
        // uint256 minimumRequested = (_amount / 100) * ALCHEMIST_MIN_DY_YIELD_TOKEN;
        // uint256 alcxShares = alchemist.depositUnderlying(_yieldToken, _amount, receiver, _minimumAmountOut);
        // return alcxShares;
        return _amount;
    }

    function accounts(address owner) external view returns (int256 debt, address[] memory depositedTokens) {
        // (int256 currentDebt, ) = alchemist.accounts(0x4af802b3010e07845b2B8C2250126e9Ac0BDb6B9);
        return (8000000000000000000, addys);
    }

    // receive() external payable {}
 
}