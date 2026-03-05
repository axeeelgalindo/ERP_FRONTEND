"use client";

import React from "react";
import ModalBase from "./ModalBase";

export default function VincularCosteoModal({
  open,
  onClose,
  // state
  compraSel,
  costeosDisponibles,
  costeosLoading,
  costeosErr,
  asignaciones,
  savingVinc,
  savingErr,
  canSaveVinc,
  diffAsignacion,
  // actions
  onReloadCosteos,
  onToggleCosteo,
  isSelected,
  onUpdateMonto,
  onResetLocks,
  onSave,
  // helpers
  fmtDateDMY,
  toCLP,
  sumAsignado,
}) {
  return (
    <ModalBase
      open={open}
      title={
        compraSel
          ? `Vincular compra #${compraSel?.numero ?? "-"} · Total ${toCLP(
              compraSel?.total,
            )}`
          : "Vincular compra"
      }
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            className="h-9 rounded-lg border border-slate-200  px-3 text-sm hover:bg-slate-50 "
            onClick={onClose}
            disabled={savingVinc}
            type="button"
          >
            Cancelar
          </button>

          <button
            className="h-9 rounded-lg border border-slate-200  px-3 text-sm hover:bg-slate-50  disabled:opacity-60"
            onClick={onResetLocks}
            disabled={asignaciones.length === 0 || savingVinc}
            type="button"
            title="Dejar último como autoajustable"
          >
            Autoajustar
          </button>

          <button
            className="h-9 rounded-lg bg-slate-900  px-3 text-sm text-white  hover:opacity-90 disabled:opacity-60"
            onClick={onSave}
            disabled={!canSaveVinc || savingVinc}
            type="button"
          >
            {savingVinc ? "Guardando…" : "Guardar"}
          </button>
        </div>
      }
    >
      {costeosErr ? (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {costeosErr}
        </div>
      ) : null}

      {savingErr ? (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {savingErr}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Lista ventas */}
        <div className="rounded-xl border border-slate-200  bg-white overflow-hidden">
          <div className="p-3 border-b border-slate-100  flex items-center justify-between">
            <div className="font-semibold text-sm text-slate-900 ">
              Costeos disponibles (ventas)
            </div>
            <button
              className="h-8 rounded-lg border border-slate-200  px-2 text-xs hover:bg-slate-50  disabled:opacity-60"
              onClick={onReloadCosteos}
              disabled={costeosLoading}
              type="button"
            >
              {costeosLoading ? "Cargando…" : "Recargar"}
            </button>
          </div>

          <div className="max-h-[360px] overflow-auto p-2 custom-scrollbar">
            {costeosLoading ? (
              <div className="p-3 text-sm text-slate-500">Cargando…</div>
            ) : costeosDisponibles.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">No hay ventas.</div>
            ) : (
              costeosDisponibles.map((v) => (
                <label
                  key={v.id}
                  className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50  cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isSelected(String(v.id))}
                    onChange={() => onToggleCosteo(v)}
                    className="mt-1"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate text-slate-900 ">
                      #{v.numero ?? "-"} {v.descripcion ?? "Sin descripción"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {v.fecha ? fmtDateDMY(v.fecha) : "-"}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Asignación */}
        <div className="rounded-xl border border-slate-200  bg-white overflow-hidden">
          <div className="p-3 border-b border-slate-100 ">
            <div className="font-semibold text-sm text-slate-900 ">
              Asignación
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Selecciona 1+ ventas. La suma debe ser igual al total de la compra.
            </div>
          </div>

          <div className="p-3 space-y-2">
            {asignaciones.length === 0 ? (
              <div className="text-sm text-slate-500">
                Selecciona 1 o más ventas para asignar el total.
              </div>
            ) : (
              <>
                {asignaciones.map((a) => (
                  <div
                    key={a.ventaId}
                    className="flex items-center gap-2 rounded-xl border border-slate-200  p-2 bg-white "
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate text-slate-900 ">
                        #{a?.meta?.numero ?? "-"} {a?.meta?.descripcion ?? a.ventaId}
                      </div>
                      <div className="text-xs text-slate-500">
                        {a.locked ? "Fijo" : "Auto"}
                      </div>
                    </div>

                    <input
                      type="number"
                      className="h-9 w-40 rounded-lg border border-slate-200  px-2 text-sm bg-white "
                      value={Number(a.monto || 0)}
                      onChange={(e) => onUpdateMonto(a.ventaId, e.target.value)}
                      min={0}
                    />
                  </div>
                ))}

                <div className="pt-2 border-t border-slate-100  text-sm flex items-center justify-between">
                  <div className="text-slate-600 ">
                    Suma: <b>{toCLP(sumAsignado())}</b>
                  </div>
                  <div
                    className={
                      Math.abs(diffAsignacion) <= 0.01
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }
                  >
                    Diferencia: <b>{toCLP(diffAsignacion)}</b>
                  </div>
                </div>

                {!canSaveVinc ? (
                  <div className="text-xs text-amber-700">
                    La suma debe ser exactamente igual al total de la compra.
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </ModalBase>
  );
}