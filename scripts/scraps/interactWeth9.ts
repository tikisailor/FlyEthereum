
import hre, { ethers } from 'hardhat'
import * as flyEthJson from "../../artifacts/contracts/FlyEthereum.sol/FlyEthereum.json";
import { FlyEthereum } from "../../typechain";
import wethAbi from "../../tests/weth9abi.json"; // WETH9's ABI
import dotenv from "dotenv";
dotenv.config()

//https://gist.github.com/a2468834/6101244f5000e467ec8904ac5f0ec41d

// Auxiliary functions
//@ts-ignore
function addressSlicing(address) {
    return `${address.toLowerCase().slice(0, 6)}......${address.toLowerCase().slice(-4)}`;
}
//@ts-ignore
async function printAccountAndBalance(provider, contract, account0, account1) {
    const decimals = 3;
    console.log("--------------------------------------------------------------------------------");
    console.log("Account Address             ETH-Balance     WETH-Balance");
    console.log(`#0     `, 
                `${addressSlicing(account0.address)}   `, 
                `${(+hre.ethers.utils.formatEther(await provider.getBalance(account0.address))).toFixed(decimals)}\t   `, 
                `${(+hre.ethers.utils.formatEther(await contract.balanceOf(account0.address))).toFixed(decimals)}`);
    console.log(`#1     `, 
                `${addressSlicing(account1.address)}   `, 
                `${(+hre.ethers.utils.formatEther(await provider.getBalance(account1.address))).toFixed(decimals)}\t   `, 
                `${(+hre.ethers.utils.formatEther(await contract.balanceOf(account1.address))).toFixed(decimals)}`);
    console.log("\n");
}

async function main() {

  const [burner] = await hre.ethers.getSigners()
  const provider  = await hre.ethers.provider;

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

  // get some WETH

  const wethContract = new ethers.Contract('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', wethAbi, burner);

  console.log(`Wallet balance before deposit ${Number(ethers.utils.formatEther(await burner.getBalance()))}`);

  
    // Enable impersonating sending txn by specific address
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0x2feb1512183545f48f6b9c5b4ebfcaf49cfca6f3"]
    });
    
    // Prepare the signers of account#0 and account#1
    const signer_1 = await hre.ethers.getSigner('0x2feb1512183545f48f6b9c5b4ebfcaf49cfca6f3');

    {
        console.log("[Step 0] Before we started");
        await printAccountAndBalance(provider, wethContract, burner, signer_1);
    }

    {
        console.log("[Step 1] Account#1 deposits 3 ETH in contract");
        var overrides = {value : hre.ethers.utils.parseEther("3.0")};
        const connectedWeth9s1 = wethContract.connect(signer_1);
        await connectedWeth9s1.deposit(overrides)
        await printAccountAndBalance(provider, connectedWeth9s1, burner, signer_1);
    }
    
    {
        console.log("[Step 2] Account#1 sends 13 WETH to Account#0");
        const connectedWeth9s1 = wethContract.connect(signer_1);
        await connectedWeth9s1.transferFrom(
            signer_1.address, 
            burner.address, 
            hre.ethers.utils.parseEther("13.0")
    )
        await printAccountAndBalance(provider, connectedWeth9s1, burner, signer_1);
    }
    
    {
        console.log("[Step 3] Account#0 withdraws 13 WETH from contract");
        const connectedWeth9burner = wethContract.connect(burner);
        await connectedWeth9burner.withdraw(hre.ethers.utils.parseEther("13.0"))
        await printAccountAndBalance(provider, connectedWeth9burner, burner, signer_1);
    }

    {
        console.log("[Step 4] Account#1 deposits 100 WETH into vault");
        const connectedWeth9burner = wethContract.connect(burner);
        await connectedWeth9burner.withdraw(hre.ethers.utils.parseEther("13.0"))
        await printAccountAndBalance(provider, connectedWeth9burner, burner, signer_1);
    }
    

  console.log(`Wallet balance after deposit ${Number(ethers.utils.formatEther(await burner.getBalance()))}`);


};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});