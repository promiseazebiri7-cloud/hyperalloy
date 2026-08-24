// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GoldToken is ERC20, Ownable {
    uint256 public assetValueUSD;

        constructor(uint256 initialSupply, uint256 initialValueUSD)
                ERC20("Mock Gold Token", "mGOLD")
                        Ownable(msg.sender)
                            {
                                    _mint(msg.sender, initialSupply);
                                            assetValueUSD = initialValueUSD;
                                                }

                                                    function updateAssetValue(uint256 newValueUSD) external onlyOwner {
                                                            assetValueUSD = newValueUSD;
                                                                }
                                                                }