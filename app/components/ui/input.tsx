import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ElementType; // Icon component type
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon: Icon, className = '', type = 'text', ...props }, ref) => {
    const baseStyle = "block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 sm:text-sm transition-colors duration-200";
    const borderStyle = error
      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
      : 'border-gray-300 dark:border-gray-600 focus:ring-primary dark:focus:ring-primary-dark focus:border-primary dark:focus:border-primary-dark';
    const bgStyle = "bg-white dark:bg-gray-800 text-text dark:text-text-dark placeholder-gray-400 dark:placeholder-gray-500";
    const iconPadding = Icon ? 'pl-10' : '';

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={props.id || props.name} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label}
          </label>
        )}
        <div className="relative rounded-md shadow-sm">
           {Icon && (
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
               <Icon className="h-5 w-5 text-gray-400" aria-hidden="true" />
             </div>
           )}
           <input
             type={type}
             ref={ref}
             className={`${baseStyle} ${borderStyle} ${bgStyle} ${iconPadding} ${className}`}
             {...props}
           />
        </div>
        {error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input'; // Add display name for React DevTools

export default Input;
