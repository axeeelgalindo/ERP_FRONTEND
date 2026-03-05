"use client";

import React, { useRef, useState } from "react";

export default function ImportRcvPanel({
  importing,
  importErr,
  importResult,
  onPickFile,
  onImportFile,
  onClear,
}) {
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function pick() {
    fileRef.current?.click();
  }

  return (
    <div className="mb-8">
      <details className="bg-white  rounded-xl border border-slate-200  shadow-sm overflow-hidden group">
        <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50  transition-colors list-none">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 group-open:rotate-180 transition-transform">
              ▾
            </span>
            <span className="font-semibold text-slate-700 ">
              Importar RCV desde el SII
            </span>
          </div>
          <span className="text-xs text-slate-400 uppercase font-bold tracking-widest px-2 py-1 bg-slate-100  rounded">
            SUBIR CSV
          </span>
        </summary>

        <div className="p-6 border-t border-slate-100 ">
          {importErr ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {importErr}
            </div>
          ) : null}

          {importResult ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Importación OK:{" "}
              <b>
                {importResult?.insertados ??
                  importResult?.created ??
                  importResult?.ok ??
                  "OK"}
              </b>
              {importResult?.skipped != null ? (
                <>
                  {" "}
                  · Saltados: <b>{importResult.skipped}</b>
                </>
              ) : null}
            </div>
          ) : null}

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) {
                onPickFile?.(f);
                onImportFile?.(f);
              }
            }}
          />

          <div
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-colors ${
              dragOver
                ? "border-primary/60 bg-slate-50 "
                : "border-slate-200  bg-slate-50/50 "
            }`}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) onImportFile?.(f);
            }}
          >
            <div className="bg-white  p-4 rounded-full shadow-sm mb-4 border border-slate-100 ">
              <span className="text-primary text-3xl">☁️</span>
            </div>

            <h3 className="text-lg font-semibold mb-1 text-slate-900 ">
              Arrastra un archivo CSV aquí
            </h3>
            <p className="text-sm text-slate-500  mb-6 max-w-sm">
              Tip: si importas el mismo documento (proveedor + folio), el sistema
              lo marcará automáticamente como duplicado/saltado.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={pick}
                disabled={importing}
                className="px-5 py-2 border border-slate-200  rounded-lg hover:bg-white -700 font-medium disabled:opacity-60"
              >
                Seleccionar
              </button>

              <button
                type="button"
                onClick={pick}
                disabled={importing}
                className="px-5 py-2 bg-slate-900  text-white  rounded-lg hover:opacity-90 font-medium disabled:opacity-60"
              >
                {importing ? "Importando…" : "Importar"}
              </button>

              <button
                type="button"
                onClick={onClear}
                className="px-5 py-2 border border-slate-200  rounded-lg hover:bg-white -700 font-medium"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}