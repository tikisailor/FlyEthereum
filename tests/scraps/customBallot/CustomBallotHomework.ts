import { expect } from "chai";
import { ethers } from "hardhat";
import { CustomBallot, MyToken } from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";


const PROPOSALS = ["Proposal 1", "Proposal 2", "Proposal 3"];

const TOKEN_AMOUNT = 1000000000000000;

function convertStringArrayToBytes32(array: string[]) {
    const bytes32Array = [];

    for (let index = 0; index < array.length; index++) {
      bytes32Array.push(ethers.utils.formatBytes32String(array[index]));
    }

    return bytes32Array;
};

async function vote(ballotContract: CustomBallot, proposal: number, amount: any) {
    const tx = await ballotContract.vote(proposal, amount);
    await tx.wait();
}

async function delegate(tokenContract: MyToken, delegatee: string) {
    const tx = await tokenContract.delegate(delegatee);
    await tx.wait();
}

describe("Testing CustomBallot", function () {
    let tokenContract: MyToken;
    let ballotFactory: any;
    let accounts: SignerWithAddress[];

    beforeEach(async () => {
        const tokenFactory = await ethers.getContractFactory("MyToken");

        tokenContract = await tokenFactory.deploy()

        await tokenContract.deployed();

        ballotFactory = await ethers.getContractFactory("CustomBallot");

        accounts = await ethers.getSigners();
    })

    describe("When a vote is cast without voting rights", function () {
        let ballotContract: CustomBallot

        beforeEach(async () => {
            ballotContract = await ballotFactory.deploy(convertStringArrayToBytes32(PROPOSALS), tokenContract.address);

            await ballotContract.deployed();
        })

        it("should revert if voting power has not been delegated", async () => { 
            await expect(
                vote(ballotContract, 0, TOKEN_AMOUNT)
              ).to.be.revertedWith("Has not enough voting power");
        })

        it("should revert if account has no balance", async () => { 
            await delegate(tokenContract, accounts[0].address)

            await expect(
                vote(ballotContract, 0, TOKEN_AMOUNT)
              ).to.be.revertedWith("Has not enough voting power");
        })
    })

    describe("When a vote is cast with appropriate voting rights", function () {
        let ballotContract: CustomBallot

        beforeEach(async () => {
            const mintTx = await tokenContract.mint(accounts[0].address, TOKEN_AMOUNT);

            await mintTx.wait();

            await delegate(tokenContract, accounts[0].address)

            ballotContract = await ballotFactory.deploy(convertStringArrayToBytes32(PROPOSALS), tokenContract.address);

            await ballotContract.deployed();
        })

        it("should increase spentVotePower by vote amount", async () => { 
            const origSpentVotePower = await ballotContract.spentVotePower(accounts[0].address);

            await vote(ballotContract, 0, TOKEN_AMOUNT);

            expect(await ballotContract.spentVotePower(accounts[0].address)).gt(origSpentVotePower);

            expect((await ballotContract.spentVotePower(accounts[0].address)).sub(origSpentVotePower)).to.eq(ethers.utils.parseEther('0.001'));
        })

        it("should increase the elected proposals voteCount by vote amount", async () => { 
            const origVoteCount = (await ballotContract.proposals(0)).voteCount;

            await vote(ballotContract, 0, TOKEN_AMOUNT);

            expect((await ballotContract.proposals(0)).voteCount).gt(origVoteCount);

            expect((await ballotContract.proposals(0)).voteCount.sub(origVoteCount)).to.eq(ethers.utils.parseEther('0.001'));
        })

        it("should emit Vote event with params provided by voter", async () => { 
            const origVoteCount = (await ballotContract.proposals(0)).voteCount;

            expect(await vote(ballotContract, 0, TOKEN_AMOUNT))
                .to.emit(ballotContract, "Voted")
                .withArgs(accounts[0].address, 0, TOKEN_AMOUNT, (await ballotContract.proposals(0)).voteCount);
        })

        // it("should reduce voting power by amount", async () => { 

        //     const origVotePower = await ballotContract.votingPower();

        //     // origVotePower is a tx instead of bigNumber..
        //     console.log(origVotePower);

        //     await vote(ballotContract, 0, 1000000000000000)

        //     // const diff = origVotePower.sub(await ballotContract.votingPower())

        //     // expect(diff).to.eq(0);
        // })
    })
});

