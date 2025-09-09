// --- FILE: src/components/FaviconLink.tsx ---
'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { LinkIcon } from 'lucide-react';

interface FaviconLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
}

export const FaviconLink: React.FC<FaviconLinkProps> = ({ href, children, className, ...props }) => {
  let faviconUrl: string | null = null;
  let displayHostname: string | null = null;

  try {
    // This robustly handles the URL parsing.
    const url = new URL(href);
    displayHostname = url.hostname;
    faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain_url=${displayHostname}`;
  } catch (error) {
    // If the URL is invalid, we'll gracefully fall back.
    console.warn(`Invalid URL for FaviconLink: ${href}`);
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 font-medium text-blue-500 hover:underline decoration-amber-500/50 transition-all",
        className
      )}
      {...props}
    >
      {faviconUrl ? (
        <Image
          src={faviconUrl}
          alt={displayHostname ? `${displayHostname} favicon` : 'Link favicon'}
          width={16}
          height={16}
          className="flex-shrink-0 rounded-sm"
          unoptimized // Google's favicon service doesn't need Next.js image optimization
        />
      ) : (
        // Fallback icon for invalid or missing URLs
        <LinkIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      )}
      <span>{children}</span>
    </a>
  );
};