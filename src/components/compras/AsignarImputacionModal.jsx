"use client";

import React, { useState, useEffect } from "react";
import ModalBase from "./ModalBase";

export default function AsignarImputacionModal({
  open,
  onClose,
  compraSel,
  proyectos = [],
  onSave,
  saving = false,
  error = "",
}) {
  const [destino, setDestino] = useState("PROYECTO");
  const [centroCosto, setCentroCosto] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [validationErr, setValidationErr] = useState("");

  // Cargar datos actuales de la compra al abrir
  useEffect(() => {
    if (open && compraSel) {
      setDestino(compraSel.destino || "PROYECTO");
      setCentroCosto(compraSel.centro_costo || "");
      setProyectoId(compraSel.proyecto_id || "");
      setValidationErr("");
    }
  }, [open, compraSel]);

  const handleConfirm = () => {
    setValidationErr("");
    if (destino === "PROYECTO" && !proyectoId) {
      setValidationErr("Debe seleccionar un proyecto.");
      return;
    }
    if (destino !== "PROYECTO" && !centroCosto) {
      setValidationErr("Debe seleccionar un centro de costo.");
      return;
    }

    onSave({
      destino,
      centro_costo: destino === "PROYECTO" ? null : centroCosto,
      proyecto_id: destino === "PROYECTO" ? proyectoId : null,
    });
  };

  return (
    <ModalBase
      open={open}
      title={
        compraSel
          ? `Asignar Imputación · Compra #${compraSel.numero ?? "-"} · ${compraSel.proveedor?.nombre || "SII"}`
          : "Asignar Imputación / Centro de Costo"
      }
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 text-slate-700 disabled:opacity-50"
            onClick={onClose}
            disabled={saving}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="h-9 rounded-lg bg-[#1e3a8a] px-5 text-sm text-white font-bold hover:bg-[#1e3a8a]/90 disabled:opacity-50 shadow-md shadow-blue-900/10"
            onClick={handleConfirm}
            disabled={saving}
            type="button"
          >
            {saving ? "Guardando..." : "Confirmar"}
          </button>
        </div>
      }
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />

      <div className="flex flex-col gap-5 p-1">
        {(error || validationErr) && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <span className="material-symbols-outlined text-lg">error</span>
            <span>{error || validationErr}</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-700">Imputación / Destino Principal *</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {[
              { val: "PROYECTO", lab: "Proyecto", icon: "construction" },
              { val: "TALLER", lab: "Taller", icon: "precision_manufacturing" },
              { val: "ADMINISTRACION", lab: "Admin", icon: "corporate_fare" },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => {
                  setDestino(opt.val);
                  if (opt.val !== "PROYECTO") setProyectoId("");
                  else setCentroCosto("");
                }}
                className={`flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  destino === opt.val
                    ? "bg-indigo-50/70 text-[#1e3a8a] border-[#1e3a8a] shadow-sm font-bold"
                    : "bg-slate-50 text-slate-600 border-transparent hover:border-slate-200"
                }`}
              >
                <span
                  className="material-symbols-outlined mb-1 text-xl"
                  style={{ fontVariationSettings: destino === opt.val ? "'FILL' 1" : "" }}
                >
                  {opt.icon}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-tight">{opt.lab}</span>
              </button>
            ))}
          </div>
        </div>

        {destino === "PROYECTO" ? (
          <div className="flex flex-col gap-1.5 mt-1">
            <label className="text-xs font-bold text-slate-700">Proyecto de Destino *</label>
            <select
              className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] text-xs transition-all outline-none"
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
            >
              <option value="">Seleccione proyecto</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 mt-1">
            <label className="text-xs font-bold text-slate-700">Centro de Costo / Ciudad *</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {["PMC", "PUQ"].map((cc) => (
                <button
                  key={cc}
                  type="button"
                  onClick={() => setCentroCosto(cc)}
                  className={`py-3 rounded-lg text-xs font-bold transition-all border-2 cursor-pointer ${
                    centroCosto === cc
                      ? "bg-[#1e3a8a] text-white border-[#1e3a8a] shadow-sm"
                      : "bg-slate-50 text-slate-600 border-transparent hover:border-slate-200"
                  }`}
                >
                  {cc === "PMC" ? "Puerto Montt" : "Punta Arenas"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModalBase>
  );
}
