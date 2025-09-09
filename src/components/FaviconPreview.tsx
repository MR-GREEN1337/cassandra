// src/components/FaviconPreview.tsx
import React from 'react';
import Image from 'next/image';

interface FaviconPreviewProps {
  url: string;
}

export const FaviconPreview: React.FC<FaviconPreviewProps> = ({ url }) => {
  try {
    const hostname = new URL(url).hostname;
    const faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain_url=${hostname}`;
    return (
      <Image
        src={faviconUrl}
        alt={`${hostname} favicon`}
        width={16}
        height={16}
        className="rounded-sm"
        unoptimized
      />
    );
  } catch (error) {
    // Return a default or null if the URL is invalid
    return null;
  }
};