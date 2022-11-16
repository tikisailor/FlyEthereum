
import hre, { ethers } from 'hardhat'
import * as flyEthJson from "../artifacts/contracts/FlyEthereum.sol/FlyEthereum.json";
import dotenv from "dotenv";
dotenv.config()

async function main() {

  const [burner] = await hre.ethers.getSigners()

  const flyEthFactory = new ethers.ContractFactory(
    flyEthJson.abi,
    flyEthJson.bytecode,
    burner
  );


  const flyEthContract = await flyEthFactory.deploy(
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  );

  console.log("Awaiting confirmations");

  await flyEthContract.deployed();

  console.log(`Token contract successfully deployed at address: ${flyEthContract.address}`);

};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});