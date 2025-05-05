// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IIndexVault
 * @dev Interface for the IndexVault contract
 */
interface IIndexVault {
    /**
     * @dev Set the controller contract
     * @param _controller The address of the controller contract
     */
    function setController(address _controller) external;
    
    /**
     * @dev Add a token to the composition
     * @param _token The token address
     * @param _weight The weight of the token in the composition
     */
    function addToken(address _token, uint256 _weight) external;
    
    /**
     * @dev Remove a token from the composition
     * @param _token The token address to remove
     */
    function removeToken(address _token) external;
    
    /**
     * @dev Update the weight of a token in the composition
     * @param _token The token address
     * @param _newWeight The new weight value
     */
    function updateTokenWeight(address _token, uint256 _newWeight) external;
    
    /**
     * @dev Get all composition tokens and their weights
     * @return tokens Array of token addresses
     * @return weights Array of corresponding weights
     */
    function getComposition() external view returns (address[] memory tokens, uint256[] memory weights);
    
    /**
     * @dev Deposit tokens into the vault
     * @param _token The token to deposit
     * @param _amount The amount to deposit
     */
    function depositToken(address _token, uint256 _amount) external;
    
    /**
     * @dev Calculate required deposits for minting a specific amount
     * @param _mintAmount The amount of index tokens to mint
     * @return tokens Array of token addresses
     * @return amounts Array of amounts required for each token
     */
    function calculateRequiredDeposits(uint256 _mintAmount) external view returns (address[] memory tokens, uint256[] memory amounts);
    
    /**
     * @dev Validate if user has sufficient deposits for minting
     * @param _user The user address
     * @param _mintAmount The amount to mint
     * @return valid Whether the user has sufficient deposits
     */
    function validateMint(address _user, uint256 _mintAmount) external view returns (bool);
    
    /**
     * @dev Process a mint by consuming user deposits
     * @param _user The user address
     * @param _mintAmount The amount being minted
     */
    function processMint(address _user, uint256 _mintAmount) external;
    
    /**
     * @dev Set the index token address
     * @param _indexToken The index token address
     */
    function setIndexToken(address _indexToken) external;
} 