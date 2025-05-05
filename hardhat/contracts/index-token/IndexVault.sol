// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IHederaTokenService.sol";
import "./interfaces/IIndexVault.sol";
import "./interfaces/IGovernanceHook.sol";

/**
 * @title IndexVault
 * @dev Stores tokens for the Lynx Index and manages the composition requirements
 */
contract IndexVault is IIndexVault {
    // Hedera Token Service precompile
    address constant private HTS_PRECOMPILE = address(0x0000000000000000000000000000000000000167);
    IHederaTokenService private hts;
    
    // Admin who can configure the vault until governance is activated
    address public admin;
    
    // Controller contract reference
    address public controller;
    
    // Governance hook that can override admin functions when activated
    IGovernanceHook public governanceHook;
    bool public governanceActivated = false;
    
    // Token composition
    address[] public compositionTokens;
    mapping(address => bool) public isCompositionToken;
    mapping(address => uint256) public tokenWeights;
    uint256 public totalWeight = 0;
    
    // User deposits tracking
    mapping(address => mapping(address => uint256)) public userDeposits;
    
    // Token address
    address public indexToken;
    
    // Events
    event TokenAdded(address token, uint256 weight);
    event TokenRemoved(address token);
    event TokenWeightUpdated(address token, uint256 oldWeight, uint256 newWeight);
    event UserDeposit(address user, address token, uint256 amount);
    event GovernanceHookSet(address hookAddress);
    event GovernanceActivated(bool activated);
    event ControllerSet(address controllerAddress);
    event IndexTokenSet(address indexToken);
    
    // Modifiers
    modifier onlyAdmin() {
        require(
            msg.sender == admin || 
            (governanceActivated && msg.sender == address(governanceHook)), 
            "Only admin or governance can call this function"
        );
        _;
    }
    
    modifier onlyController() {
        require(msg.sender == controller, "Only controller can call this function");
        _;
    }
    
    /**
     * @dev Constructor to initialize the IndexVault
     * @param _admin The address of the initial admin
     * @param _htsAddress The address of the Hedera Token Service precompile
     */
    constructor(address _admin, address _htsAddress) {
        admin = _admin;
        hts = IHederaTokenService(_htsAddress);
    }
    
    /**
     * @dev Set the controller contract
     * @param _controller The address of the controller contract
     */
    function setController(address _controller) external onlyAdmin {
        controller = _controller;
        emit ControllerSet(_controller);
    }
    
    /**
     * @dev Set the governance hook that can override admin
     * @param _hook The address of the governance hook
     */
    function setGovernanceHook(address _hook) external onlyAdmin {
        governanceHook = IGovernanceHook(_hook);
        emit GovernanceHookSet(_hook);
    }
    
    /**
     * @dev Activate or deactivate governance
     * @param _activated Whether governance should be activated
     */
    function setGovernanceActivated(bool _activated) external onlyAdmin {
        governanceActivated = _activated;
        emit GovernanceActivated(_activated);
    }
    
    /**
     * @dev Add a token to the composition
     * @param _token The token address
     * @param _weight The weight of the token in the composition
     */
    function addToken(address _token, uint256 _weight) external onlyAdmin {
        require(_token != address(0), "Invalid token address");
        require(_weight > 0, "Weight must be greater than 0");
        require(!isCompositionToken[_token], "Token already in composition");
        
        isCompositionToken[_token] = true;
        tokenWeights[_token] = _weight;
        compositionTokens.push(_token);
        totalWeight += _weight;
        
        emit TokenAdded(_token, _weight);
    }
    
    /**
     * @dev Remove a token from the composition
     * @param _token The token address to remove
     */
    function removeToken(address _token) external onlyAdmin {
        require(isCompositionToken[_token], "Token not in composition");
        
        totalWeight -= tokenWeights[_token];
        delete tokenWeights[_token];
        isCompositionToken[_token] = false;
        
        // Remove from the array
        for (uint i = 0; i < compositionTokens.length; i++) {
            if (compositionTokens[i] == _token) {
                compositionTokens[i] = compositionTokens[compositionTokens.length - 1];
                compositionTokens.pop();
                break;
            }
        }
        
        emit TokenRemoved(_token);
    }
    
    /**
     * @dev Update the weight of a token in the composition
     * @param _token The token address
     * @param _newWeight The new weight value
     */
    function updateTokenWeight(address _token, uint256 _newWeight) external onlyAdmin {
        require(isCompositionToken[_token], "Token not in composition");
        require(_newWeight > 0, "Weight must be greater than 0");
        
        uint256 oldWeight = tokenWeights[_token];
        tokenWeights[_token] = _newWeight;
        totalWeight = totalWeight - oldWeight + _newWeight;
        
        emit TokenWeightUpdated(_token, oldWeight, _newWeight);
    }
    
    /**
     * @dev Get all composition tokens and their weights
     * @return tokens Array of token addresses
     * @return weights Array of corresponding weights
     */
    function getComposition() external view returns (address[] memory tokens, uint256[] memory weights) {
        tokens = new address[](compositionTokens.length);
        weights = new uint256[](compositionTokens.length);
        
        for (uint i = 0; i < compositionTokens.length; i++) {
            tokens[i] = compositionTokens[i];
            weights[i] = tokenWeights[compositionTokens[i]];
        }
        
        return (tokens, weights);
    }
    
    /**
     * @dev Deposit tokens into the vault
     * @param _token The token to deposit
     * @param _amount The amount to deposit
     */
    function depositToken(address _token, uint256 _amount) external {
        require(isCompositionToken[_token], "Token not in composition");
        require(_amount > 0, "Amount must be greater than 0");
        
        // Verify token is associated
        require(hts.isTokenAssociated(_token, address(this)), "Token not associated with vault");
        require(hts.isTokenAssociated(_token, msg.sender), "Token not associated with sender");
        
        // Get balance before
        uint256 balanceBefore = hts.balanceOf(_token, address(this));
        
        // Transfer from user to vault
        int64 result = hts.transferToken(_token, msg.sender, address(this), _amount);
        require(result == 0, "Transfer failed");
        
        // Verify balance increased
        uint256 balanceAfter = hts.balanceOf(_token, address(this));
        require(balanceAfter - balanceBefore == _amount, "Transfer amount mismatch");
        
        // Update user deposits
        userDeposits[msg.sender][_token] += _amount;
        
        emit UserDeposit(msg.sender, _token, _amount);
    }
    
    /**
     * @dev Calculate required deposits for minting a specific amount
     * @param _mintAmount The amount of index tokens to mint
     * @return tokens Array of token addresses
     * @return amounts Array of amounts required for each token
     */
    function calculateRequiredDeposits(uint256 _mintAmount) external view returns (address[] memory tokens, uint256[] memory amounts) {
        tokens = new address[](compositionTokens.length);
        amounts = new uint256[](compositionTokens.length);
        
        for (uint i = 0; i < compositionTokens.length; i++) {
            tokens[i] = compositionTokens[i];
            
            // Calculate proportional amount based on weight
            amounts[i] = (_mintAmount * tokenWeights[compositionTokens[i]]) / totalWeight;
        }
        
        return (tokens, amounts);
    }
    
    /**
     * @dev Validate if user has sufficient deposits for minting
     * @param _user The user address
     * @param _mintAmount The amount to mint
     * @return valid Whether the user has sufficient deposits
     */
    function validateMint(address _user, uint256 _mintAmount) external view onlyController returns (bool) {
        for (uint i = 0; i < compositionTokens.length; i++) {
            address token = compositionTokens[i];
            uint256 requiredAmount = (_mintAmount * tokenWeights[token]) / totalWeight;
            
            if (userDeposits[_user][token] < requiredAmount) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * @dev Process a mint by consuming user deposits
     * @param _user The user address
     * @param _mintAmount The amount being minted
     */
    function processMint(address _user, uint256 _mintAmount) external onlyController {
        for (uint i = 0; i < compositionTokens.length; i++) {
            address token = compositionTokens[i];
            uint256 requiredAmount = (_mintAmount * tokenWeights[token]) / totalWeight;
            
            require(userDeposits[_user][token] >= requiredAmount, "Insufficient deposit");
            
            userDeposits[_user][token] -= requiredAmount;
        }
    }
    
    /**
     * @dev Set the index token address
     * @param _indexToken The index token address
     */
    function setIndexToken(address _indexToken) external onlyController {
        require(_indexToken != address(0), "Invalid token address");
        
        indexToken = _indexToken;
        
        // Associate with the token if not already associated
        if (!hts.isTokenAssociated(address(this), _indexToken)) {
            int64 associateResponse = hts.associateToken(address(this), _indexToken);
            require(associateResponse == 0, "Token association failed");
        }
        
        emit IndexTokenSet(_indexToken);
    }
    
    /**
     * @dev Receive HBAR
     */
    receive() external payable {}
} 