import dotenv from "dotenv";

import wethAbi from "./abi/weth9abi.json";
import alchemistV2Abi from "./abi/alchemistV2Abi.json";
import alEthAbi from "./abi/alEthAbi.json";
import curveFactoryAbi from "./abi/curve-factory.json"; 
import curveAlEthPoolAbi from "./abi/curveAlEthPoolAbi.json"
import flyEthJson from "../artifacts/contracts/FlyEthereum.sol/FlyEthereum.json";
import mockFlyEthereumJson from "../artifacts/contracts/mockFlyEthereum.sol/mockFlyEthereum.json";
// import mockAlchemistJson from "../artifacts/contracts/mockAlchemist.sol/mockAlchemist.json";
// import mockCurvePoolJson from "../artifacts/contracts/mockCurvePool.sol/mockCurvePool.json";
// import mockFlyEthJson from "../contracts/FlyEthereumFix.json"


import hre, { ethers, waffle } from 'hardhat'
import { ERC20, FlyEthereum, MockFlyEthereum } from "../typechain";
import { expect } from "chai";
import { Contract } from '@ethersproject/contracts';
import { BigNumber } from '@ethersproject/bignumber';
// import { formatEther } from '@ethersproject/units';
// import { ContractJSON } from "ethereum-waffle/dist/esm/ContractJSON";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import fs from 'fs';

dotenv.config()

//yarn test ./tests/FlyEth --network localhost

const alchemyRpcProviderUrl = `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`;
const forkBlock = 15850450;
const WETH9address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const AlchemistV2address = alchemistV2Abi.address;
const curveFactoryAddress = '0xB9fC157394Af804a3578134A6585C0dc9cc990d4';
const alEthPoolAddress = '0xC4C319E2D4d66CcA4464C0c2B32c9Bd23ebe784e';
const largeAlEthHolder = '0x500A4f1280a0B63f47862d658b6C335Cc939aaED';
const ZERO = ethers.BigNumber.from('0');

// const largeWETHaccount = '0x2feb1512183545f48f6b9c5b4ebfcaf49cfca6f3'

    // yvWETH = new ethers.Contract(await flyEthContract.ALCHEMIST_YIELD_TOKEN_CONTRACT(), yvWethAbi, accounts[2]) as ERC20;
          // await accounts[0].sendTransaction({
      //   to: flyEthContract.address,
      //   value: ethers.utils.parseEther("10.0"),
      // });


const wrapEth = async (contract: Contract, amount: BigNumber, spender: SignerWithAddress) => {
  const tx = await contract.connect(spender).deposit({value: amount});
  return tx;
}

const getAlEth = async (contract: Contract, amount: BigNumber, receiver: string) => {
  //impersonate whitelist owner
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [largeAlEthHolder],
  });

  console.log(`alEth balance of large account ${(await contract.connect(largeAlEthHolder).balanceOf(largeAlEthHolder))}`);
  console.log(`alEth balance of receiver before tx ${(await contract.connect(largeAlEthHolder).balanceOf(receiver))}`);

  const alEthHolder = await ethers.getSigner(largeAlEthHolder);
  (await contract.connect(alEthHolder).transfer(
    receiver, 
    amount
  )).wait();
  await hre.ethers.provider.send("evm_mine", []);
  console.log(`alEth balance of receiver after tx ${(await contract.connect(largeAlEthHolder).balanceOf(receiver))}`);
}

const resetFork = async () => {
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: alchemyRpcProviderUrl,
          blockNumber: forkBlock,
        },
      },
    ],
  });
}

xdescribe("FlyEth unit", function () {

    let flyEthContract: FlyEthereum;
    let accounts: any[];
  
    this.beforeEach(async function () {

        await resetFork();

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

xdescribe("WETH 9 integration", function () {

  let accounts: any[];
  let weth9Contract: Contract;
  let provider: any;

  this.beforeEach(async function () {

    await resetFork();

    accounts = await hre.ethers.getSigners();
    provider  = hre.ethers.provider;

    // Connect WETH9 contract
    weth9Contract = new ethers.Contract(WETH9address, wethAbi, accounts[0]) as ERC20;

  });

  describe("verifying initail state", function () {

    it("verifies initial eth balance", async function () {
      expect(await provider.getBalance(accounts[0].address)).to.eq(hre.ethers.utils.parseEther('10000.0'));
      expect(await provider.getBalance(accounts[1].address)).to.eq(hre.ethers.utils.parseEther('10000.0'));
    });

    it("verifies balance initial weth balance", async function () {
      expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq(ZERO);
      expect(await weth9Contract.balanceOf(accounts[1].address)).to.eq(ZERO);
    });
  });

  describe("interaction with WETH9 contract", function () {

    it("makes a deposit into weth contract (wrap)", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      await wrapEth(weth9Contract, amount, accounts[0]);

      expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq(amount);
    });

    it("makes a weth transfer from accounts[0] to accounts[1]", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      await wrapEth(weth9Contract, amount, accounts[0]);

      await weth9Contract.connect(accounts[0]).transferFrom(
        accounts[0].address, 
        accounts[1].address, 
        amount
      );
      await provider.send("evm_mine", []);

      expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq(ZERO);
      expect(await weth9Contract.balanceOf(accounts[1].address)).to.eq(amount);
    });

    it("makes a withdrawal from weth contract (unwrap)", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      await wrapEth(weth9Contract, amount, accounts[0]);

      expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq(amount);

      await weth9Contract.connect(accounts[0]).withdraw(amount);

      expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq(ZERO);
    });

  });
});

xdescribe("Curve protocol integration", function () {

  let flyEthContract: FlyEthereum;
  let accounts: any[];
  let curveFactory: Contract;
  let curveAlEthPool: Contract;
  let alEthAddress: string;
  let alETH: Contract;
  let provider: any;
  let dy: BigNumber;
  const ZERO_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

  this.beforeEach(async function () {

    await resetFork();

    accounts = await hre.ethers.getSigners();
    provider = hre.ethers.provider;

    const flyEthFactory = new ethers.ContractFactory(
      flyEthJson.abi,
      flyEthJson.bytecode,
      accounts[3]
    );

    flyEthContract = await flyEthFactory.deploy(WETH9address) as FlyEthereum;

    await flyEthContract.deployed();

    curveFactory = new ethers.Contract(curveFactoryAddress, curveFactoryAbi, accounts[0])
    curveAlEthPool = new ethers.Contract(alEthPoolAddress, curveAlEthPoolAbi, accounts[0])

    alEthAddress = await flyEthContract.ALCHEMIST_DEBT_TOKEN_CONTRACT();

    alETH = new ethers.Contract(alEthAddress, alEthAbi, accounts[0]) as ERC20;

  });

  describe("verifying initail state", function () {

    describe("verifies inital balances", function () {

      it("verifies initial eth balance", async function () {
        expect(await provider.getBalance(accounts[0].address)).to.eq(hre.ethers.utils.parseEther('10000.0'));
      });

      it("verifies initial weth balance", async function () {
        expect(await alETH.balanceOf(accounts[0].address)).to.eq(ZERO);
      });

    });
  });

  describe("getting information about pools from factory", function () {

    it("verifies alEth pool address", async function () {
      const alEthPool = await curveFactory.find_pool_for_coins(alEthAddress, ZERO_ADDRESS);
      expect(alEthPool).to.eq(alEthPoolAddress);
    });

  });

  describe("interacting with alEth pool", function () {

    it("checks dy for a 10 alEth swap", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      const coins: Array<string> = await curveFactory.get_coins(alEthPoolAddress);
      const indexAlEth = coins.findIndex(coin => coin === alEthAddress);
      const indexEth = coins.findIndex(coin => coin === ZERO_ADDRESS);
      dy = await curveAlEthPool.get_dy(indexAlEth, indexEth, amount);
      expect(dy).to.be.gte((amount.div(ethers.BigNumber.from('100'))).mul(ethers.BigNumber.from('96')))
    });

    it("swaps alEth for Eth", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      const min_dy = (amount.div(ethers.BigNumber.from('100'))).mul(ethers.BigNumber.from('96'));

      // get some alEth
      await getAlEth(alETH, amount, accounts[0].address);
      expect(await alETH.balanceOf(accounts[0].address)).to.be.gte(amount);
      console.log('account has alEth balance');

      // approve alEth
      await alETH.connect(accounts[0]).approve(curveAlEthPool.address, amount);
      expect(await alETH.connect(accounts[0]).allowance(accounts[0].address, curveAlEthPool.address)).to.eq(amount)
      console.log('alEth has been approved');

      // exchange
      const ethBalBeforeExchange = await provider.getBalance(accounts[0].address);
      const coins: Array<string> = await curveFactory.get_coins(alEthPoolAddress);
      const indexAlEth = coins.findIndex(coin => coin === alEthAddress);
      const indexEth = coins.findIndex(coin => coin === ZERO_ADDRESS);
      const tx = await (await curveAlEthPool.connect(accounts[0]).exchange(indexAlEth, indexEth, amount, min_dy)).wait();
      const ethBalAfterExchange = await provider.getBalance(accounts[0].address);
      const diffEth = (ethBalAfterExchange.sub(ethBalBeforeExchange)).add(tx.cumulativeGasUsed.mul(tx.effectiveGasPrice))

      // get event
      const event = tx.events.find((event: Record<string,any>) => event.event === 'TokenExchange');
      const [sender, tokenIndex1, value1, tokenIndex2, value2] = event.args;

      expect(tokenIndex1).to.eq(indexAlEth);
      expect(value1).to.eq(amount);
      expect(tokenIndex2).to.eq(indexEth);
      expect(value2).to.eq(diffEth);
    });

    it("swaps Eth for alEth", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      const min_dy = (amount.div(ethers.BigNumber.from('100'))).mul(ethers.BigNumber.from('96'));

      // exchange
      const coins: Array<string> = await curveFactory.get_coins(alEthPoolAddress);
      const alEthBalBeforeExchange = await alETH.balanceOf(accounts[0].address);
      const indexAlEth = coins.findIndex(coin => coin === alEthAddress);
      const indexEth = coins.findIndex(coin => coin === ZERO_ADDRESS);
      const tx = await (await curveAlEthPool.connect(accounts[0]).exchange(indexEth, indexAlEth, amount, min_dy, {value: amount})).wait();
      const alEthBalAfterExchange = await alETH.balanceOf(accounts[0].address);
      const diffAlEth = alEthBalAfterExchange.sub(alEthBalBeforeExchange)

      // get event
      const event = tx.events.find((event: Record<string,any>) => event.event === 'TokenExchange');
      const [sender, tokenIndex1, value1, tokenIndex2, value2] = event.args;

      expect(tokenIndex1).to.eq(indexEth);
      expect(value1).to.eq(amount);
      expect(tokenIndex2).to.eq(indexAlEth);
      expect(value2).to.eq(diffAlEth);
    });
  });
});

xdescribe("AlchemistV2 integration", function () {

  let AlchemistV2: Contract;
  let weth9Contract: Contract;
  let flyEthContract: FlyEthereum;
  let alEth: Contract;
  let accounts: any[];
  let provider: any;

  this.beforeEach(async function () {

    await resetFork()

    accounts = await hre.ethers.getSigners();
    provider = hre.ethers.provider;

    weth9Contract = new ethers.Contract(WETH9address, wethAbi, accounts[0]) as ERC20;

    AlchemistV2 = new ethers.Contract(AlchemistV2address, alchemistV2Abi.abi, accounts[0]) as ERC20;

    // Deploy FlyEthereum Contract
    const flyEthFactory = new ethers.ContractFactory(
      flyEthJson.abi,
      flyEthJson.bytecode,
      accounts[3]
    );

    flyEthContract = await flyEthFactory.deploy(WETH9address) as FlyEthereum;

    await flyEthContract.deployed();

    alEth = new ethers.Contract(await flyEthContract.ALCHEMIST_DEBT_TOKEN_CONTRACT(), alEthAbi, accounts[0]) as ERC20;

    // yvWETH = new ethers.Contract(await flyEthContract.ALCHEMIST_YIELD_TOKEN_CONTRACT(), yvWethAbi, accounts[0]) as ERC20;
  });

  describe("verifying initail state", function () {

    describe("verifies inital balances", function () {

      it("verifies initial eth balance", async function () {
        expect(await provider.getBalance(accounts[0].address)).to.eq(hre.ethers.utils.parseEther('10000.0'));
        // expect(await provider.getBalance(accounts[1].address)).to.eq(hre.ethers.utils.parseEther('10000.0'));
      });

      it("verifies initial weth balance", async function () {
        expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq(ZERO);
        // expect(await weth9Contract.balanceOf(accounts[1].address)).to.eq(ZERO);
      });

      it("verifies initial alEth balance", async function () {
        expect(await alEth.balanceOf(accounts[0].address)).to.eq(ZERO);
      });

    });

    it("verifies inital allowances", async function () {
      expect(await weth9Contract.allowance(accounts[0].address, AlchemistV2.address)).to.eq(ZERO);
    });
  });

  describe("contract interaction", function () {

    const alchemixDepositUnderlying = async (amount: BigNumber, min_dyPerc = 98) => {
      await weth9Contract.connect(accounts[0]).approve(AlchemistV2.address, amount);
      const yieldToken = await flyEthContract.ALCHEMIST_YIELD_TOKEN_CONTRACT();
      const min_dy = (amount.div(ethers.BigNumber.from('100'))).mul(ethers.BigNumber.from(min_dyPerc.toString()));
      const tx = (await AlchemistV2.depositUnderlying(yieldToken, amount, accounts[0].address, min_dy)).wait();
      return {min_dy, yieldToken, tx};
    }

    const alchemixTakeAlEthLoan = async (amount: BigNumber, positions: Record<string,any>) => {
      await AlchemistV2.approveMint(AlchemistV2.address, amount);
      const maxMintAmount = positions.shares.div(ethers.BigNumber.from('2')).sub(ethers.BigNumber.from('1'));
      await AlchemistV2.mint(maxMintAmount, accounts[0].address);
      return maxMintAmount;
    }

    it("allows spending of weth for AlchemistV2", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      await weth9Contract.connect(accounts[0]).approve(AlchemistV2.address, amount);

      expect(await weth9Contract.connect(accounts[0]).allowance(accounts[0].address, AlchemistV2.address)).to.eq(amount);
    });

    it("deposits underlying (WETH) into alchemistV2", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      await wrapEth(weth9Contract, amount, accounts[0]);
      const { min_dy, yieldToken } = await alchemixDepositUnderlying(amount);
      const positions = await AlchemistV2.positions(accounts[0].address, yieldToken);

      expect(positions.shares).to.be.gte(min_dy);
      expect(await alEth.balanceOf(accounts[0].address)).to.eq(ZERO);
      expect((await AlchemistV2.accounts(accounts[0].address)).debt).to.eq(ZERO);
      expect((await AlchemistV2.accounts(accounts[0].address)).depositedTokens[0]).to.eq(yieldToken);
      expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq(ZERO);
    });

    it("takes an AlEth loan on alchemist deposit", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      await wrapEth(weth9Contract, amount, accounts[0]);
      const { min_dy, yieldToken } = await alchemixDepositUnderlying(amount);
      const positions = await AlchemistV2.positions(accounts[0].address, yieldToken);

      const maxMintAmount = await alchemixTakeAlEthLoan(amount, positions);

      expect(await AlchemistV2.mintAllowance(accounts[0].address, AlchemistV2.address)).to.eq(amount);
      expect(await alEth.balanceOf(accounts[0].address)).to.eq(maxMintAmount);
      expect((await AlchemistV2.accounts(accounts[0].address)).debt).to.eq(maxMintAmount);
    });

    it("repays debt on alEth loan", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      await wrapEth(weth9Contract, amount, accounts[0]);
      const { min_dy, yieldToken } = await alchemixDepositUnderlying(amount);
      const positions = await AlchemistV2.positions(accounts[0].address, yieldToken);
      const maxMintAmount = await alchemixTakeAlEthLoan(amount, positions);

      await wrapEth(weth9Contract, maxMintAmount, accounts[0]);
      await weth9Contract.connect(accounts[0]).approve(AlchemistV2.address, maxMintAmount);
      await AlchemistV2.repay(weth9Contract.address, maxMintAmount, accounts[0].address);

      expect((await AlchemistV2.accounts(accounts[0].address)).debt).to.eq(ZERO);
      expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq(ZERO);
    });

    it("withdraws underlying", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      await wrapEth(weth9Contract, amount, accounts[0]);
      const { min_dy, yieldToken } = await alchemixDepositUnderlying(amount);
      const positions = await AlchemistV2.positions(accounts[0].address, yieldToken);

      expect(positions.shares).to.be.gte(min_dy);
      expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq(ZERO);

      await AlchemistV2.withdrawUnderlying(yieldToken, positions.shares, accounts[0].address, positions.shares);
      const newPositions = await AlchemistV2.positions(accounts[0].address, yieldToken);
      expect(newPositions.shares).to.eq(ZERO);
      expect(await weth9Contract.balanceOf(accounts[0].address)).to.be.gte(positions.shares);
    });
  });
});

describe("FlyEth integration", function () {

  let accounts: any[];
  let flyEthContract: FlyEthereum;
  let weth9Contract: Contract;
  let AlchemistV2: Contract;
  let alEth: Contract;
  let AlchemistWhitelist: Contract;
  let provider: any;
  let whitelistowner: SignerWithAddress;
  const initialWethBalance = hre.ethers.utils.parseEther('10.0');


  this.beforeEach(async function () {

    await resetFork();

    accounts = await hre.ethers.getSigners();
    provider  = hre.ethers.provider;

    // Deploy FlyEthereum Contract
    const flyEthFactory = new ethers.ContractFactory(
      flyEthJson.abi,
      flyEthJson.bytecode,
      accounts[3]
    );

    flyEthContract = await flyEthFactory.deploy(WETH9address) as FlyEthereum;

    await flyEthContract.deployed();

    // Connect WETH9 contract
    weth9Contract = new ethers.Contract(WETH9address, wethAbi, accounts[0]) as ERC20;

    // Connect Alchemist contract
    AlchemistV2 = new ethers.Contract(AlchemistV2address, alchemistV2Abi.abi, accounts[0]) as ERC20;

    alEth = new ethers.Contract(await flyEthContract.ALCHEMIST_DEBT_TOKEN_CONTRACT(), alEthAbi, accounts[0]) as ERC20;

    // whitelist FlyETH in AlchemistV2
    const whitelistAbi = [ 
      "function add(address caller)", 
      "function isWhitelisted(address account) external view returns (bool)",
    ];

    //impersonate whitelist owner
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x9e2b6378ee8ad2A4A95Fe481d63CAba8FB0EBBF9"],
    });

    whitelistowner = await ethers.getSigner('0x9e2b6378ee8ad2A4A95Fe481d63CAba8FB0EBBF9');

    // AlchemistV2AlEth witelist contract
    AlchemistWhitelist = new ethers.Contract(await AlchemistV2.whitelist(), whitelistAbi, whitelistowner);

    // Whitelist FlyEth
    await AlchemistWhitelist.connect(whitelistowner).add(flyEthContract.address);

  });

  xdescribe("verifying initail state", function () {

    describe("verifies inital balances", function () {
      it("verifies eth balances", async function () {
        expect(await provider.getBalance(accounts[0].address)).to.eq(hre.ethers.utils.parseEther('10000.0'));
        expect(await provider.getBalance(accounts[1].address)).to.eq(hre.ethers.utils.parseEther('10000.0'));
        expect(await provider.getBalance(flyEthContract.address)).to.eq(ZERO);
      });

      it("verifies weth balances", async function () {
        expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq(ZERO);
        expect(await weth9Contract.balanceOf(accounts[1].address)).to.eq(ZERO);
        expect(await weth9Contract.balanceOf(flyEthContract.address)).to.eq(ZERO);
      });

      it("verifies flyEth balances", async function () {
        expect(await flyEthContract.balanceOf(accounts[0].address)).to.eq(ZERO);
        expect(await flyEthContract.balanceOf(accounts[1].address)).to.eq(ZERO);
      });

      it("verifies alEth balances", async function () {
        expect(await alEth.balanceOf(flyEthContract.address)).to.eq(ZERO);
      });
    });

    it("verifies inital allowances", async function () {
      expect(await weth9Contract.allowance(accounts[0].address, flyEthContract.address)).to.eq(ZERO);
      expect(await weth9Contract.allowance(accounts[1].address, flyEthContract.address)).to.eq(ZERO);
      expect(await weth9Contract.allowance(flyEthContract.address, AlchemistV2.address)).to.eq(ZERO);
    });

    it("verifies AlchemistV2AlEth whitelist address", async function () {
      expect(await AlchemistV2.whitelist()).to.eq('0xA3dfCcbad1333DC69997Da28C961FF8B2879e653');
    });

    it("verifies FlyEthContract is whitelisted", async function () {
      expect(await AlchemistWhitelist.isWhitelisted(flyEthContract.address)).to.eq(true);
    });

    it("verifes flyEth assets", async function () {
      expect(await AlchemistV2.debtToken()).to.eq(await flyEthContract.ALCHEMIST_DEBT_TOKEN_CONTRACT());
      expect((await AlchemistV2.getSupportedUnderlyingTokens())[0]).to.eq(await flyEthContract.asset());
      expect((await AlchemistV2.getSupportedYieldTokens())[0]).to.eq(await flyEthContract.ALCHEMIST_YIELD_TOKEN_CONTRACT());
    });

  });
  
  describe("interacting with FlyEth Contract", function () {

    this.timeout(2000000); 

    xit("verifies that transaction is reverted if weth spending limit is not approved", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      expect(await weth9Contract.connect(accounts[0]).allowance(accounts[1].address, flyEthContract.address)).to.eq(hre.ethers.utils.parseEther('0.0'));
      await expect(flyEthContract.connect(accounts[0]).deposit(amount, accounts[1].address)).to.be.revertedWith('SafeERC20: low-level call failed')
    });

    xit("approves flyEthContract to spend accounts[1] WETH9 balance", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      await weth9Contract.connect(accounts[0]).approve(flyEthContract.address, amount);
      expect(await weth9Contract.connect(accounts[0]).allowance(accounts[1].address, flyEthContract.address)).to.eq(amount)
    });

    xit("deposits underlying (Weth) into flyEthContract", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      const tx1 = await (await wrapEth(weth9Contract, amount, accounts[0])).wait();
      const tx2 = await (await weth9Contract.connect(accounts[0]).approve(flyEthContract.address, amount)).wait();
      const tx3 = await (await flyEthContract.connect(accounts[0]).deposit(amount, accounts[0].address)).wait();
      await provider.send("evm_mine", []);

      const yieldToken = await flyEthContract.ALCHEMIST_YIELD_TOKEN_CONTRACT();
      const min_dy_underlying = (amount.div(ethers.BigNumber.from('100'))).mul(ethers.BigNumber.from((await flyEthContract.ALCHEMIST_MIN_DY_YIELD_TOKEN()).toString()));
      const positions = await AlchemistV2.positions(flyEthContract.address, yieldToken);

      const maxMintAmount = positions.shares.div(ethers.BigNumber.from('2')).sub(ethers.BigNumber.from('1'));
      const min_dy_curve = (maxMintAmount.div(ethers.BigNumber.from('100'))).mul(ethers.BigNumber.from('96'));

      // const totalTxCost = ((tx1.cumulativeGasUsed).mul(tx1.effectiveGasPrice)).add((tx2.cumulativeGasUsed).mul(tx2.effectiveGasPrice)).add((tx3.cumulativeGasUsed).mul(tx3.effectiveGasPrice))
      // console.log(totalTxCost);

      console.log(`shares ${positions.shares}`);
      console.log(`debt ${(await AlchemistV2.accounts(flyEthContract.address)).debt}`)
      console.log(`total value ${await AlchemistV2.totalValue(flyEthContract.address)}`);
      console.log(`total assets ${await flyEthContract.totalAssets()}`);
      console.log(`flyEth bal ${await flyEthContract.balanceOf(accounts[0].address)}`);


      const AcctPosition = await flyEthContract.getAccountPosition(accounts[0].address);
      console.log(`account position ${AcctPosition}`);
      console.log(`ledger entry ${await flyEthContract.getLedgerEntry(AcctPosition.ledgerIndex)}`);

      // account 0 has spent it's weth
      expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq(ZERO);
      // account 0 has `amount` shares in flyEth
      expect(await flyEthContract.balanceOf(accounts[0].address)).to.eq(amount);
      // flyEth has used up it's WETH allowance from account 0
      expect(await weth9Contract.allowance(accounts[0].address, flyEthContract.address)).to.eq(ZERO);
      // AlchemistV2 has used up it's Weth allowance from flyEth
      expect(await weth9Contract.allowance(flyEthContract.address, AlchemistV2.address)).to.eq(ZERO);
      // flyEth has spent it's Weth
      expect(await weth9Contract.balanceOf(flyEthContract.address)).to.be.lt(await flyEthContract.foldingThreshold());
      // flyEth has `dy` debt on Alhemix
      // TODO emit event to get actual dy
      // expect((await AlchemistV2.accounts(flyEthContract.address)).debt).to.eq(maxMintAmount);
      // flyEth has deposited yieldToken in alchemix
      expect((await AlchemistV2.accounts(flyEthContract.address)).depositedTokens[0]).to.eq(yieldToken);    
      // flyEth's shares on alchemix is at least min_dy
      expect(positions.shares).to.be.gte(min_dy_underlying);
      // flyEth has 0 ether
      // TODO emit event to get actual dy
      // expect(await provider.getBalance(flyEthContract.address)).to.eq(dy_curve);
      expect(await provider.getBalance(flyEthContract.address)).to.eq(ZERO);
    });

    it("tests flyEth credit accounting", async function () {
      const amount1 = hre.ethers.utils.parseEther('10.0');
      const amount2 = hre.ethers.utils.parseEther('90.0');
      const amount3 = hre.ethers.utils.parseEther('100.0');
      await wrapEth(weth9Contract, amount1, accounts[0]);
      await wrapEth(weth9Contract, amount2, accounts[1]);
      await wrapEth(weth9Contract, amount3, accounts[2]);

      // deploy flyEth mock contract
      const fethFact = new ethers.ContractFactory(
        mockFlyEthereumJson.abi,
        mockFlyEthereumJson.bytecode,
        accounts[3]
      );

      flyEthContract = await fethFact.deploy(weth9Contract.address) as MockFlyEthereum;
      await flyEthContract.deployed();

      // account 0 makes a deposit
      await weth9Contract.connect(accounts[0]).approve(flyEthContract.address, amount1);
      const tx0 = await (await flyEthContract.connect(accounts[0]).deposit(amount1, accounts[0].address)).wait();

      console.log('Events');
      for (const evt of tx0.events!) {
        if (evt.event === 'ContractDebt') {
            console.log(`ContractDebt ${evt.args}`);
        }

        if (evt.event === 'Fold') {
          console.log(`Fold ${evt.args}`);
        }
      }

      console.log(`total assets ${await flyEthContract.totalAssets()}`);
      console.log(`flyEth total supply ${await flyEthContract.totalSupply()}`);
      console.log(`flyEth bal 0 ${await flyEthContract.balanceOf(accounts[0].address)}`);
      const AcctPosition0 = await flyEthContract.getAccountPosition(accounts[0].address);
      console.log(`account position 0 ${AcctPosition0}`);
      console.log(`ledger entry ${await flyEthContract.getLedgerEntry(AcctPosition0.ledgerIndex)}`);

      // set debt reduction to 10%
      await (flyEthContract as MockFlyEthereum).setMock(true, ethers.BigNumber.from('10'));

      // account 1 makes a deposit
      await weth9Contract.connect(accounts[1]).approve(flyEthContract.address, amount1);

      const tx1 = await (await flyEthContract.connect(accounts[1]).deposit(amount1, accounts[1].address)).wait();
      await provider.send("evm_mine", []);
      
      console.log('Events');
      for (const evt of tx1.events!) {
        if (evt.event === 'ContractDebt') {
            console.log(`ContractDebt ${evt.args}`);
        }

        if (evt.event === 'Fold') {
          console.log(`Fold ${evt.args}`);
        }
      }

      console.log(`total assets ${await flyEthContract.totalAssets()}`);
      console.log(`flyEth total supply ${await flyEthContract.totalSupply()}`);
      console.log(`flyEth bal 1 ${await flyEthContract.balanceOf(accounts[1].address)}`);

      const AcctPosition1 = await flyEthContract.getAccountPosition(accounts[1].address);
      console.log(`account position 1 ${AcctPosition1}`);
      console.log(`ledger entry ${await flyEthContract.getLedgerEntry(AcctPosition1.ledgerIndex)}`);


      // account 0 makes a second deposit
      await wrapEth(weth9Contract, amount1, accounts[0]);
      await weth9Contract.connect(accounts[0]).approve(flyEthContract.address, amount1);
      const tx3 = await (await flyEthContract.connect(accounts[0]).deposit(amount1, accounts[0].address)).wait();

      console.log('Events');
      for (const evt of tx3.events!) {
        if (evt.event === 'ContractDebt') {
            console.log(`ContractDebt ${evt.args}`);
        }

        if (evt.event === 'Fold') {
          console.log(`Fold ${evt.args}`);
        }
      }

      console.log(`total assets ${await flyEthContract.totalAssets()}`);
      console.log(`flyEth total supply ${await flyEthContract.totalSupply()}`);
      console.log(`flyEth bal 0 ${await flyEthContract.balanceOf(accounts[0].address)}`);
      const AcctPosition01 = await flyEthContract.getAccountPosition(accounts[0].address);
      console.log(`account position 0 ${AcctPosition01}`);
      console.log(`ledger entry ${await flyEthContract.getLedgerEntry(AcctPosition01.ledgerIndex)}`);


      // account 1 makes a second deposit
      await weth9Contract.connect(accounts[1]).approve(flyEthContract.address, hre.ethers.utils.parseEther('20.0'));

      const tx4 = await (await flyEthContract.connect(accounts[1]).deposit(hre.ethers.utils.parseEther('20.0'), accounts[1].address)).wait();
      await provider.send("evm_mine", []);
      
      console.log('Events');
      for (const evt of tx4.events!) {
        if (evt.event === 'ContractDebt') {
            console.log(`ContractDebt ${evt.args}`);
        }

        if (evt.event === 'Fold') {
          console.log(`Fold ${evt.args}`);
        }
      }

      console.log(`total assets ${await flyEthContract.totalAssets()}`);
      console.log(`flyEth total supply ${await flyEthContract.totalSupply()}`);
      console.log(`flyEth bal 1 ${await flyEthContract.balanceOf(accounts[1].address)}`);

      const AcctPosition11 = await flyEthContract.getAccountPosition(accounts[1].address);
      console.log(`account position 1 ${AcctPosition11}`);
      console.log(`ledger entry ${await flyEthContract.getLedgerEntry(AcctPosition11.ledgerIndex)}`);

    });

    xit("sends 10 FlyEth from account 0 to account 1", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      const tx1 = await (await wrapEth(weth9Contract, amount, accounts[0])).wait();
      const tx2 = await (await weth9Contract.connect(accounts[0]).approve(flyEthContract.address, amount)).wait();
      const tx3 = await (await flyEthContract.connect(accounts[0]).deposit(amount, accounts[0].address)).wait();
      await provider.send("evm_mine", []);
      await flyEthContract.connect(accounts[0]).transfer(accounts[1].address, amount);
      await provider.send("evm_mine", []);
      
      expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq(ZERO);
      expect(await flyEthContract.balanceOf(accounts[0].address)).to.eq(ZERO);
      expect(await flyEthContract.balanceOf(accounts[1].address)).to.eq(amount);
    });

    // xit("redeems 10 FlyEth from account 0 for 10 WETH)", async function () {
    //   const amount = hre.ethers.utils.parseEther('10.0');
    //   await flyEthContract.connect(accounts[0]).withdraw(amount, accounts[0].address, accounts[0].address);
    //   await provider.send("evm_mine", []);

    //   // Account 1 has 20 WETH less than account 0, and account 0 and 1 have 0 FlyEth
    //   expect(await weth9Contract.balanceOf(accounts[1].address)).to.eq((await weth9Contract.balanceOf(accounts[0].address)).sub(amount.mul(ethers.BigNumber.from('2'))));
    //   expect(await flyEthContract.balanceOf(accounts[0].address)).to.eq(ZERO);
    //   expect(await flyEthContract.balanceOf(accounts[1].address)).to.eq(ZERO);
    // });

  });
});


// async function swapOutConstant(contractJsonToReplace: string, contractAddress: string, newConstantVariable: string, CONSTANT_VARIABLE_TO_REPLACE: string) {

//   const constantToReplaceSubstring = CONSTANT_VARIABLE_TO_REPLACE.substring(2);

//   console.log(constantToReplaceSubstring);

//   await hre.network.provider.send("hardhat_setCode", [
//     contractAddress,
//     JSON.parse(contractJsonToReplace).deployedBytecode.replaceAll(
//       // JSON.parse(contractJsonToReplace.substring(2)).replaceAll(
//       constantToReplaceSubstring.toLowerCase(),
//       newConstantVariable.substring(2).toLowerCase()
//     ),
//   ]);

//   const myContract = await ethers.getContractAt("FlyEthereum", contractAddress);
//   return myContract;
// }

      // return myContract;


      // mock alEth
      // const mockedAlEth = await deployMockContract(accounts[0], JSON.parse(alEthAbi));
      // await mockedAlEth.mock.approve.returns();
      // flyEthContract = await swapOutConstant(JSON.stringify(flyEthJson), flyEthContract.address, mockedAlEth.address, '0x0100546F2cD4C9D97f798fFC9755E47865FF7Ee6');



      // console.log(await mockedAlchemistV2.accounts(flyEthContract.address));
      // {debt: (await AlchemistV2.accounts(flyEthContract.address)).debt.sub(hre.ethers.utils.parseEther('5.0')), }
      // await mockedAlchemistV2.mock.accounts.returns(
      //   (await AlchemistV2.accounts(flyEthContract.address)).debt > 0 ?
      //   hre.ethers.utils.parseEther('5.0') : hre.ethers.utils.parseEther('0.0'), 
      //   ['0x062Bf725dC4cDF947aa79Ca2aaCCD4F385b13b5c']
      // );
      // await mockedAlchemistV2.mock.accounts.returns(
      //   (await AlchemistV2.accounts(flyEthContract.address)).debt > 0 ?
      //   hre.ethers.utils.parseEther('5.0') : hre.ethers.utils.parseEther('0.0'), 
      //   ['0x062Bf725dC4cDF947aa79Ca2aaCCD4F385b13b5c']
      // );
      // swap out contract address in FlyEthereum with address of mock contract


      // const mockedAlchemistV2 = await deployMockContract(accounts[0], alchemistV2Abi.abi);


      // function approveMint(address spender, uint256 amount) external;
      // function mint(uint256 amount, address receiver) external;
      // function depositUnderlying(address _yieldToken, uint256 _amount, address _receipient, uint256 _minimumAmountOut) external returns (uint256 shares);
      // function accounts(address owner) external view returns (int256 debt, address[] calldata lastAccruedWeights);
      // const { deployMockContract, provider } = waffle;
      // mock alchemistV2
      // const mockedAlchemistV2 = await deployMockContract(accounts[0], alchemistV2Abi.abi);
      // await mockedAlchemistV2.mock.accounts.withArgs(accounts[0].address).returns(hre.ethers.utils.parseEther('3.0'), []);
      // await mockedAlchemistV2.mock.accounts.withArgs(accounts[1].address).returns(hre.ethers.utils.parseEther('88.0'), []);
      // await mockedAlchemistV2.mock.accounts.withArgs(accounts[2].address).returns(hre.ethers.utils.parseEther('98.0'), []);
      // await mockedAlchemistV2.mock.approveMint.returns();
      // await mockedAlchemistV2.mock.mint.returns();
      // await mockedAlchemistV2.mock.depositUnderlying.returns(hre.ethers.utils.parseEther('10.0'));
      // flyEthContract = await swapOutConstant(JSON.stringify(flyEthJson), flyEthContract.address, mockedAlchemistV2.address, '0x062Bf725dC4cDF947aa79Ca2aaCCD4F385b13b5c');
      // mock curve
      // interface ICurvePoolAlEth {
      //   function coins(uint256 index) external view returns (address);
      //   function get_dy(int128 indexCoinToSend, int128 indexCoinToReceive, uint256 amount) external view returns (uint256);
      //   function exchange(int128 indexCoinToSend, int128 indexCoinToReceive, uint256 assets, uint256 minDy) external payable returns (uint256);
      // } 

      // const mockedCurvePool = await deployMockContract(accounts[0], JSON.parse(curveAlEthPoolAbi));
      // await mockedCurvePool.mock.coins.returns('0x062Bf725dC4cDF947aa79Ca2aaCCD4F385b13b5c');
      // await mockedCurvePool.mock.get_dy.returns(hre.ethers.utils.parseEther('100.0'));
      // await mockedCurvePool.mock.exchange.returns(hre.ethers.utils.parseEther('1.0'));


            // deploy curve mock
      // const mockedCurvePoolFact = new ethers.ContractFactory(
      //   mockCurvePoolJson.abi,
      //   mockCurvePoolJson.bytecode,
      //   accounts[3]
      // );
      // const mockedCurvePool = await mockedCurvePoolFact.deploy();
      // await mockedCurvePool.deployed();



      // const bytecode1 = JSON.parse(JSON.stringify(flyEthJson)).deployedBytecode.replaceAll(
      //   '0x062Bf725dC4cDF947aa79Ca2aaCCD4F385b13b5c'.substring(2).toLowerCase(),
      //   mockedAlchemistV2.address.substring(2).toLowerCase()
      // );

      // const bytecode2 = bytecode1.replaceAll(
      //   '0xC4C319E2D4d66CcA4464C0c2B32c9Bd23ebe784e'.substring(2).toLowerCase(),
      //   mockedCurvePool.address.substring(2).toLowerCase()
      // )

      // await hre.network.provider.send("hardhat_setCode", [
      //   flyEthContract.address,
      //   bytecode1,
      // ]);

        // await wrapEth(weth9Contract, amount3, accounts[2]);

      // flyEthContract = await ethers.getContractAt("FlyEthereum", flyEthContract.address);




            // // deploy alchemist mock
            // const mockedAlchemistV2Fact = new ethers.ContractFactory(
            //   mockAlchemistJson.abi,
            //   mockAlchemistJson.bytecode,
            //   accounts[3]
            // );
            // const mockedAlchemistV2 = await mockedAlchemistV2Fact.deploy();
            // await mockedAlchemistV2.deployed();
      
            // // deploy curve mock
            // const mockedCurvePoolFact = new ethers.ContractFactory(
            //   mockCurvePoolJson.abi,
            //   mockCurvePoolJson.bytecode,
            //   accounts[3]
            // );
            // const mockedCurvePool = await mockedCurvePoolFact.deploy();
            // await mockedCurvePool.deployed();
      
            // console.log(mockedCurvePool.address);
            // console.log(mockedAlchemistV2.address);
      
            // // deploy flyEth with mock contract
            // const fethFact = new ethers.ContractFactory(
            //   mockFlyEthJson.abi,
            //   mockFlyEthJson.bytecode,
            //   accounts[3]
            // );
      
            // flyEthContract = await fethFact.deploy(weth9Contract.address) as FlyEthereum;
            // await flyEthContract.deployed();
      
            // // weth9Contract.transfer(accounts[2].address, mockedAlchemistV2.address, amount2);
            // weth9Contract.connect(accounts[2]).transferFrom(accounts[2].address, flyEthContract.address, amount2);
            // // AlchemistV2.connect(flyEthContract.address).approveMint('0x062Bf725dC4cDF947aa79Ca2aaCCD4F385b13b5c', amount2);
            // const alEth = new ethers.Contract(await flyEthContract.ALCHEMIST_DEBT_TOKEN_CONTRACT(), alEthAbi, accounts[0]) as ERC20;
            // await getAlEth(alEth, amount2, flyEthContract.address);
            // await accounts[4].sendTransaction({ to: flyEthContract.address, value: ethers.utils.parseUnits("100", "ether").toHexString()});
      
            // console.log(`alEth bal ${await alEth.balanceOf(flyEthContract.address)}`);
            // console.log(`weth bal ${await weth9Contract.balanceOf(flyEthContract.address)}`);
            // console.log(`eth bal ${await provider.getBalance(flyEthContract.address)}`);