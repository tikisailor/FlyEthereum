import dotenv from "dotenv";

import wethAbi from "./abi/weth9abi.json";
import alchemistV2Abi from "./abi/alchemistV2Abi.json";
import alEthAbi from "./abi/alEthAbi.json";
import curveFactoryAbi from "./abi/curve-factory.json"; 
import curveAlEthPoolAbi from "./abi/curveAlEthPoolAbi.json"
import flyEthJson from "../artifacts/contracts/FlyEthereum.sol/FlyEthereum.json";

import hre, { ethers } from 'hardhat'
import { ERC20, FlyEthereum } from "../typechain";
import { expect } from "chai";
import { Contract } from '@ethersproject/contracts';
import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

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

  const alEthHolder = await ethers.getSigner(largeAlEthHolder);
  (await contract.connect(alEthHolder).transfer(
    receiver, 
    amount
  )).wait();
  await hre.ethers.provider.send("evm_mine", []);
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

describe("FlyEth unit", function () {

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

describe("WETH 9 integration", function () {

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

describe("Curve protocol integration", function () {

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

      // approve alEth
      await alETH.connect(accounts[0]).approve(curveAlEthPool.address, amount);
      expect(await alETH.connect(accounts[0]).allowance(accounts[0].address, curveAlEthPool.address)).to.eq(amount)

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

describe("AlchemistV2 integration", function () {

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

  describe("verifying initail state", function () {

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

    it("verifies that transaction is reverted if weth spending limit is not approved", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      expect(await weth9Contract.connect(accounts[0]).allowance(accounts[0].address, flyEthContract.address)).to.eq(ZERO);
      await expect(flyEthContract.connect(accounts[0]).deposit(amount, accounts[0].address)).to.be.revertedWith('SafeERC20: low-level call failed')
    });

    it("verifies that transaction is reverted if receiver != msg.sender", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      await weth9Contract.connect(accounts[0]).approve(flyEthContract.address, amount);
      await expect(flyEthContract.connect(accounts[0]).deposit(amount, accounts[1].address)).to.be.revertedWith('You can only deposit to yourself')
    });

    it("approves flyEthContract to spend accounts[0] WETH9 balance", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      await weth9Contract.connect(accounts[0]).approve(flyEthContract.address, amount);
      expect(await weth9Contract.connect(accounts[0]).allowance(accounts[0].address, flyEthContract.address)).to.eq(amount)
    });

    it("deposits underlying (Weth) into flyEthContract", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      const tx1 = await (await wrapEth(weth9Contract, amount, accounts[0])).wait();
      const tx2 = await (await weth9Contract.connect(accounts[0]).approve(flyEthContract.address, amount)).wait();
      const tx3 = await (await flyEthContract.connect(accounts[0]).deposit(amount, accounts[0].address)).wait();
      await provider.send("evm_mine", []);

      const yieldToken = await flyEthContract.ALCHEMIST_YIELD_TOKEN_CONTRACT();
      const min_dy_underlying = (amount.div(ethers.BigNumber.from('100'))).mul(await flyEthContract.ALCHEMIST_MIN_DY_PERCENT());
      const positions = await AlchemistV2.positions(flyEthContract.address, yieldToken);

      // account 0 has spent it's weth
      expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq(ZERO);
      // account 0 has equal amount of flyEth shares as flyEth has Alcemix shares.
      expect(await flyEthContract.balanceOf(accounts[0].address)).to.eq(positions.shares);
      // flyEth has used up it's WETH allowance from account 0
      expect(await weth9Contract.allowance(accounts[0].address, flyEthContract.address)).to.eq(ZERO);
      // AlchemistV2 has used up it's Weth allowance from flyEth
      expect(await weth9Contract.allowance(flyEthContract.address, AlchemistV2.address)).to.eq(ZERO);
      // flyEth has spent it's Weth
      expect(await weth9Contract.balanceOf(flyEthContract.address)).to.be.lt(await flyEthContract.foldingThreshold());
      // flyEth has deposited yieldToken in alchemix
      expect((await AlchemistV2.accounts(flyEthContract.address)).depositedTokens[0]).to.eq(yieldToken); 
      // flyEth has approx. 74% of 'amount' debt on Alhemix - scaled to input of 10 Eth
      const scaledAmountAsNumber = Number(amount.div(ethers.BigNumber.from('10000000000')));
      const scaledDelta = Number((amount.div(ethers.BigNumber.from(100))).mul(ethers.BigNumber.from(6)).div(ethers.BigNumber.from('100000000000')));
      const scaledDebt = Number(((await AlchemistV2.accounts(flyEthContract.address)).debt).div(ethers.BigNumber.from('10000000000')));
      const scaledShares = Number((positions.shares).div(ethers.BigNumber.from('10000000000')));
      expect(scaledDebt).to.approximately(scaledAmountAsNumber*0.74, scaledDelta);
      expect(scaledShares).to.approximately(scaledAmountAsNumber*1.74, scaledDelta);
      // flyEth's shares on alchemix is at least min_dy
      expect(positions.shares).to.be.gte(min_dy_underlying);
      // flyEth has spent it's ether
      expect(await provider.getBalance(flyEthContract.address)).to.eq(ZERO);
    });

    it("sends (`balanceOf` > 0) FlyEth from account 0 to account 1", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      const tx1 = await (await wrapEth(weth9Contract, amount, accounts[0])).wait();
      const tx2 = await (await weth9Contract.connect(accounts[0]).approve(flyEthContract.address, amount)).wait();
      const tx3 = await (await flyEthContract.connect(accounts[0]).deposit(amount, accounts[0].address)).wait();
      await provider.send("evm_mine", []);
      const transferAmount = await flyEthContract.balanceOf(accounts[0].address);

      expect(transferAmount).to.be.gt(ZERO);
      
      await flyEthContract.connect(accounts[0]).transfer(accounts[1].address, transferAmount);
      await provider.send("evm_mine", []);
      
      expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq(ZERO);
      expect(await flyEthContract.balanceOf(accounts[0].address)).to.eq(ZERO);
      expect(await flyEthContract.balanceOf(accounts[1].address)).to.eq(transferAmount);
    });

    it("withdraws FlyEth)", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      const yieldToken = await flyEthContract.ALCHEMIST_YIELD_TOKEN_CONTRACT();

      // two deposits
      await wrapEth(weth9Contract, amount, accounts[0]);
      await weth9Contract.connect(accounts[0]).approve(flyEthContract.address, amount);
      await flyEthContract.connect(accounts[0]).deposit(amount, accounts[0].address);
      await provider.send("evm_mine", []);

      await wrapEth(weth9Contract, amount, accounts[1]);
      await weth9Contract.connect(accounts[1]).approve(flyEthContract.address, amount);
      await flyEthContract.connect(accounts[1]).deposit(amount, accounts[1].address);
      await provider.send("evm_mine", []);

      // both accounts have spent all their weth
      expect(await weth9Contract.balanceOf(accounts[0].address)).to.eq(ZERO);
      expect(await weth9Contract.balanceOf(accounts[1].address)).to.eq(ZERO);

      const positions = await AlchemistV2.positions(flyEthContract.address, yieldToken);
      const debt = (await AlchemistV2.accounts(flyEthContract.address)).debt;


      await flyEthContract.connect(accounts[0]).withdraw(await flyEthContract.balanceOf(accounts[0].address), accounts[0].address, accounts[0].address);
      await provider.send("evm_mine", []);

      const positions2 = await AlchemistV2.positions(flyEthContract.address, yieldToken);

      const debt2 = (await AlchemistV2.accounts(flyEthContract.address)).debt;

      // 0.6% delta - both accounts make a withdrawal
      const scaledAmountAsNumber = Number(amount.div(ethers.BigNumber.from('10000000000')));
      const scaledDelta = Number((amount.div(ethers.BigNumber.from(100))).mul(ethers.BigNumber.from(6)).div(ethers.BigNumber.from('100000000000')));
      const scaledBalance = Number((await weth9Contract.balanceOf(accounts[0].address)).div(ethers.BigNumber.from('10000000000')));
      
      expect(scaledBalance).to.approximately(scaledAmountAsNumber, scaledDelta);

      await flyEthContract.connect(accounts[1]).withdraw(await flyEthContract.balanceOf(accounts[1].address), accounts[1].address, accounts[1].address);
      await provider.send("evm_mine", []);

      const scaledAmountAsNumber2 = Number(amount.div(ethers.BigNumber.from('10000000000')));
      const scaledDelta2 = Number((amount.div(ethers.BigNumber.from(100))).mul(ethers.BigNumber.from(6)).div(ethers.BigNumber.from('100000000000')));
      const scaledBalance2 = Number((await weth9Contract.balanceOf(accounts[1].address)).div(ethers.BigNumber.from('10000000000')));
      
      expect(scaledBalance2).to.approximately(scaledAmountAsNumber2, scaledDelta2);

    });

    xit("withdraws FlyEth - try it with 50 deposits / withdrawals)", async function () {
      const amount = hre.ethers.utils.parseEther('10.0');
      const yieldToken = await flyEthContract.ALCHEMIST_YIELD_TOKEN_CONTRACT();

      const idx = [0, 1, 2, 3, 4];
      const bals = new Map;
      for (let i = 0; i<10; i++) {
        for (const acct of idx) {
          await wrapEth(weth9Contract, amount, accounts[acct]);
          await weth9Contract.connect(accounts[acct]).approve(flyEthContract.address, amount);
          const tx = await (await flyEthContract.connect(accounts[acct]).deposit(amount, accounts[acct].address)).wait();
          await provider.send("evm_mine", []);
          const positions = await AlchemistV2.positions(flyEthContract.address, yieldToken);
          console.log(`Deposit ${positions}`)
          for (const evt of tx.events!) {
            if (evt.event === 'Deposit') {
              const [caller, owner, assets, shares] = evt.args!;
              console.log(`Deposit - assets: ${assets} shares: ${shares}`);
              bals.set(i.toString() + accounts[acct].address, shares)
            }
          }
        }
      }

      for (let i = 0; i<10; i++) {
        for (const acct of idx) {
          const withdrawAmount = bals.get(i.toString() + accounts[acct].address);
          const tx = await (await flyEthContract.connect(accounts[acct]).withdraw(withdrawAmount, accounts[acct].address, accounts[acct].address)).wait();
          await provider.send("evm_mine", []);
          let ast = ethers.BigNumber.from('0');
          for (const evt of tx.events!) {
            if (evt.event === 'Withdraw') {
              const [caller, receiver, owner, assets, shares] = evt.args!;
              console.log(`Withdraw - shares: ${shares} assets: ${assets} `);
              ast = assets;
            }
          }
          // 0.6% delta
          const scaledAmountAsNumber = Number(amount.div(ethers.BigNumber.from('10000000000')));
          const scaledDelta = Number((amount.div(ethers.BigNumber.from(100))).mul(ethers.BigNumber.from(6)).div(ethers.BigNumber.from('100000000000')));
          const scaledBalance = Number(ast.div(ethers.BigNumber.from('10000000000')));
          expect(scaledBalance).to.approximately(scaledAmountAsNumber, scaledDelta);
        }
      }
    });
  });
});