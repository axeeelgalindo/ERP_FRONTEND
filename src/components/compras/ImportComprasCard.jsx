"use client";

import { useRef, useState } from "react";

function clsx(...arr) {
  return arr.filter(Boolean).join(" ");
}

function ResultPill({ label, value, tone }) {
  const tones = {
    ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
    warn: "bg-amber-50 text-amber-800 border-amber-200",
    err: "bg-red-50 text-red-800 border-red-200",
    slate: "bg-slate-50 text-slate-800 border-slate-200",
  };

  return (
    <div className={clsx("rounded-xl border px-3 py-2", tones[tone] || tones.slate)}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

export default function ImportComprasCard({
  importing,
  importErr,
  importResult,
  onImport,
  onClearResult,
}) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");

  const pickFile = () => inputRef.current?.click();

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    onClearResult?.();
    await onImport(file);
  };

  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="p-5 border-b">
        <h2 className="text-base font-semibold">Importar CSV (RCV)</h2>
        <p className="mt-1 text-sm text-slate-500">
          Sube el CSV exportado desde el SII. No necesitas mapear columnas manualmente.
        </p>
      </div>

      <div className="p-5 space-y-4">
        <div
          className={clsx(
            "rounded-2xl border-2 border-dashed p-4 transition",
            "hover:bg-slate-50",
            importing && "opacity-70"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-lg">📄</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Arrastra un CSV aquí o selecciónalo</div>
              <div className="text-xs text-slate-500 mt-1">
                Formato esperado: CSV con separador <b>;</b> y columnas RCV.
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50"
                  onClick={pickFile}
                  disabled={importing}
                >
                  Seleccionar CSV
                </button>

                <button
                  className="h-9 rounded-lg bg-slate-900 px-3 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                  onClick={() => inputRef.current?.files?.[0] && handleFile(inputRef.current.files[0])}
                  disabled={importing || !fileName}
                  title={!fileName ? "Selecciona un archivo" : "Importar"}
                >
                  {importing ? "Importando…" : "Importar"}
                </button>
              </div>

              {fileName ? (
                <div className="mt-2 text-xs text-slate-600">
                  Archivo: <b>{fileName}</b>
                </div>
              ) : null}
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
        </div>

        {importErr ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {importErr}
          </div>
        ) : null}

        {importResult ? (
          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-semibold">✅ Importación terminada</div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <ResultPill tone="slate" label="Total filas" value={importResult.totalRows ?? 0} />
              <ResultPill tone="ok" label="Creadas" value={importResult.created ?? 0} />
              <ResultPill tone="warn" label="Saltadas" value={importResult.skipped ?? 0} />
              <ResultPill tone={importResult.errorsCount ? "err" : "ok"} label="Errores" value={importResult.errorsCount ?? 0} />
            </div>

            {Array.isArray(importResult.errors) && importResult.errors.length > 0 ? (
              <div className="mt-3">
                <div className="text-xs font-semibold text-slate-700">Primeros errores:</div>
                <ul className="mt-2 space-y-1 text-xs text-slate-700">
                  {importResult.errors.slice(0, 6).map((e, idx) => (
                    <li key={idx} className="rounded-lg border bg-white p-2">
                      <b>Fila {e.row}</b>: {e.msg}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border bg-white p-4 text-xs text-slate-600">
            Tip: si vuelves a importar el mismo documento (mismo proveedor + tipo doc + folio), se marcará como <b>saltado</b>.
          </div>
        )}
      </div>
    </div>
  );
}
