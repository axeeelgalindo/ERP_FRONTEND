"use client";

import React, { useMemo } from "react";

function rangePages(current, total) {
  // estilo: 1 2 3 ... last (como tu mock)
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const out = [1];
  if (current > 3) out.push("…");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let p = start; p <= end; p++) out.push(p);

  if (current < total - 2) out.push("…");
  out.push(total);

  // dedupe de “…” seguidos
  const cleaned = [];
  for (const x of out) {
    if (x === "…" && cleaned[cleaned.length - 1] === "…") continue;
    cleaned.push(x);
  }
  return cleaned;
}

export default function ComprasPagination({
  loading,
  page,
  pageSize,
  total,
  onPrev,
  onNext,
  onGo,
}) {
  const totalPages = useMemo(() => {
    const t = Number(total || 0);
    const s = Number(pageSize || 20);
    if (!t || !s) return 1;
    return Math.max(1, Math.ceil(t / s));
  }, [total, pageSize]);

  const pages = useMemo(
    () => rangePages(page, totalPages),
    [page, totalPages],
  );

  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = total ? Math.min(total, page * pageSize) : 0;

  return (
    <div className="px-6 py-4 border-t border-slate-100  flex flex-col sm:flex-row items-center justify-between gap-4">
      <span className="text-sm text-slate-500  ">
        Mostrando{" "}
        <span className="font-medium text-slate-900  ">
          {from} a {to}
        </span>{" "}
        de{" "}
        <span className="font-medium text-slate-900  ">
          {total ?? 0}
        </span>{" "}
        registros
      </span>

      <div className="flex items-center gap-2">
        <button
          className="px-3 py-1.5 text-sm border border-slate-200     rounded-lg hover:bg-slate-50  disabled:opacity-50 transition-all flex items-center gap-1"
          disabled={loading || page <= 1}
          onClick={onPrev}
          type="button"
        >
          <span className="text-[18px]">‹</span>
          Anterior
        </button>

        <div className="flex items-center">
          {pages.map((p, i) =>
            p === "…" ? (
              <span key={`dots-${i}`} className="mx-1 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onGo?.(p)}
                className={
                  p === page
                    ? "w-8 h-8 flex items-center justify-center text-sm font-bold bg-primary text-white rounded-md"
                    : "w-8 h-8 flex items-center justify-center text-sm font-medium text-slate-600  hover:bg-slate-100  rounded-md"
                }
                disabled={loading}
              >
                {p}
              </button>
            ),
          )}
        </div>

        <button
          className="px-3 py-1.5 text-sm border border-slate-200     rounded-lg hover:bg-slate-50  disabled:opacity-50 transition-all flex items-center gap-1"
          disabled={loading || page >= totalPages}
          onClick={onNext}
          type="button"
        >
          Siguiente
          <span className="text-[18px]">›</span>
        </button>
      </div>
    </div>
  );
}