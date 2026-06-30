import { api } from "@/lib/api/client";
import type { SearchRequest, SearchResponse } from "@/types/api";

export const searchApi = {
  search: (data: SearchRequest) => api.post<SearchResponse>("/search", data),
};
