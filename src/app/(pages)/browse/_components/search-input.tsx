'use client';

import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function SearchInput({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [value, setValue] = useState(initialQuery);
  const debouncedValue = useDebounce(value, 500);

  useEffect(() => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    const currentQueryInUrl = current.get('q') || '';

    // If the search term hasn't changed, do nothing.
    // This is the critical guard that prevents this effect from running during pagination.
    if (debouncedValue === currentQueryInUrl) {
      return;
    }

    // If we're here, the user has typed a new search.
    // We should build the new URL and reset the page.
    if (!debouncedValue) {
      current.delete('q');
    } else {
      current.set('q', debouncedValue);
    }
    // Always reset to page 1 when the search query *actually* changes.
    current.set('page', '1');

    const search = current.toString();
    const query = search ? `?${search}` : '';

    router.push(`/browse${query}`);
  }, [debouncedValue, router, searchParams]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-10"
      />
    </div>
  );
}