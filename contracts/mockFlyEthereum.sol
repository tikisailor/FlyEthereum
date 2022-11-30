// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./FlyEthereum.sol";

contract mockFlyEthereum is FlyEthereum {

    constructor(ERC4626 underlying_) FlyEthereum(underlying_) {}

    int256 public mockDebtReductionPercent;

    bool public mockDebt = false;

    function setMock(bool _mockDebt, int256 _mockDebtReductionPercent) public {
        mockDebt = _mockDebt;
        mockDebtReductionPercent = _mockDebtReductionPercent;
    }


    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        require(receiver == msg.sender, "You can only deposit to yourself");
        require(assets <= maxDeposit(receiver), "Maximum deposit is 10 WETH");
        require(assets >= foldingThreshold, "Deposit under foldingThreshold");

        SafeERC20.safeTransferFrom(WETH_9, msg.sender, address(this), assets);

        // int256 actualDebt;

        // if (mockDebt && (totalDebt > 0)) {
        //     actualDebt = int256(totalDebt) - ((int256(totalDebt) / 100) * mockDebtReductionPercent);
        // } else {
        //     actualDebt = int256(totalDebt);
        // }

        // IAlchemistV2Eth alchemist = IAlchemistV2Eth(ALCHEMIST_CONTRACT);

        // (int256 currentDebt, ) = alchemist.accounts(address(this));
        
        // uint256 currentCredit = uint256(int256(totalDebt) - actualDebt);

        // emit ContractDebt(
        //     totalDebt,
        //     actualDebt,
        //     currentCredit
        // );

        uint256 alchemixShares = _fold(assets);

        _mint(msg.sender, alchemixShares);

        emit Deposit(msg.sender, receiver, assets, alchemixShares);

        // totalDebt += debt;

        // ledger.push(Entry({totalDebt: totalDebt, totalCredit: currentCredit}));

        // uint256 ledgerIndex = ledger.length - 1;

        // accounts[receiver].debt > 0 ? credit += _updateAccountCredit(receiver, ledgerIndex) : credit;

        // accounts[receiver].debt += debt;

        // accounts[receiver].credit += credit;

        // accounts[receiver].ledgerIndex = ledgerIndex;

        return alchemixShares;
    }

    function _fold (uint256 _assets) internal override returns (uint256) {

        uint256 debt = 0;
        uint256 alchemistShares = 0;

        while (_assets >= foldingThreshold) {
            // _approveAlchemistV2(_assets);
            uint256 alcxShares = _assets;
            alchemistShares += alcxShares;
            uint256 maxLoan = _assets / 2;

            // uint256 maxLoan = _calculateMaxLoan(_assets);
            // _takeAlEthLoan(maxLoan);
            debt += maxLoan;
            // uint256 dy =_swapAlEth(maxLoan);
            uint256 dy = maxLoan;
            // _wrapEth(dy);
            emit Fold(
                _assets,
                alcxShares,
                maxLoan,
                dy
            );
            _assets = dy;
        }

        return alchemistShares;
    }
}