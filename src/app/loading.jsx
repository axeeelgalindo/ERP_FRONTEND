export default function GlobalLoading() {
  return (
    <div className="fixed inset-0 z-9999 bg-white/80 backdrop-blur-sm flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-gray-700">
        <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
        </svg>
        <span className="text-sm font-medium">Cargando…</span>
      </div>
    </div>
  );
}
