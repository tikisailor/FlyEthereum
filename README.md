<h1 align="center">FlyEthereum - Alchemix wrapper for liquidation free leveraged Eth</h1>

<p align="center">
  <img src=".logo.png" alt="FlyEthereum-logo" width="150px" height="150"/>
  <br>
  <br>
</p>


## About

FlyEthereum is a ERC4626 based vault contract that generates a leveraged Eth position on Alchemix. It lets you deposit wrapped Eth and 
deposits that as collateral in Alchemix (yvWETH strategy). It then repeatedly takes a loan against that collateral and re-deposits the loan, until the deposit theshold is reached. The result is a liquidation safe leveraged yvWETH position with up to ~1.74x leverage.

FlyEthereum was built for the Reserve Protocol Hackathon with the goal to create an Etherum based Reserve asset that has the highest possible yield
without risk of liquidation or speculation losses.