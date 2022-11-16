// yarn run ts-node --files ./scripts/deploy.ts "arg1" "arg2" "arg3

import { ethers } from "ethers";
import * as ballotJson from "../artifacts/contracts/CustomBallot.sol/CustomBallot.json";
import * as tokenJson from "../artifacts/contracts/Token.sol/MyToken.json";
import * as IERC20Votes from "../artifacts/contracts/CustomBallot.sol/IERC20Votes.json";
import { CustomBallot, MyToken } from "../typechain";
import dotenv from "dotenv";
dotenv.config()

const PROPOSALS = ["Yes", "No", "YesAndNo"];

const TOKEN_AMOUNT = 1000000000000000;

function convertStringArrayToBytes32(array: string[]) {
    const bytes32Array = [];

    for (let index = 0; index < array.length; index++) {
      bytes32Array.push(ethers.utils.formatBytes32String(array[index]));
    }

    return bytes32Array;
};

async function vote(ballotContract: ethers.Contract, proposal: number, amount: any) {
    const tx = await ballotContract.vote(proposal, amount);
    console.log('Awaiting confirmation');
    await tx.wait();
    console.log('Successfully voted');
}

async function delegate(tokenContract: ethers.Contract, delegatee: string) {
    const tx = await tokenContract.delegate(delegatee);
    console.log('Awaiting confirmation');
    await tx.wait();
    console.log('Successfully delegated');
}

async function main() {

    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY ?? '');

    console.log(`Deploying from account address ${wallet.address}`);

    const provider = ethers.providers.getDefaultProvider("ropsten");

    const signer = wallet.connect(provider);

    const balanceBN = await signer.getBalance();

    const balance = Number(ethers.utils.formatEther(balanceBN));

    console.log(`Wallet balance ${balance}`);

    if (balance < 0.02) {
        throw new Error("Not enough ether");

    }

    const tokenFactory = new ethers.ContractFactory(
        tokenJson.abi,
        tokenJson.bytecode,
        signer
    );

    console.log("Deploying MyToken contract");

    const tokenContract = await tokenFactory.deploy() as MyToken;

    console.log("Awaiting confirmations");

    await tokenContract.deployed();

    console.log(`Token contract successfully deployed at address: ${tokenContract.address}`);

    console.log('Minting some tokens for myself..');

    const mintTx = await tokenContract.mint(wallet.address, TOKEN_AMOUNT);

    console.log("Awaiting confirmations");

    await mintTx.wait();

    console.log(`Minted ${TOKEN_AMOUNT}`);

    console.log('Delegaing votes to myself..');

    const tempContract = new ethers.Contract(
        tokenContract.address,
        tokenJson.abi,
    );

    const connectedToken = tempContract.connect(provider);

    const tokenBalanceBN = await connectedToken.balanceOf(wallet.address);

    console.log(`MyToken balance of my wallet: ${tokenBalanceBN.toString()}`);

    await delegate(tokenContract, wallet.address);

    const ballotFactory = new ethers.ContractFactory(
        ballotJson.abi,
        ballotJson.bytecode,
        signer
    );

    console.log('Deploying ballot contract with:');

    console.log(`Ballot proposals: ${PROPOSALS}`);

    console.log(`Vote token address ${tokenContract.address}`);

    const ballotContract = await ballotFactory.deploy(convertStringArrayToBytes32(PROPOSALS), tokenContract.address) as CustomBallot;

    console.log("Awaiting confirmations");

    await ballotContract.deployed();

    await ballotContract.deployTransaction.wait(2);

    console.log(`CustomBallot contract successfully deployed at address: ${ballotContract.address}`);

    console.log('Check my voting power');

    let votingPower = await ballotContract.votingPower();

    console.log(`Current voting power: ${votingPower.toString()}`);

    console.log('Putting a vote in.. 99999 MTK on Yes');

    await vote(ballotContract, 0, 99999);

    let spentVotingPower = await ballotContract.spentVotePower(wallet.address);

    console.log(`Spent voting power: ${spentVotingPower.toString()}`);

    votingPower = await ballotContract.votingPower();

    console.log(`Remaining voting power: ${votingPower.toString()}`);

    console.log(`Current leading proposal is ${await ballotContract.winnerName()}`);

    console.log('Changed my mind, putting another vote in.. 999999 MTK on No');

    await vote(ballotContract, 1, 999999);

    spentVotingPower = await ballotContract.spentVotePower(wallet.address);

    console.log(`Spent voting power: ${spentVotingPower.toString()}`);

    votingPower = await ballotContract.votingPower();

    console.log(`Remaining voting power: ${votingPower.toString()}`);

    console.log(`Current leading proposal is ${await ballotContract.winnerName()}`);

    console.log('I guess what I really meant was Yes and No.. 9999999 MTK on YesAndNo');

    await vote(ballotContract, 1, 9999999);

    spentVotingPower = await ballotContract.spentVotePower(wallet.address);

    console.log(`Spent voting power: ${spentVotingPower.toString()}`);

    votingPower = await ballotContract.votingPower();

    console.log(`Remaining voting power: ${votingPower.toString()}`);

    console.log(`Current leading proposal is ${await ballotContract.winnerName()}`);

    console.log('Done');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});