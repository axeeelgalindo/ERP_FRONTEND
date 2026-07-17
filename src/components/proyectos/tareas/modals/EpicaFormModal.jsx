"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Box,
  MenuItem,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { makeHeaders } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

const ESTADOS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_progreso", label: "En progreso" },
  { value: "completada", label: "Completada" },
];

export default function EpicaFormModal({
  open,
  onClose,
  session,
  proyectoId,
  epica, // null => create, objeto => edit
  onSaved,
  onSwitchTab,
}) {
  const isEdit = !!epica?.id;

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [esPlanificado, setEsPlanificado] = useState(true);

  // Reales
  const [fechaInicioReal, setFechaInicioReal] = useState("");
  const [fechaFinReal, setFechaFinReal] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Helper local (igual q en tarea)
  function toISODateInput(d) {
    if (!d) return "";
    try {
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return "";
      const yyyy = dt.getUTCFullYear();
      const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(dt.getUTCDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return "";
    }
  }

  useEffect(() => {
    if (!open) return;
    setError("");
    setBusy(false);
    setNombre(epica?.nombre || "");
    setDescripcion(epica?.descripcion || "");
    setEstado(epica?.estado || "pendiente");
    setEsPlanificado(epica?.es_planificado ?? true);

    setFechaInicioReal(toISODateInput(epica?.fecha_inicio_real));
    setFechaFinReal(toISODateInput(epica?.fecha_fin_real));
  }, [open, epica]);

  const canSave = useMemo(() => nombre.trim().length >= 2 && !!proyectoId, [nombre, proyectoId]);

  const handleSubmit = async () => {
    if (!session?.user) return;
    if (!canSave) return;

    try {
      setBusy(true);
      setError("");

      const headers = {
        ...makeHeaders(session),
        "Content-Type": "application/json",
      };

      if (!isEdit) {
        // ✅ backend requiere proyecto_id
        const body = {
          proyecto_id: proyectoId,
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          estado,
          es_planificado: esPlanificado,
        };

        const res = await fetch(`${API}/epicas/add`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || json?.message || "Error creando épica");

        onSaved?.();
        onClose?.();
        return;
      }

      const body = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        estado,
        es_planificado: esPlanificado,
        ...(isEdit && fechaInicioReal ? { fecha_inicio_real: new Date(fechaInicioReal).toISOString() } : {}),
        ...(isEdit && fechaFinReal ? { fecha_fin_real: new Date(fechaFinReal).toISOString() } : {}),
      };

      const res = await fetch(`${API}/epicas/update/${epica.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || json?.message || "Error actualizando épica");

      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e?.message || "Error guardando épica");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: "16px",
          overflow: "hidden",
          bgcolor: "#ffffff",
          boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
        },
      }}
    >
      {/* Modal Header */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-[#191c1e]">{isEdit ? "Editar épica" : "Nueva épica"}</h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-[#737685] hover:text-[#191c1e] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        {!isEdit && (
          <div className="flex w-full bg-[#f3f4f6] rounded-lg p-1">
            <button
              type="button"
              onClick={() => onSwitchTab?.("tarea")}
              className="flex-1 py-2 font-medium text-xs rounded-md transition-all text-[#434654] hover:text-[#191c1e]"
            >
              Tarea
            </button>
            <button
              type="button"
              className="flex-1 py-2 font-medium text-xs rounded-md transition-all bg-white shadow-sm text-[#003d9b] font-semibold"
            >
              Épica
            </button>
            <button
              type="button"
              onClick={() => onSwitchTab?.("subtarea")}
              className="flex-1 py-2 font-medium text-xs rounded-md transition-all text-[#434654] hover:text-[#191c1e]"
            >
              Subtarea
            </button>
          </div>
        )}
      </div>

      {/* Modal Content */}
      <div className="flex-1 overflow-y-auto px-8 py-4 custom-scrollbar max-h-[60vh]">
        {error ? (
          <div className="bg-red-50 border border-red-200 text-[#ba1a1a] px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative group">
              <label className="block text-xs font-semibold text-[#434654] mb-1 ml-1">Nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                autoFocus
                className="w-full bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 transition-all outline-none"
                placeholder="Ej: Core Banking Platform v2"
              />
            </div>

            <div className="relative group">
              <label className="block text-xs font-semibold text-[#434654] mb-1 ml-1">Estado</label>
              <div className="relative">
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full appearance-none bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 transition-all outline-none pr-10"
                >
                  {ESTADOS.map((x) => (
                    <option key={x.value} value={x.value}>
                      {x.label}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#737685]">
                  expand_more
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEsPlanificado(!esPlanificado)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  esPlanificado ? "bg-[#003d9b]" : "bg-[#c3c6d6]"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    esPlanificado ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm text-[#191c1e] font-medium">Definido en Planificación Inicial</span>
            </div>
          </div>

          {isEdit && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative group">
                <label className="block text-xs font-semibold text-[#434654] mb-1 ml-1">Inicio real (manual)</label>
                <div className="relative">
                  <input
                    type="date"
                    value={fechaInicioReal}
                    onChange={(e) => setFechaInicioReal(e.target.value)}
                    className="w-full bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 outline-none pr-10"
                  />
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#737685]">
                    calendar_today
                  </span>
                </div>
              </div>
              <div className="relative group">
                <label className="block text-xs font-semibold text-[#434654] mb-1 ml-1">Fin real (manual)</label>
                <div className="relative">
                  <input
                    type="date"
                    value={fechaFinReal}
                    onChange={(e) => setFechaFinReal(e.target.value)}
                    className="w-full bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 outline-none pr-10"
                  />
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#737685]">
                    event_busy
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="relative group">
            <label className="block text-xs font-semibold text-[#434654] mb-1 ml-1">Descripción (opcional)</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              className="w-full bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 transition-all outline-none resize-none"
              placeholder="Escribe los detalles de la épica..."
            />
          </div>
        </form>
      </div>

      {/* Modal Footer */}
      <div className="px-8 py-6 bg-[#f3f4f6] flex justify-end items-center gap-3 border-t border-[#c3c6d6]/30">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="text-[#003d9b] font-semibold text-sm px-4 py-2 rounded-lg hover:bg-[#003d9b]/5 transition-colors uppercase tracking-wide"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSave || busy}
          className={`font-semibold text-sm px-6 py-2.5 rounded-lg uppercase tracking-wide flex items-center gap-2 transition-all ${
            canSave && !busy
              ? "bg-[#003d9b] text-white hover:bg-[#003d9b]/90 shadow-md active:scale-95 cursor-pointer"
              : "bg-[#e1e2e4] text-[#737685] cursor-not-allowed"
          }`}
        >
          {busy && <CircularProgress size={16} color="inherit" />}
          {isEdit ? "Guardar cambios" : "Crear épica"}
        </button>
      </div>
    </Dialog>
  );
}