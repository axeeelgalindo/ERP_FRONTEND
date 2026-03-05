"use client";

import React from "react";
import ModalBase from "./ModalBase";

export default function CompraManualModal({
  open,
  creating,
  createErr,
  onClose,
  onSubmit,
  // lookups
  proveedores,
  proyectos,
  lookupsLoading,
  // form state
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
}) {
  return (
    <ModalBase
      open={open}
      title="Crear compra manual"
      onClose={() => {
        if (!creating) onClose?.();
      }}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            className="h-9 rounded-lg border border-slate-200  px-3 text-sm hover:bg-slate-50 "
            onClick={onClose}
            disabled={creating}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="h-9 rounded-lg bg-slate-900  px-3 text-sm text-white  hover:opacity-90 disabled:opacity-60"
            onClick={onSubmit}
            disabled={creating}
            type="button"
          >
            {creating ? "Creando…" : "Crear"}
          </button>
        </div>
      }
    >
      {createErr ? (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {createErr}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <div className="text-xs text-slate-500 mb-1">Proveedor *</div>
          <select
            className="h-10 w-full rounded-lg border border-slate-200  px-2 text-sm bg-white  "
            value={c_proveedorId}
            onChange={(e) => setC_proveedorId(e.target.value)}
            disabled={lookupsLoading}
          >
            <option value="">Seleccionar…</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre ?? p.razon_social ?? p.rut ?? p.id}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="text-xs text-slate-500 mb-1">Destino *</div>
          <select
            className="h-10 w-full rounded-lg border border-slate-200  px-2 text-sm bg-white  "
            value={c_destino}
            onChange={(e) => {
              const v = e.target.value;
              setC_destino(v);
              if (v !== "PROYECTO") setC_proyectoId("");
              if (v === "PROYECTO") setC_centro("");
            }}
          >
            <option value="PROYECTO">Proyecto</option>
            <option value="ADMINISTRACION">Administración</option>
            <option value="TALLER">Taller</option>
          </select>
        </label>

        <label className="block">
          <div className="text-xs text-slate-500 mb-1">
            Centro {c_destino === "PROYECTO" ? "" : "*"}
          </div>
          <select
            className="h-10 w-full rounded-lg border border-slate-200  px-2 text-sm bg-white  "
            value={c_centro}
            onChange={(e) => setC_centro(e.target.value)}
            disabled={c_destino === "PROYECTO"}
          >
            <option value="">
              {c_destino === "PROYECTO" ? "(No aplica)" : "Seleccionar…"}
            </option>
            <option value="PMC">PMC - Puerto Montt</option>
            <option value="PUQ">PUQ - Punta Arenas</option>
          </select>
        </label>

        <label className="block">
          <div className="text-xs text-slate-500 mb-1">
            Proyecto {c_destino === "PROYECTO" ? "*" : ""}
          </div>
          <select
            className="h-10 w-full rounded-lg border border-slate-200  px-2 text-sm bg-white  "
            value={c_proyectoId}
            onChange={(e) => setC_proyectoId(e.target.value)}
            disabled={lookupsLoading || c_destino !== "PROYECTO"}
          >
            <option value="">
              {c_destino === "PROYECTO" ? "Seleccionar…" : "(No aplica)"}
            </option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre ?? p.codigo ?? p.id}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="text-xs text-slate-500 mb-1">Tipo doc *</div>
          <select
            className="h-10 w-full rounded-lg border border-slate-200  px-2 text-sm bg-white  "
            value={c_tipoDoc}
            onChange={(e) => setC_tipoDoc(e.target.value)}
          >
            <option value="33">33 - Factura</option>
            <option value="61">61 - Nota crédito</option>
            <option value="34">34 - Factura exenta</option>
            <option value="56">56 - Nota débito</option>
          </select>
        </label>

        <label className="block">
          <div className="text-xs text-slate-500 mb-1">Folio *</div>
          <input
            className="h-10 w-full rounded-lg border border-slate-200  px-3 text-sm bg-white  "
            value={c_folio}
            onChange={(e) => setC_folio(e.target.value)}
            placeholder="Ej: 1541"
          />
        </label>

        <label className="block">
          <div className="text-xs text-slate-500 mb-1">Fecha docto *</div>
          <input
            type="date"
            className="h-10 w-full rounded-lg border border-slate-200  px-3 text-sm bg-white  "
            value={c_fechaDocto}
            onChange={(e) => setC_fechaDocto(e.target.value)}
          />
        </label>

        <label className="block">
          <div className="text-xs text-slate-500 mb-1">Total (CLP) *</div>
          <input
            type="number"
            className="h-10 w-full rounded-lg border border-slate-200  px-3 text-sm bg-white  "
            value={c_total}
            onChange={(e) => setC_total(e.target.value)}
            placeholder="Ej: 250000"
            min={0}
          />
        </label>
      </div>

      {lookupsLoading ? (
        <div className="mt-3 text-xs text-slate-500">Cargando listas…</div>
      ) : null}
    </ModalBase>
  );
}