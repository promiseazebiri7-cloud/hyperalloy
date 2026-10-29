// TEST ONLY. Never deploy to mainnet.
pragma solidity ^0.8.20;

// A bare-bones ERC-20 token used only in tests.
// Anyone can mint, and there are no safety features on purpose.
contract MockToken {
    // Emitted whenever tokens move (or are minted, from address(0)).
    event Transfer(address indexed from, address indexed to, uint256 value);

    // Emitted whenever someone sets an allowance with approve().
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // Token details, set once in the constructor.
    string private _name;
    string private _symbol;
    uint8 private _decimals;

    // Total number of tokens that exist.
    uint256 public totalSupply;

    // How many tokens each address holds.
    // "internal" so contracts that inherit from MockToken can use it.
    mapping(address => uint256) internal balances;

    // How many tokens an owner lets a spender move on their behalf.
    // owner => spender => amount
    mapping(address => mapping(address => uint256)) internal allowances;

    // Runs once when the token is deployed. Saves the name, symbol and decimals.
    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
    }

    // Returns the token's name, e.g. "Mock USD Coin".
    function name() public view returns (string memory) {
        return _name;
    }

    // Returns the token's short symbol, e.g. "mUSDC".
    function symbol() public view returns (string memory) {
        return _symbol;
    }

    // Returns how many decimal places the token uses (6 for USDC-style, 18 for most others).
    function decimals() public view returns (uint8) {
        return _decimals;
    }

    // Creates new tokens out of thin air and gives them to "to".
    // Anyone can call this. That is fine because this is only for tests.
    function mint(address to, uint256 amount) public {
        totalSupply += amount;
        balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    // Returns how many tokens "account" holds.
    function balanceOf(address account) public view returns (uint256) {
        return balances[account];
    }

    // Returns how many tokens "spender" is still allowed to move from "owner".
    function allowance(address owner, address spender) public view returns (uint256) {
        return allowances[owner][spender];
    }

    // Lets "spender" move up to "amount" of the caller's tokens.
    // Replaces any earlier allowance for that spender.
    function approve(address spender, uint256 amount) public returns (bool) {
        allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    // Sends "amount" tokens from the caller to "to".
    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    // Sends "amount" tokens from "from" to "to", using the caller's allowance.
    // Reverts with "allowance" if the caller is not allowed to move that much.
    // An allowance of type(uint256).max means "unlimited", so we do not reduce it.
    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        uint256 current = allowances[from][msg.sender];
        require(current >= amount, "allowance");
        if (current != type(uint256).max) {
            allowances[from][msg.sender] = current - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    // The shared code that actually moves tokens.
    // Reverts with "balance" if "from" does not have enough.
    // "virtual" means other mocks that inherit from this one can override it
    // (for example, to take a fee or block certain addresses).
    function _transfer(address from, address to, uint256 amount) internal virtual {
        require(balances[from] >= amount, "balance");
        balances[from] -= amount;
        balances[to] += amount;
        emit Transfer(from, to, amount);
    }
}
