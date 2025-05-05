// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IGovernanceHook
 * @dev Interface for governance hook to enable DAO control
 */
interface IGovernanceHook {
    /**
     * @dev Check if a governance action is approved
     * @param actor The address initiating the action
     * @param target The contract being acted upon
     * @param selector The function selector being called
     * @param data The encoded function call data
     * @return approved Whether the action is approved by governance
     */
    function isActionApproved(
        address actor, 
        address target, 
        bytes4 selector, 
        bytes calldata data
    ) external view returns (bool approved);
    
    /**
     * @dev Submit a governance proposal
     * @param target The contract to call
     * @param data The call data for the function
     * @param description Description of the proposal
     * @return proposalId The ID of the created proposal
     */
    function submitProposal(
        address target,
        bytes calldata data,
        string calldata description
    ) external returns (uint256 proposalId);
} 