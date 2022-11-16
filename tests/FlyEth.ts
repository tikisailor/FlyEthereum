import hre, { ethers } from 'hardhat'
import { ERC20, FlyEthereum } from "../typechain";
import wethAbi from "./weth9abi.json"; // WETH9's ABI
import * as flyEthJson from "../artifacts/contracts/FlyEthereum.sol/FlyEthereum.json";
import { expect } from "chai";
import dotenv from "dotenv";
// import { any } from 'hardhat/internal/core/params/argumentTypes';
import { Contract } from '@ethersproject/contracts';
import { BigNumber } from '@ethersproject/bignumber';
dotenv.config()

//yarn test ./tests/FlyEth --network localhost

const WETH9address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
// const largeWETHaccount = '0x2feb1512183545f48f6b9c5b4ebfcaf49cfca6f3'

describe("FlyEth Contract unit", function () {

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

describe("FlyEth Contract integration", function () {

  let flyEthContract: FlyEthereum;
  let accounts: any[];
  let weth9Contract: Contract;
  let provider: any;
  let initialEthBal0: BigNumber;
  let initialEthBal1: BigNumber;
  let InitialDeposit: BigNumber;
  let initialWethBal0: BigNumber;
  let initialWethBal1: BigNumber;
  let tx1: any;
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

    it("checks that a transfer of 'amount' ETH from acount[0] to account[1] adds up", async function () {
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

    it("withdraws 'amount' ETH from from accounts[1] WETH9 contract (unwrap)", async function () {
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
      await weth9Contract.connect(accounts[1]).approve(flyEthContract.address, amount);
      await flyEthContract.connect(accounts[1]).deposit(amount, accounts[1].address);
      await provider.send("evm_mine", []);

      // Account 1 has 10 WETH less than account 0, and account 1 has 10 FlyEth
      expect(await weth9Contract.balanceOf(accounts[1].address)).to.eq((await weth9Contract.balanceOf(accounts[0].address)).sub(amount));
      expect(await flyEthContract.balanceOf(accounts[1].address)).to.eq(amount);
    });

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

    it("sends back 100 WETH to account 1 to equalize balances (needed to run tests repeatedly without clearing chain state)", async function () {
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
