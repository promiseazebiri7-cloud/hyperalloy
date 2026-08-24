// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract HyperalloyVault is ERC20, Ownable {
    IERC20 public realEstateToken;
        IERC20 public goldToken;

            // Basket token is minted 1:1 with the total USD value deposited
                constructor(address _realEstateToken, address _goldToken)
                        ERC20("Hyperalloy Basket Token", "HALLOY")
                                Ownable(msg.sender)
                                    {
                                            realEstateToken = IERC20(_realEstateToken);
                                                    goldToken = IERC20(_goldToken);
                                                        }

                                                            // Deposit both assets, receive basket tokens representing your share
                                                                function deposit(uint256 realEstateAmount, uint256 goldAmount) external {
                                                                        require(realEstateAmount > 0 || goldAmount > 0, "Must deposit something");

                                                                                if (realEstateAmount > 0) {
                                                                                            realEstateToken.transferFrom(msg.sender, address(this), realEstateAmount);
                                                                                                    }
                                                                                                            if (goldAmount > 0) {
                                                                                                                        goldToken.transferFrom(msg.sender, address(this), goldAmount);
                                                                                                                                }

                                                                                                                                        // For this simple prototype: mint basket tokens equal to total deposited amount
                                                                                                                                                uint256 basketAmount = realEstateAmount + goldAmount;
                                                                                                                                                        _mint(msg.sender, basketAmount);
                                                                                                                                                            }

                                                                                                                                                                // Withdraw your share — burns basket tokens, returns underlying assets proportionally
                                                                                                                                                                    function withdraw(uint256 basketAmount) external {
                                                                                                                                                                            require(balanceOf(msg.sender) >= basketAmount, "Insufficient basket tokens");

                                                                                                                                                                                    uint256 totalSupplyBefore = totalSupply();
                                                                                                                                                                                            uint256 realEstateBalance = realEstateToken.balanceOf(address(this));
                                                                                                                                                                                                    uint256 goldBalance = goldToken.balanceOf(address(this));

                                                                                                                                                                                                            uint256 realEstateShare = (realEstateBalance * basketAmount) / totalSupplyBefore;
                                                                                                                                                                                                                    uint256 goldShare = (goldBalance * basketAmount) / totalSupplyBefore;

                                                                                                                                                                                                                            _burn(msg.sender, basketAmount);

                                                                                                                                                                                                                                    if (realEstateShare > 0) {
                                                                                                                                                                                                                                                realEstateToken.transfer(msg.sender, realEstateShare);
                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                                if (goldShare > 0) {
                                                                                                                                                                                                                                                                            goldToken.transfer(msg.sender, goldShare);
                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                        }

                                                                                                                                                                                                                                                                                            // View function: see the vault's total holdings of each asset
                                                                                                                                                                                                                                                                                                function getVaultHoldings() external view returns (uint256 realEstateHeld, uint256 goldHeld) {
                                                                                                                                                                                                                                                                                                        realEstateHeld = realEstateToken.balanceOf(address(this));
                                                                                                                                                                                                                                                                                                                goldHeld = goldToken.balanceOf(address(this));
                                                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                                                    }