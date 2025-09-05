// src/components/CassandraLogo.tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface CassandraLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export const CassandraLogo: React.FC<CassandraLogoProps> = ({ className, ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={cn('h-6 w-6', className)}
      {...props}
    >
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* The outer 'C' shape representing foresight and analysis */}
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        {/* The inner 'spark of insight' */}
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
};

export default CassandraLogo;