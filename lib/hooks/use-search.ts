import { useQuery } from "@tanstack/react-query";
import { searchApi } from "@/lib/api/search";
import type { SearchRequest } from "@/types/api";

export function useSearch(params: SearchRequest | null) {
  return useQuery({
    queryKey: ["search", params],
    queryFn: () => searchApi.search(params as SearchRequest),
    enabled: !!params && params.query.length > 0,
    staleTime: 30_000,
  });
}
