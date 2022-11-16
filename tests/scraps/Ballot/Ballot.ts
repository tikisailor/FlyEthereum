import { expect } from "chai";
import { ethers } from "hardhat";
import { Ballot } from "../../typechain";

const PROPOSALS = ["Proposal 1", "Proposal 2", "Proposal 3"];

function convertStringArrayToBytes32(array: string[]) {
  const bytes32Array = [];
  for (let index = 0; index < array.length; index++) {
    bytes32Array.push(ethers.utils.formatBytes32String(array[index]));
  }
  return bytes32Array;
}

async function giveRightToVote(ballotContract: Ballot, voterAddress: any) {
  const tx = await ballotContract.giveRightToVote(voterAddress);
  await tx.wait();
}

async function giveRightToVoteFrom(ballotContract: Ballot, voterAddress: any, from: string) {
  const tx = await ballotContract.giveRightToVote(voterAddress, {from: from});
  await tx.wait();
}

async function vote(ballotContract: Ballot, proposal: any) {
  const tx = await ballotContract.vote(proposal);
  await tx.wait();
}

async function delegate(ballotContract: Ballot, delegateAddress: any) {
  const tx = await ballotContract.delegate(delegateAddress);
  await tx.wait();
}

async function winningProposal(ballotContract: Ballot) {
  return await ballotContract.winningProposal();
}

describe("Ballot", function () {
  let ballotContract: Ballot;
  let accounts: any[];

  this.beforeEach(async function () {
    accounts = await ethers.getSigners();
    const ballotFactory = await ethers.getContractFactory("Ballot");
    ballotContract = await ballotFactory.deploy(
      convertStringArrayToBytes32(PROPOSALS)
    );
    await ballotContract.deployed();
  });

  describe("when the contract is deployed", function () {
    it("has the provided proposals", async function () {
      for (let index = 0; index < PROPOSALS.length; index++) {
        const proposal = await ballotContract.proposals(index);
        expect(ethers.utils.parseBytes32String(proposal.name)).to.eq(
          PROPOSALS[index]
        );
      }
    });

    it("has zero votes for all proposals", async function () {
      for (let index = 0; index < PROPOSALS.length; index++) {
        const proposal = await ballotContract.proposals(index);
        expect(proposal.voteCount.toNumber()).to.eq(0);
      }
    });

    it("sets the deployer address as chairperson", async function () {
      const chairperson = await ballotContract.chairperson();
      expect(chairperson).to.eq(accounts[0].address);
    });

    it("sets the voting weight for the chairperson as 1", async function () {
      const chairpersonVoter = await ballotContract.voters(accounts[0].address);
      expect(chairpersonVoter.weight.toNumber()).to.eq(1);
    });
  });

  describe("when the chairperson interacts with the giveRightToVote function in the contract", function () {
    it("gives right to vote for another address", async function () {
      const voterAddress = accounts[1].address;
      await giveRightToVote(ballotContract, voterAddress);
      const voter = await ballotContract.voters(voterAddress);
      expect(voter.weight.toNumber()).to.eq(1);
    });

    it("can not give right to vote for someone that has voted", async function () {
      const voterAddress = accounts[1].address;
      await giveRightToVote(ballotContract, voterAddress);
      await ballotContract.connect(accounts[1]).vote(0);
      await expect(
        giveRightToVote(ballotContract, voterAddress)
      ).to.be.revertedWith("The voter already voted.");
    });

    it("can not give right to vote for someone that has already voting rights", async function () {
      const voterAddress = accounts[1].address;
      await giveRightToVote(ballotContract, voterAddress);
      await expect(
        giveRightToVote(ballotContract, voterAddress)
      ).to.be.revertedWith("");
    });
  });

  describe("when the voter interact with the vote function in the contract", function () {
    // TODO
    it("senders Vote.voted is set to true", async function () {
      const voterAddress = accounts[0].address;
      await vote(ballotContract, 1);
      const voter = await ballotContract.voters(voterAddress);
      expect(voter.voted).to.eq(true);
    });
  });

  describe("when the voter interact with the delegate function in the contract", function () {
    // TODO
    it("delegates weight should increase by 1", async function () {
      const voterAddress = accounts[0].address;
      const delegateAddress = accounts[1].address;
      await giveRightToVote(ballotContract, delegateAddress)
      const delegateWeightBefore = (await ballotContract.voters(delegateAddress)).weight;
      await delegate(ballotContract, delegateAddress);
      const delegateWeightAfter = (await ballotContract.voters(delegateAddress)).weight;
      expect(delegateWeightBefore).to.eq(delegateWeightAfter.sub(delegateWeightBefore));
    });
  });

  describe("when the an attacker interact with the giveRightToVote function in the contract", function () {
    // TODO
    it("is should revert if msg.sender is not the chairperson", async function () {
      const attacker = accounts[1];
      const receiver = accounts[2].address;
      await expect(
        giveRightToVote(ballotContract.connect(attacker), receiver)
      ).to.be.revertedWith("Only chairperson can give right to vote.");
    });
  });

  describe("when the an attacker interact with the vote function in the contract", function () {
    // TODO
    it("is should revert if attacker was not given right to vote", async function () {
      const attacker = accounts[1];
      await expect(
        vote(ballotContract.connect(attacker), 1)
      ).to.be.revertedWith("Has no right to vote");
    });
  });

  describe("when the an attacker interact with the delegate function in the contract", function () {
    // TODO
    it("is should revert if attacker was not given right to vote", async function () {
      const attacker = accounts[1];
      const receiver = accounts[2].address;
      await expect(
        delegate(ballotContract.connect(attacker), receiver)
      ).to.be.revertedWith("");
    });
  });

  describe("when someone interact with the winningProposal function before any votes are cast", function () {
    // TODO
    it("is should return 0", async function () {
      expect(
        (await winningProposal(ballotContract)).toNumber()
      ).to.eq(0);
    });
  });

  describe("when someone interact with the winningProposal function after one vote is cast for the first proposal", function () {
    // TODO
    it("is should return 0", async function () {
      await vote(ballotContract, 0);
      expect(
        (await winningProposal(ballotContract)).toNumber()
      ).to.eq(0);
    });
  });

  describe("when someone interact with the winnerName function before any votes are cast", function () {
    // TODO
    it("is not implemented", async function () {
      throw new Error("Not implemented");
    });
  });

  describe("when someone interact with the winnerName function after one vote is cast for the first proposal", function () {
    // TODO
    it("is not implemented", async function () {
      throw new Error("Not implemented");
    });
  });

  describe("when someone interact with the winningProposal function and winnerName after 5 random votes are cast for the proposals", function () {
    // TODO
    it("is not implemented", async function () {
      throw new Error("Not implemented");
    });
  });
});
