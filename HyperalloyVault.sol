// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IValuedToken is IERC20 {
    function assetValueUSD() external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

contract HyperalloyVault is ERC20, Ownable {
    IValuedToken public realEstateToken;
    IValuedToken public goldToken;

    constructor(address _realEstateToken, address _goldToken)
        ERC20("Hyperalloy Basket Token", "HALLOY")
        Ownable(msg.sender)
    {
        realEstateToken = IValuedToken(_realEstateToken);
        goldToken = IValuedToken(_goldToken);
    }

    function _valueOf(IValuedToken token, uint256 amount) internal view returns (uint256) {
        uint256 supply = token.totalSupply();
        if (supply == 0) {
            return 0;
        }
        return (amount * token.assetValueUSD()) / supply;
    }

    function deposit(uint256 realEstateAmount, uint256 goldAmount) external {
        require(realEstateAmount > 0 || goldAmount > 0, "Must deposit something");

        if (realEstateAmount > 0) {
            realEstateToken.transferFrom(msg.sender, address(this), realEstateAmount);
        }

        if (goldAmount > 0) {
            goldToken.transferFrom(msg.sender, address(this), goldAmount);
        }

        uint256 depositValue = _valueOf(realEstateToken, realEstateAmount) + _valueOf(goldToken, goldAmount);
        require(depositValue > 0, "Deposit value must be greater than zero");

        _mint(msg.sender, depositValue);
    }

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

    function getVaultHoldings() external view returns (uint256 realEstateHeld, uint256 goldHeld) {
        realEstateHeld = realEstateToken.balanceOf(address(this));
        goldHeld = goldToken.balanceOf(address(this));
    }
}