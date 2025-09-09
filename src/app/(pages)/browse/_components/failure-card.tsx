// --- FILE: src/app/(pages)/browse/_components/failure-card.tsx ---
'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, MessageSquareText } from 'lucide-react';
import { StartupFailure } from '@prisma/client';
// WINNING DETAIL: Import the new reusable component.
import { FaviconLink } from '@/components/FaviconLink';

interface FailureCardProps {
  failure: StartupFailure;
}

export function FailureCard({ failure }: FailureCardProps) {
  return (
    <Link href={`/browse/${failure.id}`} className="block group">
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
            // WINNING DETAIL: Use the FaviconLink component here for a polished, consistent look.
            <FaviconLink
              href={failure.sourceUrl}
              onClick={(e) => e.stopPropagation()}
              className="text-sm z-10" // Ensure it's clickable above the main Link
            >
              Source
              <ExternalLink className="h-4 w-4" />
            </FaviconLink>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            Interview <MessageSquareText className="h-3 w-3" />
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}