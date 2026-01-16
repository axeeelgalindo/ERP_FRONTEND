"use client";

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  className = "",
}) {
  if (totalPages <= 1) return null;

  const goto = (p) => () => onPageChange(Math.min(Math.max(1, p), totalPages));

  const makePages = () => {
    const pages = [];
    const maxButtons = 5; // simple y compacto
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    // 1 … (page-1) page (page+1) … total
    pages.push(1);
    if (page > 3) pages.push("…");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <button
        onClick={goto(page - 1)}
        className="px-3 py-2 text-sm rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
        disabled={page <= 1}
      >
        Anterior
      </button>

      <div className="flex items-center gap-1">
        {makePages().map((p, i) =>
          p === "…" ? (
            <span key={`dots-${i}`} className="px-2 text-gray-400 select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={goto(p)}
              className={[
                "px-3 py-2 text-sm rounded-lg border",
                p === page
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white hover:bg-gray-50",
              ].join(" ")}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          )
        )}
      </div>

      <button
        onClick={goto(page + 1)}
        className="px-3 py-2 text-sm rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
        disabled={page >= totalPages}
      >
        Siguiente
      </button>
    </div>
  );
}
