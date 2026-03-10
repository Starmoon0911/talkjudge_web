'use client'
import { useEffect, useState } from "react";
import api from "../lib/api";
import { IProblem } from "../../interface/IProblem";

type UseProblemsOptions = {
  page?: number;
  limit?: number;
  difficulty?: string;
  tags?: string[];
  search?: string;
  sort?: string;
  id?: string;
};

export default function useProblems(opts: UseProblemsOptions) {
  const [data, setData] = useState<IProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(opts.page ?? 1);
  const [limit, setLimit] = useState(opts.limit ?? 10);

  useEffect(() => {
    let cancelled = false;

    async function fetchProblems() {
      setLoading(true);
      setError(null);

      try {
        const params: Record<string, string | number> = {
          page,
          limit,
        };

        if (opts.id) params.id = opts.id;
        if (opts.difficulty) params.difficulty = opts.difficulty;
        if (opts.tags && opts.tags.length) params.tags = opts.tags.join(",");
        if (opts.search) params.search = opts.search;
        if (opts.sort) params.sort = opts.sort;

        const resp = await api.get("/problems", { params });
        if (cancelled) return;

        setData(resp.data.data);
        setTotal(resp.data.pagination?.total ?? 0);
      } catch (err: unknown) {
        if (cancelled) return;

        const message = err instanceof Error ? err.message : "Fetch error";
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProblems();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, opts.id, opts.difficulty, JSON.stringify(opts.tags), opts.search, opts.sort]);

  return {
    data,
    loading,
    error,
    total,
    page,
    limit,
    setPage,
    setLimit,
    refetch: () => {
      setPage(1);
    },
  };
}
