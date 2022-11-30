// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

interface IAlchemistV2Eth {
  function approveMint(address spender, uint256 amount) external;
  function mint(uint256 amount, address receiver) external;
  function depositUnderlying(address yieldToken, uint256 amount, address receipient, uint256 minimumAmountOut) external returns (uint256 shares);
  function withdrawUnderlying(address yieldToken, uint256 shares, address receipient, uint256 minimumAmountOut) external returns (uint256 assets);
  function accounts(address owner) external view returns (int256 debt, address[] memory depositedTokens);
  function positions(address owner, address yielToken) external view returns (uint256 shares, uint256 lastAccruedWeights);
  function convertSharesToUnderlyingTokens(address yieldToken, uint256 amount) external view returns (uint256);
  function convertUnderlyingTokensToShares(address yieldToken, uint256 amount) external view returns (uint256);
  function liquidate(address yieldToken, uint256 shares, uint256 minimumAmountOut) external returns (uint256 sharesLiquidated);
}

interface ICurvePoolAlEth {
  function coins(uint256 index) external view returns (address);
  function get_dy(int128 indexCoinToSend, int128 indexCoinToReceive, uint256 amount) external view returns (uint256);
  function exchange(int128 indexCoinToSend, int128 indexCoinToReceive, uint256 assets, uint256 minDy) external payable returns (uint256);
} 

interface IWETH9 is IERC20{
    function deposit() external payable;
    function decimals() external view returns (uint256);
}

contract FlyEthereum is ERC4626, ERC20Burnable, Pausable, AccessControl, ERC20Permit {
    using Math for uint256;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    address public constant ALCHEMIST_CONTRACT = 0x062Bf725dC4cDF947aa79Ca2aaCCD4F385b13b5c;
    address public constant ALCHEMIST_YIELD_TOKEN_CONTRACT = 0xa258C4606Ca8206D8aA700cE2143D7db854D168c;
    address public constant ALCHEMIST_DEBT_TOKEN_CONTRACT= 0x0100546F2cD4C9D97f798fFC9755E47865FF7Ee6;
    address public constant CURVE_ALETH_POOL_CONTRACT = 0xC4C319E2D4d66CcA4464C0c2B32c9Bd23ebe784e;

    uint256 public constant ALCHEMIST_MIN_DY_PERCENT = 98;
    uint256 public constant CURVE_MIN_DY_PERCENT = 98;

    IWETH9 internal WETH_9;
    IAlchemistV2Eth internal ALCHEMIST_V2_ALETH = IAlchemistV2Eth(ALCHEMIST_CONTRACT);

    uint256 public foldingThreshold;

    uint256 public alchemistUnderlyingSnapshot = 0;

    event Fold(
        uint256 assets,
        uint256 alcxShares,
        uint256 maxLoan,
        uint256 dy
    );

    constructor(
        ERC4626 underlying_
    ) ERC4626(underlying_) ERC20("FlyEthereum", "flyETH") ERC20Permit("FlyEthereum") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        foldingThreshold = 2 ether;
        WETH_9 = IWETH9(asset());
    }

    function maxDeposit(address) public pure override returns (uint256) {
        return 1000 ether;
    }

    function setFoldingThreshold(uint256 foldingThreshold_) public onlyRole(MANAGER_ROLE) {
        foldingThreshold = foldingThreshold_;
    }

    function _getDy(uint256 amount, uint256 factor) internal pure returns (uint256){
        return amount.mulDiv(factor, 100, Math.Rounding.Down);
    }

    function _approveAlchemistV2(uint256 assets) internal {
        WETH_9.approve(ALCHEMIST_CONTRACT, assets);
    }

    function _calculateMaxLoan(uint256 alchemixShares) internal pure returns (uint256) {
        return (alchemixShares / 2);
        // return (alchemixShares / 2) -1;
    }

    function _takeAlchemixLoan(uint256 amount) internal {
        ALCHEMIST_V2_ALETH.approveMint(address(ALCHEMIST_V2_ALETH), amount);
        ALCHEMIST_V2_ALETH.mint(amount, address(this));
    }

    function _liquidateAchemixLoan(address yieldToken, uint256 shares, uint256 minimumAmountOut) internal returns (uint256 sharesLiquidated) {
        return ALCHEMIST_V2_ALETH.liquidate(yieldToken, shares, minimumAmountOut);
    }

    function _getCurveDy(uint256 assets) internal view returns (uint256) {
        ICurvePoolAlEth curvePool = ICurvePoolAlEth(CURVE_ALETH_POOL_CONTRACT);
        address zeroAddress = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
        int128 indexEth;
        int128 indexAlEth;

        if (curvePool.coins(0) == zeroAddress) {
            indexEth = 0;
            indexAlEth = 1;
        } else {
            indexEth = 1;
            indexAlEth = 0;
        }

        return curvePool.get_dy(indexAlEth, indexEth, assets);
    }

    function _swapAlEth(uint256 assets) internal returns (uint256) {
        ICurvePoolAlEth curvePool = ICurvePoolAlEth(CURVE_ALETH_POOL_CONTRACT);
        address zeroAddress = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
        int128 indexEth;
        int128 indexAlEth;
        uint256 minDy = _getDy(assets, CURVE_MIN_DY_PERCENT);

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

        return dy;
    }

    function _wrapEth(uint256 assets) internal {
        WETH_9.deposit{value: assets}();
    }

    function _depositAlchemist(uint256 assets) internal returns (uint256) {
        uint256 minimumRequested = _getDy(assets, ALCHEMIST_MIN_DY_PERCENT);
        uint256 alcxShares = ALCHEMIST_V2_ALETH.depositUnderlying(ALCHEMIST_YIELD_TOKEN_CONTRACT, assets, address(this), minimumRequested);
        return alcxShares;
    }

    function _fold (uint256 _assets) internal virtual returns (uint256) {
        uint256 debt = 0;
        uint256 alchemixShares = 0;
        while (_assets >= foldingThreshold) {
            _approveAlchemistV2(_assets);
            uint256 alcxShares = _depositAlchemist(_assets);
            alchemixShares += alcxShares;
            uint256 maxLoan = _calculateMaxLoan(alcxShares);
            uint256 curveDy = _getCurveDy(maxLoan);
            if (curveDy >= foldingThreshold) {
                _takeAlchemixLoan(maxLoan);
                debt += maxLoan;
                uint256 dy =_swapAlEth(maxLoan);
                _wrapEth(dy);
                emit Fold(
                    _assets,
                    alcxShares,
                    maxLoan,
                    dy
                );

                _assets = dy;
            } else {
                _assets = 0;
            }
        }
        assert(_assets == 0);
        return alchemixShares;
    }

    function deposit(uint256 assets, address receiver) public virtual override returns (uint256) {
        require(receiver == msg.sender, "You can only deposit to yourself");
        require(assets <= maxDeposit(receiver), "Maximum deposit is 10 WETH");
        require(assets >= foldingThreshold, "Deposit under foldingThreshold");

        SafeERC20.safeTransferFrom(WETH_9, msg.sender, address(this), assets);

        uint256 alchemixShares = _fold(assets);

        _mint(receiver, alchemixShares);

        emit Deposit(msg.sender, receiver, assets, alchemixShares);

        return alchemixShares;
    }

    function withdraw( uint256 shares, address receiver, address owner) public virtual override returns (uint256) {
        require(receiver == msg.sender, "You can only withdraw to yourself");
        // require(shares <= maxWithdraw(receiver), "Maximum withdraw exceeded");
        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }

        uint256 _shares = shares;

        (int256 actualDebt, ) = ALCHEMIST_V2_ALETH.accounts(address(this));
        if (actualDebt >= 0) {
            uint256 debtShare = uint256(actualDebt).mulDiv(shares, totalSupply(), Math.Rounding.Up);
            uint256 payableShares = ALCHEMIST_V2_ALETH.convertUnderlyingTokensToShares(ALCHEMIST_YIELD_TOKEN_CONTRACT, debtShare);
            uint256 sharesLiquidated = _liquidateAchemixLoan(
                ALCHEMIST_YIELD_TOKEN_CONTRACT, 
                payableShares, 
                _getDy(payableShares, ALCHEMIST_MIN_DY_PERCENT)
            );
            _shares -= sharesLiquidated;
        } 

        _burn(owner, shares);
        uint256 assets = ALCHEMIST_V2_ALETH.withdrawUnderlying(
            ALCHEMIST_YIELD_TOKEN_CONTRACT, 
            _shares, receiver, 
            _getDy(_shares, ALCHEMIST_MIN_DY_PERCENT)
        );
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
        
        return assets;
    }

    function previewDeposit(uint256 assets) public view virtual override returns (uint256) {
        uint256 _assets = assets;
        uint256 shares = 0;

        while (_assets >= foldingThreshold) {
            uint256 alchemix_dy = _getDy(_assets, ALCHEMIST_MIN_DY_PERCENT);
            shares += alchemix_dy;
            uint256 curve_dy = (ALCHEMIST_MIN_DY_PERCENT * CURVE_MIN_DY_PERCENT).mulDiv(_assets, 20000, Math.Rounding.Down);
            if (curve_dy >= foldingThreshold) {
                _assets = curve_dy;
            } else {
                _assets = 0;
            }
        }

        return shares;
    }

    function previewDepositCustom(uint256 assets, uint256 minOutPercentAlchemist, uint256 minOutPercentCurvePool) public view virtual returns (uint256) {
        uint256 _assets = assets;
        uint256 shares = 0;

        while (_assets >= foldingThreshold) {
            uint256 alchemix_dy = _getDy(_assets, minOutPercentAlchemist);
            shares += alchemix_dy;
            uint256 curve_dy = (minOutPercentAlchemist * minOutPercentCurvePool).mulDiv(_assets, 20000, Math.Rounding.Down);
            if (curve_dy >= foldingThreshold) {
                _assets = curve_dy;
            } else {
                _assets = 0;
            }
        }

        return shares;
    }

    function previewWithdraw(uint256 shares) public view virtual override returns (uint256) {
        uint256 _shares = shares;

        (int256 actualDebt, ) = ALCHEMIST_V2_ALETH.accounts(address(this));
        if (actualDebt >= 0) {
            uint256 debtShare = uint256(actualDebt).mulDiv(shares, totalSupply(), Math.Rounding.Up);
            uint256 payableShares = ALCHEMIST_V2_ALETH.convertUnderlyingTokensToShares(ALCHEMIST_YIELD_TOKEN_CONTRACT, debtShare);
            _shares -= payableShares;
        } 
        
        return ALCHEMIST_V2_ALETH.convertSharesToUnderlyingTokens(ALCHEMIST_YIELD_TOKEN_CONTRACT, _shares);
    }

    function convertToShares(uint256 assets) public view override returns (uint256) {

        uint256 _assets = assets;
        uint256 shares = 0;

        while (_assets >= foldingThreshold) {
            uint256 alchemix_dy = ALCHEMIST_V2_ALETH.convertUnderlyingTokensToShares(ALCHEMIST_YIELD_TOKEN_CONTRACT, _assets);
            shares += alchemix_dy;
            uint256 curve_dy = _getCurveDy(_assets);
            if (curve_dy >= foldingThreshold) {
                _assets = curve_dy;
            } else {
                _assets = 0;
            }
        }

        return shares;
    }

    function convertToAssets(uint256 shares) public view override returns (uint256 assets) {
        (int256 actualDebt, ) = ALCHEMIST_V2_ALETH.accounts(address(this));
        if (actualDebt >= 0) {
            uint256 debtShare = Math.ceilDiv(uint256(actualDebt), shares);
            shares -= debtShare;
        } 
        return ALCHEMIST_V2_ALETH.convertSharesToUnderlyingTokens(ALCHEMIST_YIELD_TOKEN_CONTRACT, shares);
        
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


    // function calculateExchangeRate() public view returns (uint256) {

    //     if (alchemistUnderlyingSnapshot == 0) return exchangeRate;

    //     IAlchemistV2Eth alchemist = IAlchemistV2Eth(ALCHEMIST_CONTRACT);

    //     (uint256 shares, ) = alchemist.positions(address(this), ALCHEMIST_YIELD_TOKEN_CONTRACT);

    //     (int256 debt, ) = alchemist.accounts(address(this));

    //     uint256 underlying = alchemist.convertSharesToUnderlyingTokens(ALCHEMIST_YIELD_TOKEN_CONTRACT, shares);

    //     return exchangeRate.mulDiv(uint256(int256(underlying) - debt), alchemistUnderlyingSnapshot, Math.Rounding.Down);
    // }


        // function _convertToShares(uint256 assets, Math.Rounding rounding) internal view override returns (uint256 shares) {

    //     // uint256 ex = calculateExchangeRate();

    //     // (X(20÷10))×100 = X / 0.020
    //     return (Math.ceilDiv(assets, Math.ceilDiv(ex, exchangeDenominator)))*100;

    //     // IWETH9 underlying = IWETH9(asset());
    //     // return assets.mulDiv(10**decimals(), 10**underlying.decimals(), rounding); // 1:1
    // }


        // not gas safe
    // function _unfold (uint256 _assets) internal virtual returns (uint256, uint256) {
    //     uint256 debt = accounts[msg.sender].debt;
    //     uint256 ledgerIndex = accounts[msg.sender].ledgerIndex;
    //     uint256 credit = accounts[msg.sender].credit;

    //     while (credit < foldingThreshold) {
    //         _approveAlchemistV2(_assets);
    //         uint256 alcxShares = _depositAlchemist(_assets);
    //         uint256 maxLoan = _calculateMaxLoan(alcxShares);
    //         _takeAlchemixLoan(maxLoan);
    //         debt += maxLoan;
    //         uint256 dy =_swapAlEth(maxLoan);
    //         _wrapEth(dy);
    //         emit Fold(
    //             _assets,
    //             alcxShares,
    //             maxLoan,
    //             dy
    //         );
    //         _assets = dy;
    //     }

    //     return (debt, _assets);
    // }

        // not gas safe
    // function _fold (uint256 _assets) internal virtual returns (uint256, uint256, uint256) {
    //     uint256 debt = 0;
    //     uint256 alchemixShares = 0;
    //     while (_assets >= foldingThreshold) {
    //         _approveAlchemistV2(_assets);
    //         uint256 alcxShares = _depositAlchemist(_assets);
    //         alchemixShares += alcxShares;
    //         uint256 maxLoan = _calculateMaxLoan(alcxShares);
    //         uint256 curveDy = _getCurveDy(maxLoan);
    //         if (curveDy >= foldingThreshold) {
    //             _takeAlchemixLoan(maxLoan);
    //             debt += maxLoan;
    //             uint256 dy =_swapAlEth(maxLoan);
    //             _wrapEth(dy);
    //             emit Fold(
    //                 _assets,
    //                 alcxShares,
    //                 maxLoan,
    //                 dy
    //             );

    //             _assets = dy;
    //         } else {
    //             _assets = 0;
    //         }
    //     }
    //     return (debt, _assets, alchemixShares);
    // }

        // function withdraw( uint256 shares, address receiver, address owner, uint256 minOutliquidate, uint256 minOutUnderlying) public virtual returns (uint256 assets) {
    //     require(receiver == msg.sender, "You can only withdraw to yourself");
    //     require(assets <= maxWithdraw(receiver), "Maximum withdraw exceeded");
    //     if (msg.sender != owner) {
    //         _spendAllowance(owner, msg.sender, shares);
    //     }

    //     uint256 _shares = shares;

    //     IAlchemistV2Eth alchemist = IAlchemistV2Eth(ALCHEMIST_CONTRACT);
    //     (int256 actualDebt, ) = alchemist.accounts(address(this));
    //     if (actualDebt >= 0) {
    //         uint256 debtShare = uint256(actualDebt).mulDiv(shares, totalSupply(), Math.Rounding.Up);
    //         uint256 payableShares = alchemist.convertUnderlyingTokensToShares(ALCHEMIST_YIELD_TOKEN_CONTRACT, debtShare);
    //         uint256 sharesLiquidated = _liquidateAchemixLoan(ALCHEMIST_YIELD_TOKEN_CONTRACT, payableShares, minOutliquidate);
    //         _shares -= sharesLiquidated;
    //     } 

    //     _burn(owner, shares);
    //     alchemist.withdrawUnderlying(ALCHEMIST_YIELD_TOKEN_CONTRACT, _shares, receiver, minOutUnderlying);
    //     emit Withdraw(msg.sender, receiver, owner, assets, shares);
    // }

       // function _updateAccountCredit(address owner, uint256 newIndex) internal view returns (uint256) {
    //     require(accounts[owner].debt > 0 , "Account not initialized");

    //     uint256 formerIndex = accounts[owner].ledgerIndex;

    //     uint256 credit;

    //     for (uint256 i = formerIndex + 1; i <= newIndex; i++) {

    //         uint256 debtRecord = ledger[i-1].totalDebt;
            
    //         uint256 share = debtRecord / accounts[owner].debt;

    //         credit += (ledger[i].totalCredit - ledger[i-1].totalCredit) / share;
    //     }

    //     return credit;
    // }

    // function getAccountPosition(address owner) public view returns (uint256 debt, uint256 credit, uint256 ledgerIndex) {
    //     return (accounts[owner].debt, accounts[owner].credit, accounts[owner].ledgerIndex);
    // }

    // function getLedgerEntry(uint256 index) public view returns (uint256 debt, uint256 credit) {
    //     Entry storage entry = ledger[index];
    //     return (entry.totalDebt, entry.totalCredit);
    // }