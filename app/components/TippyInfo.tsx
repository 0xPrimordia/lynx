import React from 'react';
import { Tooltip } from '@nextui-org/tooltip';
import { FaInfoCircle } from 'react-icons/fa';

interface TippyInfoProps {
  content: string;
  className?: string;
}

export default function TippyInfo({ content, className = '' }: TippyInfoProps) {
  return (
    <Tooltip content={content} placement="top">
      <div className={`inline-flex items-center justify-center ml-2 text-gray-400 hover:text-gray-500 cursor-help ${className}`}>
        <FaInfoCircle size={16} />
      </div>
    </Tooltip>
  );
} 