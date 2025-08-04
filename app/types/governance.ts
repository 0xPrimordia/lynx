/**
 * Governance Vote Types
 * 
 * These types match the schema expected by the gov agent to ensure
 * compatibility between the UI and the governance processing system.
 */

/**
 * Multi-ratio governance vote schema compatible with gov agent
 * Used for submitting votes that change token allocation ratios
 */
export interface MultiRatioGovernanceVote {
  type: 'MULTI_RATIO_VOTE';          // Identifies this as a multi-ratio vote
  ratioChanges: Array<{
    token: string;                  // Token identifier
    newRatio: number;              // New ratio (0-100%)
  }>;
  voterAccountId: string;           // Hedera account ID format (0.0.xxxxx)
  votingPower: number;             // Voter's voting power
  timestamp: Date;                 // When the vote was cast
  txId?: string;                   // Optional transaction ID
  reason?: string;                 // Optional reason for the vote
}

/**
 * Validation result for governance votes
 */
export interface VoteValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validation function to ensure vote matches gov agent schema
 */
export const validateMultiRatioVote = (vote: MultiRatioGovernanceVote): VoteValidationResult => {
  const errors: string[] = [];
  
  // Validate Hedera account ID format (0.0.xxxxx)
  const accountIdRegex = /^0\.0\.\d+$/;
  if (!accountIdRegex.test(vote.voterAccountId)) {
    errors.push(`Invalid voterAccountId format: ${vote.voterAccountId}. Expected format: 0.0.xxxxx`);
  }
  
  // Validate voting power is non-negative
  if (vote.votingPower < 0) {
    errors.push(`Invalid votingPower: ${vote.votingPower}. Must be >= 0`);
  }
  
  // Validate each ratio change
  vote.ratioChanges.forEach((change, index) => {
    if (change.newRatio < 0 || change.newRatio > 100) {
      errors.push(`Invalid newRatio for token ${change.token} at index ${index}: ${change.newRatio}. Must be between 0-100`);
    }
    if (!change.token || typeof change.token !== 'string') {
      errors.push(`Invalid token identifier at index ${index}: ${change.token}. Must be a non-empty string`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Gov agent compatible schema constants
 */
export const GOVERNANCE_VOTE_TYPES = {
  MULTI_RATIO_VOTE: 'MULTI_RATIO_VOTE'
} as const;

export type GovernanceVoteType = typeof GOVERNANCE_VOTE_TYPES[keyof typeof GOVERNANCE_VOTE_TYPES];