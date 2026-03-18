"use client";

import React, { useState } from "react";
import ModalBase from "./ModalBase";

export default function QuickProveedorModal({
  open,
  onClose,
  onSubmit,
  creating,
  error,
}) {
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [correo, setCorreo] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSubmit({ nombre, rut, correo });
    // Reset internal state after submit (logic usually handled by parent if needed, but safe here)
  };

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      title="" // Custom header used instead
      hideHeader={true}
      className="max-w-2xl"
    >
      {/* Material Symbols Link */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />

      {/* Header Section */}
      <div className="px-8 py-6 border-b border-slate-100">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-[#1e3a8a] bg-[#1e3a8a]/10 p-2 rounded-lg">
            person_add
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Agregar Proveedor</h1>
        </div>
        <p className="text-slate-500 text-sm">
          Registre un nuevo proveedor rápidamente en el sistema.
        </p>
      </div>

      {error && (
        <div className="mx-8 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Form Body */}
      <form className="p-8" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">
              Nombre / Razón Social *
            </label>
            <div className="relative">
              <input
                autoFocus
                className="w-full h-12 px-10 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] transition-all text-sm"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Constructora Alfa S.A."
                required
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">
                business
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">
              RUT (Opcional)
            </label>
            <div className="relative">
              <input
                className="w-full h-12 px-10 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] transition-all text-sm"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                placeholder="Ej: 76.123.456-7"
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">
                id_card
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">
              Correo Electrónico (Opcional)
            </label>
            <div className="relative">
              <input
                type="email"
                className="w-full h-12 px-10 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] transition-all text-sm"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="proveedor@ejemplo.com"
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">
                mail
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
          <button
            className="w-full sm:w-auto px-8 py-3 rounded-lg text-slate-600 font-semibold hover:bg-slate-200 transition-colors"
            type="button"
            onClick={onClose}
            disabled={creating}
          >
            Cancelar
          </button>
          <button
            className="w-full sm:w-auto px-10 py-3 rounded-lg bg-[#1e3a8a] text-white font-bold shadow-lg shadow-blue-900/20 hover:bg-[#1e3a8a]/90 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
            type="submit"
            disabled={creating || !nombre.trim()}
          >
            <span className="material-symbols-outlined text-xl">
              {creating ? "sync" : "save"}
            </span>
            {creating ? "Creando..." : "Crear Proveedor"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}
