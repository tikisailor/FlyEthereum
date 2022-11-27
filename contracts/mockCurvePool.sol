// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract mockCurvePool {

  function coins(uint256 index) public view returns (address) {
      return 0x062Bf725dC4cDF947aa79Ca2aaCCD4F385b13b5c;
  }

  function get_dy(int128 indexCoinToSend, int128 indexCoinToReceive, uint256 amount) public view returns (uint256){
      return amount;
  }

  function exchange(int128 indexCoinToSend, int128 indexCoinToReceive, uint256 assets, uint256 minDy) public payable returns (uint256) {
      return assets;
  }

  receive() external payable {}
 
}