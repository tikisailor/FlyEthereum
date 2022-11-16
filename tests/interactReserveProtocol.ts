// import { ethers } from "ethers";
import hre from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import dotenv from "dotenv";
dotenv.config()
import { ethers } from "hardhat";
import * as helpers from "@nomicfoundation/hardhat-network-helpers";



// getChainId: Returns current chain Id
export const getChainId = async (hre: HardhatRuntimeEnvironment) => {
    let _chainId
    try {
      _chainId = await hre.network.provider.send('eth_chainId')
    } catch (e) {
      console.log('failed to get chainId, falling back on net_version...')
      _chainId = await hre.network.provider.send('net_version')
    }
  
    if (!_chainId) {
      throw new Error(`could not get chainId from network`)
    }
    if (_chainId.startsWith('0x')) {
      _chainId = ethers.BigNumber.from(_chainId).toString()
    }
    return _chainId
  }

  async function main() {

    // verify that we are connected to mainnet fork
    // now the block number should be 14916729
    const latestBlock = await helpers.time.latestBlock()
    console.log('Latest block: ', latestBlock)

    // get deployer signer
    const [deployer, burner] = await hre.ethers.getSigners()
    const chainId = await getChainId(hre)
    // const wallet = new ethers.Wallet(process.env.PRIVATE_KEY ?? '');
    // console.log(wallet.address)
    console.log(chainId)
    // console.log(deployer)

    //impersonate random address with DAI
    const impAddress = '0xBd9B34cCbb8db0FDECb532B1EAF5D46f5b673fE8'
    await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [impAddress]
      });
    const impSigner = hre.ethers.provider.getSigner(impAddress)
    console.log(await impSigner.getBalance());

    //check DAI balance
    const daiAbi = [
        "function name() public view returns (string)",
        "function symbol() public view returns (string)",
        "function decimals() public view returns (uint8)",
        "function totalSupply() public view returns (uint256)",
        "function approve(address _spender, uint256 _value) public returns (bool success)",
        "function balanceOf(address) public view returns(uint256)"
    ]
  
      const DaiContract = new ethers.Contract("0x6B175474E89094C44Da98b954EedeAC495271d0F", daiAbi, impSigner)
  
    //   const name = await DaiContract.name()
      const symbol = await DaiContract.symbol()
      const decimals = await DaiContract.decimals()
      const totalSupply = await DaiContract.totalSupply()

    //   console.log(name);
      console.log(symbol);
      console.log(decimals);
      console.log(totalSupply);

      const balance = ethers.utils.formatEther(await DaiContract.balanceOf(impAddress))
      console.log(balance);

      // check if reserve protocol can be interacted with
      const OWNER = ethers.utils.formatBytes32String('OWNER');
      console.log(OWNER)

      const rP_MainP1Abi = [
          "function hasRole(bytes32 role, address account) public view returns (bool)",
          "function grantRole(bytes32 role, address account)"
      ]
      
    //   const rP_MainP1Address = '0xaa85216187F92a781D8F9Bcb40825E356ee2635a'; // mainnet add
      const rP_MainP1Address = '0x5322471a7E37Ac2B8902cFcba84d266b37D811A0'; // test deplyment


      const rP_MainP1Contract = new ethers.Contract(rP_MainP1Address, rP_MainP1Abi, impSigner);

      const hasRole = await rP_MainP1Contract.hasRole(OWNER, deployer.address);

      console.log(hasRole);

    //   rP_MainP1Contract.grantRole(OWNER, deployer.address);

      console.log(await rP_MainP1Contract.hasRole(OWNER, burner.address));

      //collateral
      const collateralAbi = [
          "function status() public view returns (CollateralStatus)",
          "function refresh() external",
          "function strictPrice() public view returns (uint192)",
          "function isCollateral() external pure returns (bool)",
          "function getClaimCalldata() external view returns (address _to, bytes memory _cd)",
          "function erc20()  public view returns (address) ",
        ]
      const fiatCollateral1Add = '0xc6B407503dE64956Ad3cF5Ab112cA4f56AA13517' //DAI?

      const rP_FiatCollateral1 = new ethers.Contract(fiatCollateral1Add, collateralAbi, deployer);

      console.log(await rP_FiatCollateral1.strictPrice());
      console.log(await rP_FiatCollateral1.isCollateral());
      console.log(await rP_FiatCollateral1.getClaimCalldata());
      console.log(await rP_FiatCollateral1.erc20());

    //   console.log(await rP_FiatCollateral1.status());


      //asset registry

      const assetRegistryAdd = '0x3D63c50AD04DD5aE394CAB562b7691DD5de7CF6f'
    //   const assetRegistryAdd = '0xD126741474B0348D9B0F4911573d8f543c01C2c4' // mainnet


      const assetRegistryAbi = [
        "function erc20s() external view returns (IERC20[] memory erc20s_)",
    ]

    const rP_AssetRegistry = new ethers.Contract(assetRegistryAdd, assetRegistryAbi, deployer);

    // console.log(await rP_AssetRegistry.erc20s());

      


    
  };

  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

