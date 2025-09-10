// src/app/(pages)/browse/_components/failure-card.tsx
'use client';

import Link from 'next/link';
// --- MODIFICATION START: Import the Image component ---
import Image from 'next/image';
// --- MODIFICATION END ---
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, MessageSquareText } from 'lucide-react';
import { StartupFailure } from '@/generated/prisma';

interface FailureCardProps {
  failure: StartupFailure;
}

export function FailureCard({ failure }: FailureCardProps) {
  const handleSourceClick = (e: React.MouseEvent) => {
    // Prevent the parent Link from navigating
    e.stopPropagation();
    e.preventDefault();
    window.open(failure.sourceUrl!, '_blank', 'noopener,noreferrer');
  };

  // --- MODIFICATION START: Add favicon logic ---
  let faviconUrl = null;
  if (failure.sourceUrl) {
    try {
      const hostname = new URL(failure.sourceUrl).hostname;
      faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain_url=${hostname}`;
    } catch (error) {
      console.error("Invalid source URL for favicon:", failure.sourceUrl);
      // faviconUrl remains null
    }
  }
  // --- MODIFICATION END ---

  return (
    // The "passHref" prop is good practice but not strictly required in newer Next.js versions.
    // It ensures the <a> tag gets the href.
    <Link href={`/browse/${failure.id}`} className="block group" passHref>
      <Card className="flex flex-col h-full transition-all duration-200 group-hover:border-primary group-hover:shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">{failure.companyName}</CardTitle>
          {failure.failureReason && (
            <CardDescription>
              <Badge variant="secondary">{failure.failureReason}</Badge>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex-grow">
          <p className="text-sm text-muted-foreground">{failure.keyTakeaway}</p>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          {failure.sourceUrl && (
            <Button
              variant="link"
              size="sm"
              className="text-blue-500 hover:underline h-auto p-0 z-10 relative flex items-center gap-1.5"
              onClick={handleSourceClick}
            >
              {/* --- MODIFICATION START: Conditionally render the favicon --- */}
              {faviconUrl && (
                <Image
                  src={faviconUrl}
                  alt={`${new URL(failure.sourceUrl).hostname} favicon`}
                  width={16}
                  height={16}
                  className="flex-shrink-0 rounded-sm"
                  unoptimized
                />
              )}
              {/* --- MODIFICATION END --- */}
              Source <ExternalLink className="h-4 w-4 ml-1" />
            </Button>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            Interview <MessageSquareText className="h-3 w-3" />
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}