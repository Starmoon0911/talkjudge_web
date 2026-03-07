import { useEffect, useRef, useState } from "react";
import api from "../lib/api";

export default function useInfiniteProblems(options: { limit?: number; difficulty?: string; tags?: string[]; search?: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // reset when filters change
    setItems([]);
    setPage(1);
    setHasMore(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.difficulty, JSON.stringify(options.tags), options.search]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!hasMore) return;
      setLoading(true);
      try {
        const params: any = { page, limit: options.limit ?? 10 };
        if (options.difficulty) params.difficulty = options.difficulty;
        if (options.tags && options.tags.length) params.tags = options.tags.join(",");
        if (options.search) params.search = options.search;

        const resp = await api.get("/problems", { params });
        if (cancelled) return;
        const data = resp.data.data;
        setItems((prev) => [...prev, ...data]);
        const total = resp.data.pagination?.total ?? 0;
        if ((page * params.limit) >= total) setHasMore(false);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [page, options.limit, options.difficulty, JSON.stringify(options.tags), options.search, hasMore]);

  const loadMore = () => {
    if (!loading && hasMore) setPage((p) => p + 1);
  };

  return { items, loading, hasMore, loadMore, setPage, setHasMore };
}