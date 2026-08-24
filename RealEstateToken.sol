// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RealEstateToken is ERC20, Ownable {
    // Fixed mock valuation for this test asset (in USD, scaled by 1e18)
    uint256 public assetValueUSD;

    constructor(uint256 initialSupply, uint256 initialValueUSD)
        ERC20("Mock Real Estate Token", "mREAL")
        Ownable(msg.sender)
    {
        _mint(msg.sender, initialSupply);
        assetValueUSD = initialValueUSD;
    }

    // Owner can update the appraised value (simulating a real appraisal update)
    function updateAssetValue(uint256 newValueUSD) external onlyOwner {
        assetValueUSD = newValueUSD;
    }
}