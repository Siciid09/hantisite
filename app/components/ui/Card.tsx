import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string; // Optional title for the card
}

const Card: React.FC<CardProps> = ({ children, className = '', title }) => {
  return (
    <div
      className={`bg-sidebar dark:bg-sidebar-dark rounded-lg shadow-sm dark:shadow-md dark:shadow-gray-800 overflow-hidden ${className}`}
    >
      {title && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-text dark:text-text-dark">{title}</h3>
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};

export default Card;
