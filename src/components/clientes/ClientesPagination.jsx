// src/components/clientes/ClientesPagination.jsx
"use client";

import { ChevronLeft } from "@mui/icons-material";
import { ChevronRight } from "lucide-react";

export default function ClientesPagination({ page, totalPages, onPageChange }) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const go = (p) => {
    const np = Math.max(1, Math.min(totalPages, p));
    onPageChange?.(np);
  };

  // Simple: 1 2 3 ... N (similar a la referencia)
  const pages = [];
  for (let i = 1; i <= Math.min(3, totalPages); i++) pages.push(i);
  const tail = totalPages > 3 ? totalPages : null;

  return (
    <div className="flex items-center gap-2">
      <button
        className="p-2 border border-slate-300  rounded-lg hover:bg-white  transition-colors disabled:opacity-50"
        disabled={!canPrev}
        onClick={() => go(page - 1)}
        type="button"
      >
        <ChevronLeft fontSize="small"/>
      </button>

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => go(p)}
          type="button"
          className={
            p === page
              ? "px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium"
              : "px-4 py-1.5 hover:bg-slate-200  rounded-lg text-sm font-medium transition-colors"
          }
        >
          {p}
        </button>
      ))}

      {tail && totalPages > 4 ? (
        <>
          <span className="px-2 text-slate-400">...</span>
          <button
            onClick={() => go(tail)}
            type="button"
            className={
              tail === page
                ? "px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium"
                : "px-4 py-1.5 hover:bg-slate-200  rounded-lg text-sm font-medium transition-colors"
            }
          >
            {tail}
          </button>
        </>
      ) : null}

      <button
        className="p-2 border border-slate-300  rounded-lg hover:bg-white  transition-colors disabled:opacity-50"
        disabled={!canNext}
        onClick={() => go(page + 1)}
        type="button"
      >
        <ChevronRight fontSize="small"/>
      </button>
    </div>
  );
}
