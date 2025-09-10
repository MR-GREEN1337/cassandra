// src/app/(pages)/browse/page.tsx (FINAL CORRECTED VERSION)
import prisma from '@/lib/prisma';
import { SearchInput } from './_components/search-input';
import { FailureCard } from './_components/failure-card';
import { SmartPagination } from './_components/smart-pagination';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const ITEMS_PER_PAGE = 12;

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string };
}) {
  const page = Number((await searchParams).page) || 1;
  const searchQuery = (await searchParams).q || '';

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
      id: 'desc',
    },
  });

  const totalCount = await prisma.startupFailure.count({ where: whereClause });
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <>
      <nav className="border-b sticky top-0 bg-background/80 backdrop-blur-sm z-20">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Logo />
          <Button asChild>
            <Link href="/dashboard">Back to Canvas</Link>
          </Button>
        </div>
      </nav>
      <div className="container mx-auto px-4 py-8">

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
              // Using the corrected card component
              <FailureCard key={failure.id} failure={failure} />
            ))}
          </div>
        )}

        {/* Using your superior SmartPagination component */}
        {totalPages > 1 && (
          <SmartPagination
            currentPage={page}
            totalPages={totalPages}
            searchQuery={searchQuery}
          />
        )}
      </div>
    </>
  );
}