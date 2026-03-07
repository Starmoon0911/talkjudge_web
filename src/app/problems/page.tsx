'use client'
import React, { useState } from "react";
import useDebounce from "../../hooks/useDebounce";
import useProblems from "../../hooks/useProblems";

export default function ProblemsPage() {
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 400);

    const [difficulty, setDifficulty] = useState<string | undefined>(undefined);
    const [page, setPage] = useState(1);

    const { data, loading, total, limit, setPage: setHookPage } = useProblems({
        page,
        limit: 10,
        difficulty,
        search: debouncedSearch,
    });
    React.useEffect(() => {
        setHookPage(page);
    }, [page, setHookPage]);

    const totalPages = Math.ceil(total / 10);

    const getDifficultyBadge = (diff: string) => {
        switch (diff?.toLowerCase()) {
            case "easy":
                return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30";
            case "medium":
                return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30";
            case "hard":
                return "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30";
            default:
                return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
        }
    };

    const getDifficultyHoverBorder = (diff: string) => {
        switch (diff?.toLowerCase()) {
            case "easy": return "hover:border-emerald-500";
            case "medium": return "hover:border-amber-500";
            case "hard": return "hover:border-rose-500";
            default: return "hover:border-blue-500";
        }
    };

    const getAcceptanceColor = (rate: number) => {
        if (rate >= 60) return "text-emerald-600 dark:text-emerald-400";
        if (rate >= 40) return "text-amber-600 dark:text-amber-400";
        return "text-rose-600 dark:text-rose-400";
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-950 font-display dark:text-slate-100 min-h-screen text-slate-900 transition-colors duration-300">
            <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden">
                <div className="layout-container flex h-full grow flex-col">
                    <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 md:px-20 py-4 sticky top-0 z-50 shadow-sm">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black leading-tight tracking-tight  bg-clip-text">
                                TalkJudge
                            </h2>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="hidden sm:block">
                                <label className="relative block group">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 transition-colors group-focus-within:text-blue-500">
                                        <span className="material-symbols-outlined text-xl">search</span>
                                    </span>
                                    <input
                                        value={search}
                                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                        className="w-64 bg-slate-100 dark:bg-slate-800/50 border border-transparent rounded-lg py-2.5 pl-10 pr-4 text-sm focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                        placeholder="Search problems..."
                                    />
                                </label>
                            </div>
                        </div>
                    </header>

                    <main className="flex-1 max-w-7xl mx-auto w-full px-6 md:px-20 py-10">
                        <div className="mb-10 flex items-end justify-between">
                            <div>
                                <h1 className="text-4xl font-black leading-tight tracking-tight mb-2 text-slate-900 dark:text-white">
                                    Problem List
                                </h1>
                                <p className="text-slate-500 dark:text-slate-400">Enhance your logic, one algorithm at a time.</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3 mb-8">
                            <button onClick={() => { setDifficulty(undefined); setPage(1); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${!difficulty ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
                                <span>All Topics</span>
                            </button>
                            <button onClick={() => { setDifficulty("easy"); setPage(1); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${difficulty === "easy" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
                                <span>Easy</span>
                            </button>
                            <button onClick={() => { setDifficulty("medium"); setPage(1); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${difficulty === "medium" ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" : "bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
                                <span>Medium</span>
                            </button>
                            <button onClick={() => { setDifficulty("hard"); setPage(1); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${difficulty === "hard" ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30" : "bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
                                <span>Hard</span>
                            </button>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl shadow-slate-200/20 dark:shadow-black/40">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                                            <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                                            <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Title</th>
                                            <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Difficulty</th>
                                            <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Acceptance</th>
                                            <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                        {loading ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading problems...</td></tr>
                                        ) : data.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">No problems found matching your criteria.</td></tr>
                                        ) : (
                                            data.map((p, idx) => (
                                                <tr key={p.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group border-l-4 border-transparent ${getDifficultyHoverBorder(p.difficulty)}`}>
                                                    <td className="px-6 py-5">
                                                        <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors">radio_button_unchecked</span>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <a className="text-slate-800 dark:text-slate-200 font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors" href={`/problems/${p.id}`}>
                                                            {p.title}
                                                        </a>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getDifficultyBadge(p.difficulty)}`}>
                                                            {p.difficulty}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <span className={`font-semibold text-sm ${getAcceptanceColor(p.acceptance ?? 0)}`}>
                                                            {(p.acceptance ?? 0).toFixed(1)}%
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <button className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-bold opacity-0 group-hover:opacity-100 transition-all transform scale-95 group-hover:scale-100 shadow-md shadow-blue-500/20">
                                                            Solve
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex items-center justify-center mt-10 gap-2">
                            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="text-slate-400 hover:text-blue-500 disabled:opacity-50 disabled:hover:text-slate-400 p-1 flex items-center transition-colors">
                                <span className="material-symbols-outlined">chevron_left</span>
                            </button>

                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const pageNum = i + 1;
                                return (
                                    <button key={pageNum} onClick={() => setPage(pageNum)}
                                        className={`h-9 w-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${page === pageNum
                                            ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                                            }`}>
                                        {pageNum}
                                    </button>
                                );
                            })}

                            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="text-slate-400 hover:text-blue-500 disabled:opacity-50 disabled:hover:text-slate-400 p-1 flex items-center transition-colors">
                                <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                        </div>
                    </main>

                    <footer className="border-t border-slate-200 dark:border-slate-800/50 py-10 px-6 md:px-20 text-center">
                        <p className="text-slate-400 dark:text-slate-500 text-sm">© 2026 Talk Judge. Master your future one line at a time.</p>
                    </footer>
                </div>
            </div>
        </div>
    );
}