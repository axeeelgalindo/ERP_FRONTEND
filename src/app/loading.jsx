import Image from "next/image";

export default function GlobalLoading() {
  return (
    <div className="fixed inset-0 z-9999 bg-white/85 backdrop-blur-sm flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-gray-700">
        <div className="relative flex items-center justify-center p-3 rounded-2xl bg-white shadow-sm border border-slate-100 animate-pulse">
          <Image
            src="/Logo_blue.webp"
            alt="Logo Blue Ingeniería"
            width={140}
            height={38}
            className="h-9 w-auto object-contain"
            priority
          />
        </div>
        <div className="flex items-center gap-2">
          <svg className="animate-spin text-blue-600" width="20" height="20" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
          </svg>
          <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Cargando sistema…</span>
        </div>
      </div>
    </div>
  );
}
