// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

interface IAlchemistV2Eth {
  function approveMint(address spender, uint256 amount) external;
  function mint(uint256 amount, address receiver) external;
  function depositUnderlying(address _yieldToken, uint256 _amount, address _receipient, uint256 _minimumAmountOut) external returns (uint256 shares);
}

// interface ICurveFactoryV2 {
//   function approveMint(address spender, uint256 amount) external;
//   function mint(uint256 amount, address receiver) external;
//   function depositUnderlying(address _yieldToken, uint256 _amount, address _receipient, uint256 _minimumAmountOut) external returns (uint256 shares);
// }

interface ICurvePoolAlEth {
  function coins(uint256 index) external view returns (address);
  function get_dy(int128 indexCoinToSend, int128 indexCoinToReceive, uint256 amount) external view returns (uint256);
  function exchange(int128 indexCoinToSend, int128 indexCoinToReceive, uint256 assets, uint256 minDy) external payable returns (uint256);
} 

// interface IWETH9 is IERC20{}

contract FlyEthereum is ERC4626, ERC20Burnable, Pausable, AccessControl, ERC20Permit {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    // alchemist contract
    address public constant ALCHEMIST_CONTRACT = 0x062Bf725dC4cDF947aa79Ca2aaCCD4F385b13b5c;
    address public constant ALCHEMIST_YIELD_TOKEN_CONTRACT = 0xa258C4606Ca8206D8aA700cE2143D7db854D168c;
    address public constant ALCHEMIST_DEBT_TOKEN_CONTRACT= 0x0100546F2cD4C9D97f798fFC9755E47865FF7Ee6;
    address public constant CURVE_ALETH_POOL_CONTRACT = 0xC4C319E2D4d66CcA4464C0c2B32c9Bd23ebe784e;
    uint256 public constant ALCHEMIST_MIN_DY_YIELD_TOKEN = 98;

    IERC20 internal weth9;
    // IERC20 weth9 = IERC20(super.asset());


    uint256 public foldingThreshold;

    // positive value reflecting total debt held by the protocol
    uint256 public totalDebt;

    // mapping of dept per account
    // mapping(address => uint256) internal dept;

    // // positive value that decreases over time (negative values indicate credit)
    // uint256 public currentTotalDebt;

    // // totalDebt - currentTotalDebt
    // uint256 public availableTotalRewards;

    // // mapping of available rewards per user at the time of entry
    // mapping(address => uint256) public priorRewards;

    constructor(
        ERC4626 underlying_
    ) ERC4626(underlying_) ERC20("FlyEthereum", "flyETH") ERC20Permit("FlyEthereum") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        foldingThreshold = 1000000000000000000;
        weth9 = IERC20(asset());
    }

    // function _getCurrentAlchemixDept() internal view returns (uint256) {
    //     return 1000000000;
    // }

    // function _getAvailableRewards() internal view returns (uint256) {
    //     return totalDebt - _getCurrentAlchemixDept();
    // }

    function maxDeposit(address) public pure override returns (uint256) {
        return 10000000000000000000;
    }

    // not gas safe
    function _fold () internal {
        while (totalAssets() >= foldingThreshold) {
            _approveAlchemistV2(totalAssets());
            uint256 alcxShares = _depositAlchemist(totalAssets());
            uint256 maxLoan = _calculateMaxLoan(alcxShares);
            _takeAlEthLoan(maxLoan);
            _swapAlEth(maxLoan);
            // _wrapEth(dy);
        }
    }

    function _approveAlchemistV2(uint256 assets) internal {
        weth9.approve(ALCHEMIST_CONTRACT, assets);
    }

    function _depositAlchemist(uint256 assets) internal returns (uint256) {
        IAlchemistV2Eth alchemist = IAlchemistV2Eth(ALCHEMIST_CONTRACT);
        uint256 minimumRequested = (assets / 100) * ALCHEMIST_MIN_DY_YIELD_TOKEN;
        uint256 alcxShares = alchemist.depositUnderlying(ALCHEMIST_YIELD_TOKEN_CONTRACT, assets, address(this), minimumRequested);
        return alcxShares;
    }

    function _calculateMaxLoan(uint256 alchemixShares) internal pure returns (uint256) {
        return (alchemixShares / 2) -1;
    }

    function _takeAlEthLoan(uint256 amount) internal {
        IAlchemistV2Eth alchemist = IAlchemistV2Eth(ALCHEMIST_CONTRACT);
        alchemist.approveMint(address(alchemist), amount);
        alchemist.mint(amount, address(this));
    }

    function _swapAlEth(uint256 assets) internal {
        ICurvePoolAlEth curvePool = ICurvePoolAlEth(CURVE_ALETH_POOL_CONTRACT);
        address zeroAddress = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
        int128 indexEth;
        int128 indexAlEth;
        uint256 minDy = ((assets / 100) * 96);

        if (curvePool.coins(0) == zeroAddress) {
            indexEth = 0;
            indexAlEth = 1;
        } else {
            indexEth = 1;
            indexAlEth = 0;
        }

        uint256 dy = curvePool.get_dy(indexAlEth, indexEth, assets);

        require(dy >= minDy, "curve pool dy too low");

        IERC20 alEth = IERC20(ALCHEMIST_DEBT_TOKEN_CONTRACT);

        alEth.approve(CURVE_ALETH_POOL_CONTRACT, assets);

        dy = curvePool.exchange(indexAlEth, indexEth, assets, minDy);

        //wrap(dy)
    }

    function _wrapEth(uint256 assets) internal {
    }

    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        require(assets <= maxDeposit(receiver), "Maximum deposit is 10 WETH");

        uint256 shares = super.deposit(assets, receiver);

        _fold();

        return shares;
    }

    function setFoldingThreshold(uint256 foldingThreshold_) public onlyRole(MANAGER_ROLE) {
        foldingThreshold = foldingThreshold_;
    }

    function decimals() public pure override(ERC20) returns (uint8) {
        return 18;
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        override
    {
        super._beforeTokenTransfer(from, to, amount);
    }

    receive() external payable {
        // do nothing
    }
}