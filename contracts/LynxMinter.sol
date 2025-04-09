// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./IHederaTokenService.sol";

contract LynxMinter {
    address public constant HTS_PRECOMPILE = 0x0000000000000000000000000000000000000167;
    IHederaTokenService private hts;

    address public immutable lynxToken;
    address public immutable sauceToken;
    address public immutable clxyToken;

    uint256 public constant SAUCE_RATIO = 100; // 1 LYNX = 100 SAUCE
    uint256 public constant CLXY_RATIO = 50;   // 1 LYNX = 50 CLXY
    uint256 public constant HBAR_RATIO = 10;   // 1 LYNX = 10 tinybar

    constructor(
        address _lynxToken,
        address _sauceToken,
        address _clxyToken
    ) {
        lynxToken = _lynxToken;
        sauceToken = _sauceToken;
        clxyToken = _clxyToken;
        hts = IHederaTokenService(HTS_PRECOMPILE);
    }

    function setTokenService(address _hts) external {
        hts = IHederaTokenService(_hts);
    }

    function calculateRequiredSAUCE(uint256 lynxAmount) public pure returns (uint256) {
        return lynxAmount * SAUCE_RATIO;
    }

    function calculateRequiredCLXY(uint256 lynxAmount) public pure returns (uint256) {
        return lynxAmount * CLXY_RATIO;
    }

    function calculateRequiredHBAR(uint256 lynxAmount) public pure returns (uint256) {
        return lynxAmount * HBAR_RATIO;
    }

    function mint(uint256 amount) external payable {
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 hbarRequired = calculateRequiredHBAR(amount);
        require(msg.value == hbarRequired, "Incorrect HBAR amount");

        uint256 sauceRequired = calculateRequiredSAUCE(amount);
        uint256 clxyRequired = calculateRequiredCLXY(amount);

        // Check allowances
        uint256 sauceAllowance = hts.allowance(sauceToken, msg.sender, address(this));
        require(sauceAllowance >= sauceRequired, "Insufficient SAUCE allowance");

        uint256 clxyAllowance = hts.allowance(clxyToken, msg.sender, address(this));
        require(clxyAllowance >= clxyRequired, "Insufficient CLXY allowance");

        // Transfer tokens
        int64 response = hts.transferToken(sauceToken, msg.sender, address(this), sauceRequired);
        require(response == 0, "SAUCE transfer failed");

        response = hts.transferToken(clxyToken, msg.sender, address(this), clxyRequired);
        require(response == 0, "CLXY transfer failed");

        // Mint LYNX
        bytes[] memory metadata = new bytes[](0);
        response = hts.mintToken(lynxToken, uint64(amount), metadata);
        require(response == 0, "LYNX mint failed");
    }
} 