"use client";

import { useRef } from "react";
import { logoSrc } from "../utils";

function Field({
  label,
  value,
  onChange,
  type = "text",
  textarea,
  placeholder,
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {label}
      </label>

      {textarea ? (
        <textarea
          className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all resize-none py-2 px-4"
          rows={4}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          type={type}
          className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all py-2 px-4"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

export default function StepDatos({ editing, setEditing, saving }) {
  const fileRef = useRef(null);
  const update = (k, v) => setEditing((p) => ({ ...p, [k]: v }));

  function onPickFile(e) {
    const f = e.target.files?.[0] || null;
    if (!f) return;
    const preview = URL.createObjectURL(f);
    setEditing((prev) => ({
      ...prev,
      _logoFile: f,
      _logoPreview: preview,
    }));
  }

  const preview = editing?._logoPreview
    ? editing._logoPreview
    : editing?.logo_url
      ? logoSrc(editing.logo_url)
      : "";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Nombre del Cliente "
          value={editing.nombre}
          onChange={(v) => update("nombre", v)}
          placeholder="Ej. Constructora Delta S.A."
        />
        <Field
          label="RUT Empresa "
          value={editing.rut}
          onChange={(v) => update("rut", v)}
          placeholder="77.123.456-k"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Correo Electrónico"
          type="email"
          value={editing.correo}
          onChange={(v) => update("correo", v)}
          placeholder="contacto@empresa.cl"
        />
        <Field
          label="Teléfono"
          type="tel"
          value={editing.telefono}
          onChange={(v) => update("telefono", v)}
          placeholder="+56 9 1234 5678"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-7">
          <Field
            label="Notas Adicionales"
            textarea
            value={editing.notas}
            onChange={(v) => update("notas", v)}
            placeholder="Observaciones sobre el cliente, facturación o condiciones especiales..."
            
          />
        </div>

        <div className="md:col-span-5 space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Logo del Cliente
          </label>

          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center gap-3 bg-slate-50/50 dark:bg-slate-800/30 min-h-[180px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-16 h-16 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-600 overflow-hidden">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt="logo"
                  src={preview}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="material-icons-outlined text-slate-400 text-3xl">
                  image
                </span>
              )}
            </div>

            <div className="text-center">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                PNG o JPG (máx. 5MB)
              </p>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileRef.current?.click();
                }}
                disabled={saving}
                className="mt-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
              >
                Subir logo
              </button>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
            disabled={saving}
          />
        </div>
      </div>
    </div>
  );
}
