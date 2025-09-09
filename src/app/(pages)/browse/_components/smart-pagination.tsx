import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  searchQuery: string;
}

export function SmartPagination({ currentPage, totalPages, searchQuery }: PaginationProps) {
  const generatePageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    
    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage <= 4) {
        // Show 1, 2, 3, 4, 5, ..., last
        for (let i = 2; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Show 1, ..., last-4, last-3, last-2, last-1, last
        pages.push('ellipsis');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Show 1, ..., current-1, current, current+1, ..., last
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const pageNumbers = generatePageNumbers();

  const createPageUrl = (page: number) => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    if (searchQuery) params.set('q', searchQuery);
    return `/browse?${params.toString()}`;
  };

  return (
    <nav className="flex items-center justify-center gap-2 mt-12" aria-label="Pagination">
      {/* Previous Button */}
      <Button
        asChild
        variant="outline"
        size="sm"
        disabled={currentPage <= 1}
        className={cn(
          "transition-all duration-200",
          currentPage <= 1 
            ? "opacity-50 cursor-not-allowed" 
            : "hover:bg-primary hover:text-primary-foreground hover:scale-105"
        )}
      >
        {currentPage <= 1 ? (
          <span className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Prev
          </span>
        ) : (
          <Link href={createPageUrl(currentPage - 1)} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Prev
          </Link>
        )}
      </Button>

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {pageNumbers.map((page, index) => {
          if (page === 'ellipsis') {
            return (
              <div key={`ellipsis-${index}`} className="px-3 py-2">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground animate-pulse" />
              </div>
            );
          }

          const isActive = page === currentPage;
          
          return (
            <Button
              key={page}
              asChild={!isActive}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              className={cn(
                "min-w-10 transition-all duration-200 relative overflow-hidden",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-lg scale-110 z-10" 
                  : "hover:bg-muted hover:scale-105",
                // Add a subtle glow effect for the active page
                isActive && "shadow-primary/25"
              )}
              disabled={isActive}
            >
              {isActive ? (
                <span className="relative">
                  {page}
                  {/* Animated background for active state */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shimmer" />
                </span>
              ) : (
                <Link href={createPageUrl(page)}>
                  {page}
                </Link>
              )}
            </Button>
          );
        })}
      </div>

      {/* Next Button */}
      <Button
        asChild
        variant="outline"
        size="sm"
        disabled={currentPage >= totalPages}
        className={cn(
          "transition-all duration-200",
          currentPage >= totalPages 
            ? "opacity-50 cursor-not-allowed" 
            : "hover:bg-primary hover:text-primary-foreground hover:scale-105"
        )}
      >
        {currentPage >= totalPages ? (
          <span className="flex items-center gap-2">
            Next <ArrowRight className="h-4 w-4" />
          </span>
        ) : (
          <Link href={createPageUrl(currentPage + 1)} className="flex items-center gap-2">
            Next <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </Button>

      {/* Page Info */}
      <div className="ml-4 text-sm text-muted-foreground hidden sm:block">
        <span className="font-medium">{currentPage}</span>
        <span className="mx-1">/</span>
        <span>{totalPages}</span>
      </div>
    </nav>
  );
}