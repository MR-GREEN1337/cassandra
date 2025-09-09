// --- FILE: src/app/(pages)/browse/page.tsx ---

import prisma from '@/lib/prisma';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchInput } from './_components/search-input';
// WINNING STRATEGY: We import our new Client Component here.
import { FailureCard } from './_components/failure-card';
import Logo from '@/components/Logo';

const ITEMS_PER_PAGE = 12;

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string };
}) {
  const page = Number(searchParams.page) || 1;
  const searchQuery = searchParams.q || '';

  const whereClause = searchQuery 
    ? {
        OR: [
          { companyName: { contains: searchQuery, mode: 'insensitive' } },
          { failureReason: { contains: searchQuery, mode: 'insensitive' } },
          { keyTakeaway: { contains: searchQuery, mode: 'insensitive' } },
        ],
      }
    : {};

  const failures = await prisma.startupFailure.findMany({
    where: whereClause,
    take: ITEMS_PER_PAGE,
    skip: (page - 1) * ITEMS_PER_PAGE,
    orderBy: {
      id: 'desc', // Show most recently added first
    },
  });

  const totalCount = await prisma.startupFailure.count({ where: whereClause });
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <>
      {/* WINNING UI: This page now defines its own header, ensuring consistency where needed. */}
      <nav className="border-b sticky top-0 bg-background/80 backdrop-blur-sm z-20">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Logo />
          <Button asChild>
            <Link href="/dashboard">Back to Canvas</Link>
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tighter">Failure Corpus</h1>
          <p className="text-muted-foreground mt-2">
            An browsable archive of {totalCount} startup post-mortems. Click any case to start an AI-powered interview.
          </p>
        </header>

        <div className="mb-6">
          <SearchInput placeholder="Search by company, reason, or takeaway..." />
        </div>

        {failures.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-lg text-muted-foreground">No results found for your query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {failures.map((failure) => (
              <FailureCard key={failure.id} failure={failure} />
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-4 mt-12">
          <Button asChild variant="outline" disabled={page <= 1}>
            <Link href={`/browse?page=${page - 1}&q=${searchQuery}`}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Previous
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button asChild variant="outline" disabled={page >= totalPages}>
            <Link href={`/browse?page=${page + 1}&q=${searchQuery}`}>
              Next <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}