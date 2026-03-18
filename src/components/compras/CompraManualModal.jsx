"use client";

import React from "react";
import ModalBase from "./ModalBase";

export default function CompraManualModal({
  open,
  onClose,
  onSubmit,
  creating,
  createErr,
  // Lookups
  proveedores = [],
  proyectos = [],
  lookupsLoading = false,
  // State from parent
  c_proveedorId,
  setC_proveedorId,
  c_destino,
  setC_destino,
  c_centro,
  setC_centro,
  c_proyectoId,
  setC_proyectoId,
  c_tipoDoc,
  setC_tipoDoc,
  c_folio,
  setC_folio,
  c_fechaDocto,
  setC_fechaDocto,
  c_total,
  setC_total,
  c_estado,
  setC_estado,
  // New: onAddProveedor function
  onAddProveedorClick,
}) {
  return (
    <ModalBase
      open={open}
      onClose={onClose}
      title="" // Title is handled in the custom header below
      hideHeader={true}
      className="max-w-4xl"
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
            shopping_cart_checkout
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Crear compra manual</h1>
        </div>
        <p className="text-slate-500 text-sm">
          Ingrese los detalles del documento para registrar la nueva transacción en el sistema contable.
        </p>
      </div>

      {createErr && (
        <div className="mx-8 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {createErr}
        </div>
      )}

      {/* Form Body */}
      <form
        className="p-8"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          {/* Proveedor */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700">
                Proveedor *
              </label>
              <button
                type="button"
                onClick={onAddProveedorClick}
                className="text-[11px] font-bold text-[#1e3a8a] hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-xs">person_add</span>
                AGREGAR
              </button>
            </div>
            <div className="relative">
              <select
                className="w-full h-12 px-10 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] appearance-none transition-all text-sm"
                value={c_proveedorId}
                onChange={(e) => setC_proveedorId(e.target.value)}
                disabled={lookupsLoading}
                required
              >
                <option value="">Seleccione un proveedor</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} {p.rut ? `(${p.rut})` : ""}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">
                store
              </span>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* Destino */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">
              Destino Principal *
            </label>
            <div className="relative">
              <select
                className="w-full h-12 px-10 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] appearance-none transition-all text-sm"
                value={c_destino}
                onChange={(e) => setC_destino(e.target.value)}
                required
              >
                <option value="PROYECTO">PROYECTO</option>
                <option value="ADMINISTRACION">ADMINISTRACION</option>
                <option value="TALLER">TALLER</option>
              </select>
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">
                location_on
              </span>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* Centro de Costo (PMC/PUQ) - Only if not Project */}
          {c_destino !== "PROYECTO" && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">
                Centro de Costo *
              </label>
              <div className="relative">
                <select
                  className="w-full h-12 px-10 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] appearance-none transition-all text-sm"
                  value={c_centro}
                  onChange={(e) => setC_centro(e.target.value)}
                  required
                >
                  <option value="">Seleccione centro</option>
                  <option value="PMC">PMC</option>
                  <option value="PUQ">PUQ</option>
                </select>
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">
                  business_center
                </span>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>
          )}

          {/* Proyecto - Only if Project */}
          {c_destino === "PROYECTO" && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">
                Proyecto *
              </label>
              <div className="relative">
                <select
                  className="w-full h-12 px-10 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] appearance-none transition-all text-sm"
                  value={c_proyectoId}
                  onChange={(e) => setC_proyectoId(e.target.value)}
                  disabled={lookupsLoading}
                  required
                >
                  <option value="">Seleccione proyecto</option>
                  {proyectos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">
                  construction
                </span>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>
          )}

          {/* Tipo Documento */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">
              Tipo Documento *
            </label>
            <div className="relative">
              <select
                className="w-full h-12 px-10 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] appearance-none transition-all text-sm"
                value={c_tipoDoc}
                onChange={(e) => setC_tipoDoc(e.target.value)}
                required
              >
                <option value="33">Factura Electrónica (33)</option>
                <option value="61">Nota de Crédito (61)</option>
                <option value="56">Nota de Débito (56)</option>
                <option value="34">Factura Exenta (34)</option>
                <option value="39">Boleta Electrónica (39)</option>
                <option value="99">Documento Manual (99)</option>
              </select>
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">
                description
              </span>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* Folio / N° Documento */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">
              Folio / N° Documento
            </label>
            <div className="relative">
              <input
                className="w-full h-12 px-10 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] transition-all text-sm"
                value={c_folio}
                onChange={(e) => setC_folio(e.target.value)}
                placeholder="Ej: 125489"
                type="text"
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">
                tag
              </span>
            </div>
          </div>

          {/* Fecha Documento */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">
              Fecha del Documento *
            </label>
            <div className="relative">
              <input
                className="w-full h-12 px-10 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] transition-all text-sm"
                type="date"
                value={c_fechaDocto}
                onChange={(e) => setC_fechaDocto(e.target.value)}
                required
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">
                calendar_today
              </span>
            </div>
          </div>

          {/* Estado de Pago */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">
              Estado de Pago *
            </label>
            <div className="relative">
              <select
                className="w-full h-12 px-10 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] appearance-none transition-all text-sm"
                value={c_estado}
                onChange={(e) => setC_estado(e.target.value)}
                required
              >
                <option value="ORDEN_COMPRA">ORDEN_COMPRA</option>
                <option value="FACTURADA">FACTURADA</option>
                <option value="PAGADA">PAGADA</option>
              </select>
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">
                payments
              </span>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* Total CLP (Prominent Field) */}
          <div className="md:col-span-2 mt-4">
            <div className="p-6 rounded-xl bg-[#1e3a8a]/5 border-2 border-[#1e3a8a]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <label className="text-sm font-bold text-[#1e3a8a] uppercase tracking-wider">
                  Total Compra (CLP) *
                </label>
                <p className="text-xs text-slate-500">
                  Incluye IVA y retenciones si corresponde
                </p>
              </div>
              <div className="relative min-w-[280px]">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-[#1e3a8a]">
                  $
                </span>
                <input
                  className="w-full h-16 pl-10 pr-4 text-3xl font-extrabold text-[#1e3a8a] border-none bg-transparent focus:ring-0 placeholder:text-[#1e3a8a]/30 text-right"
                  placeholder="0"
                  type="number"
                  value={c_total}
                  onChange={(e) => setC_total(e.target.value)}
                  min="0"
                  required
                />
              </div>
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
            disabled={creating}
          >
            <span className="material-symbols-outlined text-xl">
              {creating ? "sync" : "save"}
            </span>
            {creating ? "Registrando..." : "Crear Registro"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}