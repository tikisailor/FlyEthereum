import dotenv from "dotenv";

import wethAbi from "./abi/weth9abi.json";
import alchemistV2Abi from "./abi/alchemistV2Abi.json";
import alEthAbi from "./abi/alEthAbi.json";
import yvWethAbi from "./abi/yvWethAbi.json";
import curveFactoryAbi from "./abi/curve-factory.json"; 
import curveAlEthPoolAbi from "./abi/curveAlEthPoolAbi.json"
import flyEthJson from "../artifacts/contracts/FlyEthereum.sol/FlyEthereum.json";


import hre, { ethers } from 'hardhat'
import { ERC20, FlyEthereum } from "../typechain";
import { expect } from "chai";
import { Contract } from '@ethersproject/contracts';
import { BigNumber } from '@ethersproject/bignumber';
import { formatEther } from '@ethersproject/units';

dotenv.config()


// await network.provider.request({
//   method: "hardhat_reset",
//   params: [
//     {
//       forking: {
//         jsonRpcUrl: "https://eth-mainnet.alchemyapi.io/v2/<key>",
//         blockNumber: 14390000,
//       },
//     },
//   ],
// });

//yarn test ./tests/FlyEth --network localhost

const WETH9address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const AlchemistV2address = alchemistV2Abi.address
const curveFactoryAddress = '0xB9fC157394Af804a3578134A6585C0dc9cc990d4'
const alEthPoolAddress = '0xC4C319E2D4d66CcA4464C0c2B32c9Bd23ebe784e'
// const largeWETHaccount = '0x2feb1512183545f48f6b9c5b4ebfcaf49cfca6f3'

describe("FlyEth unit", function () {

    let flyEthContract: FlyEthereum;
    let accounts: any[];
  
    this.beforeEach(async function () {

        accounts = await hre.ethers.getSigners();

        const flyEthFactory = new ethers.ContractFactory(
          flyEthJson.abi,
          flyEthJson.bytecode,
          accounts[0]
        );

        flyEthContract = await flyEthFactory.deploy(WETH9address) as FlyEthereum;

        await flyEthContract.deployed();
    });
  
    describe("when the contract is deployed", function () {

      it("was initialized with WETH9 contract as underlying asset", async function () {
          expect(await flyEthContract.asset()).to.eq(WETH9address);
      });
  
      it("was initialized with admin roles set to to deployer address", async function () {
        expect(await flyEthContract.hasRole(await flyEthContract.DEFAULT_ADMIN_ROLE(), accounts[0].address)).to.eq(true);
        expect(await flyEthContract.hasRole(await flyEthContract.MINTER_ROLE(), accounts[0].address)).to.eq(true);
        expect(await flyEthContract.hasRole(await flyEthContract.PAUSER_ROLE(), accounts[0].address)).to.eq(true);
      });

    });
});

// describe("AlchemistV2 integration", function () {

//   let AlchemistV2: Contract;
//   let weth9Contract: Contract;
//   let flyEthContract: FlyEthereum;
//   let alETH: Contract;
//   let yvWETH: Contract;
//   let accounts: any[];

//   this.beforeAll(async function () {

//       accounts = await hre.ethers.getSigners();

//       weth9Contract = new ethers.Contract(WETH9address, wethAbi, accounts[2]) as ERC20;

//       AlchemistV2 = new ethers.Contract(AlchemistV2address, alchemistV2Abi.abi, accounts[2]) as ERC20;

//       // Deploy FlyEthereum Contract
//       const flyEthFactory = new ethers.ContractFactory(
//         flyEthJson.abi,
//         flyEthJson.bytecode,
//         accounts[0]
//       );

//       flyEthContract = await flyEthFactory.deploy(WETH9address) as FlyEthereum;

//       await flyEthContract.deployed();

//       alETH = new ethers.Contract(await flyEthContract.ALCHEMIST_DEBT_TOKEN_CONTRACT(), alEthAbi, accounts[2]) as ERC20;

//       yvWETH = new ethers.Contract(await flyEthContract.ALCHEMIST_YIELD_TOKEN_CONTRACT(), yvWethAbi, accounts[2]) as ERC20;

//       const overrides = {value : hre.ethers.utils.parseEther('400.0')};

//       await weth9Contract.deposit(overrides);
//   });

//   describe("contract interaction", function () {

//     it("checks AlchemistV2 assets used by FlyEth", async function () {
//       expect(await AlchemistV2.debtToken()).to.eq(await flyEthContract.ALCHEMIST_DEBT_TOKEN_CONTRACT());
//       expect((await AlchemistV2.getSupportedUnderlyingTokens())[0]).to.eq(await flyEthContract.asset());
//       expect((await AlchemistV2.getSupportedYieldTokens())[0]).to.eq(await flyEthContract.ALCHEMIST_YIELD_TOKEN_CONTRACT());
//     });

//     it("allows 400 WETH spending limit for AlchemistV2", async function () {
//       const amount = hre.ethers.utils.parseEther('400.0');
//       await weth9Contract.connect(accounts[2]).approve(AlchemistV2.address, amount);
//       expect(await weth9Contract.connect(accounts[2]).allowance(accounts[2].address, AlchemistV2.address)).to.eq(amount)
//     });

//     it("deposits 10 WETH into AlchemistV2", async function () {
//       const yieldToken = await flyEthContract.ALCHEMIST_YIELD_TOKEN_CONTRACT();
//       const amount = hre.ethers.utils.parseEther('10.0');
//       await AlchemistV2.depositUnderlying(yieldToken, amount, accounts[2].address, hre.ethers.utils.parseEther('9.8'));
//       const response = await AlchemistV2.positions(accounts[2].address, yieldToken);
//       console.log(formatEther(response.shares));
//       console.log(await alETH.balanceOf(accounts[2].address));
//       // console.log(await yvWETH.balanceOf(accounts[2].address))
//       console.log(await AlchemistV2.accounts(accounts[2].address));
//       console.log(await AlchemistV2.totalValue(accounts[2].address));
//       await AlchemistV2.approveMint(AlchemistV2.address, amount.mul(ethers.BigNumber.from('400')));
//       console.log(await AlchemistV2.mintAllowance(accounts[2].address, AlchemistV2.address));
//       console.log(await AlchemistV2.getMintLimitInfo());
//       await AlchemistV2.mint((response.shares.div(ethers.BigNumber.from('2')).sub(ethers.BigNumber.from('100'))), accounts[2].address);
//       console.log(await alETH.balanceOf(accounts[2].address));
//       console.log(await AlchemistV2.accounts(accounts[2].address));
//       console.log(await AlchemistV2.positions(accounts[2].address, yieldToken));


//       console.log('round 2')
//       await AlchemistV2.depositUnderlying(yieldToken, amount, accounts[2].address, hre.ethers.utils.parseEther('9.8'));
//       await AlchemistV2.mint((response.shares.div(ethers.BigNumber.from('2')).sub(ethers.BigNumber.from('100'))), accounts[2].address);
//       console.log(await alETH.balanceOf(accounts[2].address));
//       console.log(await AlchemistV2.accounts(accounts[2].address));
//       console.log(await AlchemistV2.positions(accounts[2].address, yieldToken));



//       // await AlchemistV2.deposit(yieldToken, hre.ethers.utils.parseEther('5.0'), accounts[2].address)
//       // console.log(formatEther(response.shares))
//       // console.log(await alETH.balanceOf(accounts[2].address))
//       // console.log(await AlchemistV2.accounts(accounts[0].address))
//       // console.log(await AlchemistV2.totalValue(accounts[0].address))
//     });

//     it("repays alchemix dept", async function () {
//     });

//     it("redeems underlying", async function () {
//     });

//   });

//   describe("FlyEth contract interaction with AlchemistV2", function () {

//     it("redeems underlying", async function () {
//     });

//   });
// });

describe("FlyEth integration", function () {

  let accounts: any[];
  let flyEthContract: FlyEthereum;
  let weth9Contract: Contract;
  let AlchemistV2: Contract;
  let AlchemistWhitelist: Contract;
  let provider: any;
  let initialEthBal0: BigNumber;
  let initialEthBal1: BigNumber;
  let InitialDeposit: BigNumber;
  let initialWethBal0: BigNumber;
  let initialWethBal1: BigNumber;
  // let tx1: any;
  const ZERO = ethers.BigNumber.from('0');


  this.beforeAll(async function () {

    accounts = await hre.ethers.getSigners();
    provider  = await hre.ethers.provider;

    // Deploy FlyEthereum Contract
    const flyEthFactory = new ethers.ContractFactory(
      flyEthJson.abi,
      flyEthJson.bytecode,
      accounts[0]
    );

    flyEthContract = await flyEthFactory.deploy(WETH9address) as FlyEthereum;

    await flyEthContract.deployed();

    // Connect WETH9 contract
    weth9Contract = new ethers.Contract(WETH9address, wethAbi, accounts[0]) as ERC20;

    // Connect Alchemist contract
    AlchemistV2 = new ethers.Contract(AlchemistV2address, alchemistV2Abi.abi, accounts[2]) as ERC20;

    // snapshot of initial balances
    initialEthBal0 = await provider.getBalance(accounts[0].address);
    initialEthBal1 = await provider.getBalance(accounts[1].address);
    initialWethBal0 = await weth9Contract.balanceOf(accounts[0].address);
    initialWethBal1 = await weth9Contract.balanceOf(accounts[1].address);

    // inital 10 WETH deposit for accounts[0] and accounts[1]
    InitialDeposit = hre.ethers.utils.parseEther('10.0');
    const overrides = {value : InitialDeposit};
    await weth9Contract.deposit(overrides);
    await weth9Contract.connect(accounts[1]).deposit(overrides);

    // whitelist FlyETH in AlchemistV2
    const whitelistAbi = [ 
      "function add(address caller)", 
      "function disable()",
      "function getAddresses() external view returns (address[] memory)",
      "function disabled() external view returns (bool)",
      "function isWhitelisted(address account) external view returns (bool)"
    ];

    //whitelist owner
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
    params: ["0x9e2b6378ee8ad2A4A95Fe481d63CAba8FB0EBBF9"],
    });

    const whitelistowner = await ethers.getSigner('0x9e2b6378ee8ad2A4A95Fe481d63CAba8FB0EBBF9');

    // AlchemistV2AlEth witelist contract
    AlchemistWhitelist = new ethers.Contract(await AlchemistV2.whitelist(), whitelistAbi, whitelistowner);

    await AlchemistWhitelist.connect(whitelistowner).add(flyEthContract.address);

    console.log(flyEthContract.address);
    console.log(await AlchemistWhitelist.connect(whitelistowner).getAddresses());
    // console.log(await AlchemistWhitelist.connect(whitelistowner).disabled());
    console.log(await AlchemistWhitelist.connect(whitelistowner).isWhitelisted(flyEthContract.address));


    // await AlchemistWhitelist.connect(whitelistowner).disable();
  });

  describe("verifying initail state", function () {

    it("verifies inital balances", async function () {
      // both accounts ha=ve equal amounts of WETH
      expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq(initialWethBal0.add(InitialDeposit));
      expect(await weth9Contract.balanceOf(accounts[1].address)).to.eq(initialWethBal1.add(InitialDeposit));
      expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq(await weth9Contract.balanceOf(accounts[1].address));
      expect(await flyEthContract.balanceOf(accounts[0].address)).to.eq(ZERO);
      expect(await flyEthContract.balanceOf(accounts[1].address)).to.eq(ZERO);
    });

    it("verifies inital allowances", async function () {
      expect(await weth9Contract.allowance(accounts[0].address, flyEthContract.address)).to.eq(ZERO);
      expect(await weth9Contract.allowance(accounts[1].address, flyEthContract.address)).to.eq(ZERO);
      expect(await weth9Contract.allowance(flyEthContract.address, AlchemistV2.address)).to.eq(ZERO);
    });

    it("verifies whitelist address", async function () {
      expect(await AlchemistV2.whitelist()).to.eq('0xA3dfCcbad1333DC69997Da28C961FF8B2879e653');
    });

    it("verifies whitelist status", async function () {
      expect(await AlchemistWhitelist.isWhitelisted(flyEthContract.address)).to.eq(true);
    });

  });

  describe("interaction with WETH9 contract", function () {

    it("deposits 'amount' ETH from accounts[0] into WETH9 contract (wrap)", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      const overrides = {value : amount};
      await weth9Contract.connect(accounts[0]).deposit(overrides);

      // Account 0 has 10 WETH more than account 1
      expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq((await weth9Contract.balanceOf(accounts[1].address)).add(amount));
    });

    it("checks that a transfer of 'amount' WETH from acount[0] to account[1] adds up", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      // Account 0 sends `amount` to account 1
      await weth9Contract.connect(accounts[0]).transferFrom(
        accounts[0].address, 
        accounts[1].address, 
        amount
      );
      await provider.send("evm_mine", []);

      // Account 1 has 10 WETH more than account 0
      expect(await weth9Contract.balanceOf(accounts[1].address)).to.eq((await weth9Contract.balanceOf(accounts[0].address)).add(amount));
    });

    it("withdraws 'amount' from accounts[1] WETH9 contract (unwrap)", async function () {
      const currentWethBal = await weth9Contract.balanceOf(accounts[1].address);
      const amount = hre.ethers.utils.parseEther('10.0');
      await weth9Contract.connect(accounts[1]).withdraw(amount);

      // Both accounts have equal amounts of WETH
      expect(await weth9Contract.balanceOf(accounts[1].address)).to.eq(currentWethBal.sub(amount)).to.eq(await weth9Contract.balanceOf(accounts[0].address));
    });

  });

  describe("interacting with FlyEth Contract", function () {

    it("verifies that transaction is reverted if spending limit is not approved", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      expect(await weth9Contract.connect(accounts[1]).allowance(accounts[1].address, flyEthContract.address)).to.eq(hre.ethers.utils.parseEther('0.0'));
      await expect(flyEthContract.connect(accounts[1]).deposit(amount, accounts[1].address)).to.be.revertedWith('SafeERC20: low-level call failed')
    });

    it("approves flyEthContract to spend accounts[1] WETH9 balance", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      await weth9Contract.connect(accounts[1]).approve(flyEthContract.address, amount);
      expect(await weth9Contract.connect(accounts[1]).allowance(accounts[1].address, flyEthContract.address)).to.eq(amount)
    });

    it("deposits `amount` WETH from accounts[1] into FlyEth Contract", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      await flyEthContract.connect(accounts[1]).deposit(amount, accounts[1].address);
      await provider.send("evm_mine", []);

      expect(await weth9Contract.balanceOf(accounts[1].address)).to.eq((await weth9Contract.balanceOf(accounts[0].address)).sub(amount));
      expect(await flyEthContract.balanceOf(accounts[1].address)).to.eq(amount);
      expect(await weth9Contract.balanceOf(flyEthContract.address)).to.eq(amount);
      expect(await weth9Contract.allowance(flyEthContract.address, AlchemistV2.address)).to.eq(amount);
    });

    // it("deposits `amount` WETH from flyEth into AlchemistV2", async function () {
    //   const amount = hre.ethers.utils.parseEther('5.0');
    //   // await flyEthContract.connect(accounts[1]).deposit(amount, accounts[1].address);
    //   // await provider.send("evm_mine", []);
    //   const yieldToken = await flyEthContract.ALCHEMIST_YIELD_TOKEN_CONTRACT();
    //   await AlchemistV2.depositUnderlying(yieldToken, amount, accounts[2].address, hre.ethers.utils.parseEther('9.8'));
    //   const response = await AlchemistV2.positions(accounts[2].address, yieldToken);
    //   console.log(formatEther(response.shares));



    //   // Account 1 has 10 WETH less than account 0, and account 1 has 10 FlyEth
    //   // expect(await weth9Contract.balanceOf(accounts[1].address)).to.eq((await weth9Contract.balanceOf(accounts[0].address)).sub(amount));
    //   // expect(await flyEthContract.balanceOf(accounts[1].address)).to.eq(amount);
    //   // expect(await weth9Contract.balanceOf(flyEthContract.address)).to.eq(amount);
    //   // expect(await weth9Contract.allowance(flyEthContract.address, AlchemistV2.address)).to.eq(amount);
    // });


    it("sends 10 FlyEth from account 1 to account 0", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      await flyEthContract.connect(accounts[1]).transfer(accounts[0].address, amount);
      await provider.send("evm_mine", []);
      
      // Account 1 has 10 WETH less than account 0, and account 0 has 10 FlyEth
      expect(await weth9Contract.balanceOf(accounts[1].address)).to.eq((await weth9Contract.balanceOf(accounts[0].address)).sub(amount));
      expect(await flyEthContract.balanceOf(accounts[0].address)).to.eq(amount);
      expect(await flyEthContract.balanceOf(accounts[1].address)).to.eq(ZERO);
    });

    it("redeems 10 FlyEth from account 0 for 10 WETH)", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      await flyEthContract.connect(accounts[0]).withdraw(amount, accounts[0].address, accounts[0].address);
      await provider.send("evm_mine", []);

      // Account 1 has 20 WETH less than account 0, and account 0 and 1 have 0 FlyEth
      expect(await weth9Contract.balanceOf(accounts[1].address)).to.eq((await weth9Contract.balanceOf(accounts[0].address)).sub(amount.mul(ethers.BigNumber.from('2'))));
      expect(await flyEthContract.balanceOf(accounts[0].address)).to.eq(ZERO);
      expect(await flyEthContract.balanceOf(accounts[1].address)).to.eq(ZERO);
    });

    it("sends back 10 WETH to account 1 to equalize balances (needed to run tests repeatedly without clearing chain state)", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      await weth9Contract.connect(accounts[0]).transferFrom(
        accounts[0].address, 
        accounts[1].address, 
        amount
      );
      await provider.send("evm_mine", []);

      // Account 1 and 0 have same WETH balance
      expect(await weth9Contract.balanceOf(accounts[1].address)).to.eq(await weth9Contract.balanceOf(accounts[0].address));
    });

  });
});

describe("Curve protocol interaction", function () {

  let flyEthContract: FlyEthereum;
  let accounts: any[];
  let curveFactory: Contract;
  let curveAlEthPool: Contract;
  let alEthAddress: string;
  let alETH: Contract;
  let provider: any;
  let dy: BigNumber;

  this.beforeAll(async function () {
    accounts = await hre.ethers.getSigners();
    provider = hre.ethers.provider;

    const flyEthFactory = new ethers.ContractFactory(
      flyEthJson.abi,
      flyEthJson.bytecode,
      accounts[3]
    );

    flyEthContract = await flyEthFactory.deploy(WETH9address) as FlyEthereum;

    await flyEthContract.deployed();

    curveFactory = new ethers.Contract(curveFactoryAddress, curveFactoryAbi, accounts[3])
    curveAlEthPool = new ethers.Contract(alEthPoolAddress, curveAlEthPoolAbi, accounts[3])

    alEthAddress = await flyEthContract.ALCHEMIST_DEBT_TOKEN_CONTRACT();

    alETH = new ethers.Contract(alEthAddress, alEthAbi, accounts[2]) as ERC20;

  });

  describe("getting information about pools from factory", function () {

    it("verifies alEth pool address", async function () {
      const alEthPool = await curveFactory.find_pool_for_coins(alEthAddress, '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE');
      expect(alEthPool).to.eq(alEthPoolAddress);
    });

  });

  describe("swapping alEth", function () {

    it("checks dy for a 10 alEth swap", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      // accounts[2] has alEth
      const coins: Array<string> = await curveFactory.get_coins(alEthPoolAddress);
      const indexAlEth = coins.findIndex(coin => coin === alEthAddress);
      const indexEth = coins.findIndex(coin => coin === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE');
      dy = await curveAlEthPool.get_dy(indexAlEth, indexEth, amount);
      expect(dy).to.be.above(hre.ethers.utils.parseEther('9.2'))
    });

    it("swaps alEth for Eth", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      const alEthDeposit = hre.ethers.utils.parseEther('9.6');
      const min_dy = hre.ethers.utils.parseEther('9.28');

      // make sure account has enough alEth
      expect(await alETH.balanceOf(accounts[2].address)).to.be.above(alEthDeposit);

      // approve alEth
      await alETH.connect(accounts[2]).approve(curveAlEthPool.address, amount);
      expect(await alETH.connect(accounts[2]).allowance(accounts[2].address, curveAlEthPool.address)).to.eq(amount)

      // exchange
      const ethBalBeforeExchange = await provider.getBalance(accounts[2].address);
      const coins: Array<string> = await curveFactory.get_coins(alEthPoolAddress);
      const indexAlEth = coins.findIndex(coin => coin === alEthAddress);
      const indexEth = coins.findIndex(coin => coin === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE');
      const tx = await (await curveAlEthPool.connect(accounts[2]).exchange(indexAlEth, indexEth, alEthDeposit, min_dy)).wait();
      const ethBalAfterExchange = await provider.getBalance(accounts[2].address);

      // get event
      const event = tx.events.find((event: Record<string,any>) => event.event === 'TokenExchange');
      const [sender, tokenIndex1, value1, tokenIndex2, value2] = event.args;

      expect(tokenIndex1).to.eq(indexAlEth);
      expect(value1).to.eq(alEthDeposit);
      expect(tokenIndex2).to.eq(indexEth);

      const diffEth = (ethBalAfterExchange.sub(ethBalBeforeExchange)).add(tx.cumulativeGasUsed.mul(tx.effectiveGasPrice))
      expect(value2).to.eq(diffEth);
    });

    it("swaps Eth for alEth", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      const min_dy = hre.ethers.utils.parseEther('9.28');

      // exchange
      const coins: Array<string> = await curveFactory.get_coins(alEthPoolAddress);
      const alEthBalBeforeExchange = await alETH.balanceOf(accounts[2].address);
      const indexAlEth = coins.findIndex(coin => coin === alEthAddress);
      const indexEth = coins.findIndex(coin => coin === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE');
      const tx = await (await curveAlEthPool.connect(accounts[2]).exchange(indexEth, indexAlEth, amount, min_dy, {value: amount})).wait();
      const alEthBalAfterExchange = await alETH.balanceOf(accounts[2].address);

      // get event
      const event = tx.events.find((event: Record<string,any>) => event.event === 'TokenExchange');
      const [sender, tokenIndex1, value1, tokenIndex2, value2] = event.args;

      expect(tokenIndex1).to.eq(indexEth);
      expect(value1).to.eq(amount);
      expect(tokenIndex2).to.eq(indexAlEth);

      const diffAlEth = alEthBalAfterExchange.sub(alEthBalBeforeExchange)
      expect(value2).to.eq(diffAlEth);


    });

  });
});


describe("Folding", function () {

  // let flyEthContract: FlyEthereum;
  // let accounts: any[];

  this.beforeEach(async function () {
  });

  describe("deposit weth into FlyEth", function () {

    it("deposits into FlyEth Contract", async function () {
    });
  });

  describe("take an alchemix loan", function () {

    it("deposits into Alchemist V2", async function () {
    });
  });

  describe("swap alEth for WETH", function () {

    it("swap on curve protocol", async function () {
    });
  });

  describe("take an alchemix loan", function () {

    it("deposits into Alchemist V2", async function () {
    });
  });

  describe("revert (unfold)", function () {

    it("retrieves original WETH deposit (minus fees)", async function () {
    });
  });

});