'use client';

import React, { useState } from 'react';

interface DaoTestControlsProps {
  onPreferenceSubmit?: (topicId: string) => void;
}

const DaoTestControls: React.FC<DaoTestControlsProps> = ({ onPreferenceSubmit }) => {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateUserTopic = async () => {
    setIsCreating(true);
    try {
      // Simulate creating a user topic
      const mockTopicId = `user-topic-${Date.now()}`;
      
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onPreferenceSubmit?.(mockTopicId);
    } catch (error) {
      console.error('Error creating user topic:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
      <h3 className="text-white font-medium mb-2">DAO Test Controls</h3>
      <p className="text-gray-400 text-sm mb-3">
        Development mode: Create a test user topic for DAO interactions
      </p>
      <button
        onClick={handleCreateUserTopic}
        disabled={isCreating}
        className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors ${
          isCreating ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {isCreating ? 'Creating...' : 'Create User Topic'}
      </button>
    </div>
  );
};

export default DaoTestControls; 