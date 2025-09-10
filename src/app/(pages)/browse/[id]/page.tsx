// --- FILE: src/app/(pages)/browse/[id]/page.tsx ---

import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { InterviewClientPage } from './_components/interview-client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Info } from 'lucide-react';
// WINNING UI: Import the newly added HoverCard and its parts.
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { StartupFailure } from '@/generated/prisma';
import { ThemeToggle } from '@/components/ThemeToggle';

export const dynamic = 'force-dynamic';

async function getStartupFailure(id: string): Promise<StartupFailure | null> {
  const startupId = Number(id);
  if (isNaN(startupId)) return null;
  return await prisma.startupFailure.findUnique({ where: { id: startupId } });
}

export default async function InterviewPage({ params }: { params: { id: string } }) {
  const startup = await getStartupFailure((await params).id);

  if (!startup) {
    notFound();
  }

  const faviconUrl = startup.sourceUrl ? `https://www.google.com/s2/favicons?sz=64&domain_url=${new URL(startup.sourceUrl).hostname}` : null;

  return (
    <div className="flex flex-col h-screen">
      <nav className="border-b shrink-0 bg-background/80 backdrop-blur-sm z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            {faviconUrl && (
              <Image 
                src={faviconUrl} 
                alt={`${startup.companyName} logo`} 
                width={28} 
                height={28} 
                className="rounded-md shadow-sm bg-white p-0.5 shrink-0"
                unoptimized
              />
            )}
            <div className="flex items-center gap-2 overflow-hidden">
              <h1 className="text-lg font-semibold tracking-tight truncate">{startup.companyName}</h1>
              
              {/* WINNING UI: The HoverCard trigger. It's a subtle, professional way to offer more info. */}
              {/* It signals to the user that there is deeper context available without cluttering the UI. */}
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground shrink-0">
                    <Info className="h-4 w-4" />
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-96" side="bottom" align="start">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-base">Internal Case Study Report</h3>
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <p><strong className="text-foreground">Failure Reason: </strong><Badge variant="destructive">{startup.failureReason || 'N/A'}</Badge></p>
                      <p><strong className="text-foreground">What They Did: </strong>{startup.whatTheyDid || 'N/A'}</p>
                      <p><strong className="text-foreground">What Went Wrong: </strong>{startup.whatWentWrong || 'N/A'}</p>
                      <Separator/>
                      <p><strong className="text-foreground">Key Takeaway: </strong>{startup.keyTakeaway || 'N/A'}</p>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>

            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle/>
            <Button asChild variant="outline">
              <Link href="/browse">Back to Corpus</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">Back to Canvas</Link>
            </Button>
          </div>
        </div>
      </nav>
      
      <InterviewClientPage startup={startup} />
    </div>
  );
}