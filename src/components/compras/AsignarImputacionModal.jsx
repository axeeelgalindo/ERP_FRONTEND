"use client";

import React, { useState, useEffect } from "react";
import ModalBase from "./ModalBase";

const PRESET_PROYECTOS_INTERNOS = [
  "Mantenimiento Galpón y Taller",
  "Desarrollo Software ERP",
  "Reparación y Mantención Maquinaria",
  "Herramientas e Inventario General",
  "Mejora de Instalaciones y Oficinas",
  "Capacitación y Formación de Personal",
  "Logística y Transporte Interno",
];

export default function AsignarImputacionModal({
  open,
  onClose,
  compraSel,
  proyectos = [],
  servicios = [],
  onSave,
  saving = false,
  error = "",
}) {
  const [destino, setDestino] = useState("PROYECTO");
  const [centroCosto, setCentroCosto] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [servicioId, setServicioId] = useState("");

  const [subDestino, setSubDestino] = useState("GENERAL");
  const [proyectoInternoSel, setProyectoInternoSel] = useState("");
  const [isNuevoProyInterno, setIsNuevoProyInterno] = useState(false);
  const [nuevoProyectoInterno, setNuevoProyectoInterno] = useState("");
  const [comentarioDestino, setComentarioDestino] = useState("");

  const [validationErr, setValidationErr] = useState("");

  // Cargar datos actuales de la compra al abrir
  useEffect(() => {
    if (open && compraSel) {
      const isServ = compraSel.destino === "SERVICIO" || (compraSel.cotizacion?.es_suscripcion && compraSel.cotizacionId);
      if (isServ) {
        setDestino("SERVICIO");
        setServicioId(compraSel.cotizacionId || compraSel.cotizacion?.id || "");
        setProyectoId(compraSel.proyecto_id || "");
      } else {
        setDestino(compraSel.destino || "PROYECTO");
        setProyectoId(compraSel.proyecto_id || "");
        setServicioId("");
      }
      setCentroCosto(compraSel.centro_costo || "");

      const currentSub = compraSel.sub_destino || "GENERAL";
      setSubDestino(currentSub);

      const pi = compraSel.proyecto_interno || "";
      if (pi) {
        if (PRESET_PROYECTOS_INTERNOS.includes(pi)) {
          setProyectoInternoSel(pi);
          setIsNuevoProyInterno(false);
          setNuevoProyectoInterno("");
        } else {
          setProyectoInternoSel("__NUEVO__");
          setIsNuevoProyInterno(true);
          setNuevoProyectoInterno(pi);
        }
      } else {
        setProyectoInternoSel("");
        setIsNuevoProyInterno(false);
        setNuevoProyectoInterno("");
      }

      setComentarioDestino(compraSel.comentario_destino || "");
      setValidationErr("");
    }
  }, [open, compraSel]);

  const handleConfirm = () => {
    setValidationErr("");

    if (destino === "PROYECTO") {
      if (!proyectoId) {
        setValidationErr("Debe seleccionar un proyecto.");
        return;
      }
      onSave({
        destino: "PROYECTO",
        centro_costo: null,
        proyecto_id: proyectoId,
        cotizacionId: null,
        sub_destino: null,
        proyecto_interno: null,
        comentario_destino: null,
      });
      return;
    }

    if (destino === "SERVICIO") {
      if (!servicioId) {
        setValidationErr("Debe seleccionar un servicio recurrente.");
        return;
      }
      const servSel = servicios.find((s) => s.id === servicioId);
      onSave({
        destino: "SERVICIO",
        centro_costo: null,
        cotizacionId: servicioId,
        proyecto_id: servSel?.proyecto_id || null,
        sub_destino: null,
        proyecto_interno: null,
        comentario_destino: null,
      });
      return;
    }

    if (!centroCosto) {
      setValidationErr("Debe seleccionar un centro de costo (Puerto Montt o Punta Arenas).");
      return;
    }

    let finalProyectoInterno = null;
    let finalComentario = null;

    if (subDestino === "PROYECTO_INTERNO") {
      if (isNuevoProyInterno || proyectoInternoSel === "__NUEVO__") {
        if (!nuevoProyectoInterno.trim()) {
          setValidationErr("Debe indicar el nombre del nuevo proyecto interno.");
          return;
        }
        finalProyectoInterno = nuevoProyectoInterno.trim();
      } else {
        if (!proyectoInternoSel) {
          setValidationErr("Debe seleccionar o escribir un nombre de proyecto interno.");
          return;
        }
        finalProyectoInterno = proyectoInternoSel;
      }
    } else if (subDestino === "EPP" || subDestino === "INSUMOS") {
      if (!comentarioDestino.trim()) {
        setValidationErr(`Debe indicar un comentario para ${subDestino === "EPP" ? "EPP" : "Insumos"}.`);
        return;
      }
      finalComentario = comentarioDestino.trim();
    }

    onSave({
      destino,
      centro_costo: centroCosto,
      proyecto_id: null,
      cotizacionId: null,
      sub_destino: subDestino,
      proyecto_interno: subDestino === "PROYECTO_INTERNO" ? finalProyectoInterno : null,
      comentario_destino: (subDestino === "EPP" || subDestino === "INSUMOS") ? finalComentario : null,
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
          <div className="grid grid-cols-4 gap-2 mt-1">
            {[
              { val: "PROYECTO", lab: "Proyecto", icon: "construction" },
              { val: "SERVICIO", lab: "Servicio", icon: "room_service" },
              { val: "TALLER", lab: "Taller", icon: "precision_manufacturing" },
              { val: "ADMINISTRACION", lab: "Admin", icon: "corporate_fare" },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => {
                  setDestino(opt.val);
                  if (opt.val === "PROYECTO") {
                    setCentroCosto("");
                    setServicioId("");
                  } else if (opt.val === "SERVICIO") {
                    setCentroCosto("");
                    setProyectoId("");
                  } else {
                    setProyectoId("");
                    setServicioId("");
                  }
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer ${
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
        ) : destino === "SERVICIO" ? (
          <div className="flex flex-col gap-1.5 mt-1">
            <label className="text-xs font-bold text-slate-700">Servicio Recurrente de Destino *</label>
            <select
              className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] text-xs transition-all outline-none"
              value={servicioId}
              onChange={(e) => setServicioId(e.target.value)}
            >
              <option value="">Seleccione servicio recurrente...</option>
              {servicios.map((s) => {
                const num = s.numero ? (s.numero >= 1000000 ? s.numero - 1000000 : s.numero) : "—";
                const clienteNom = s.cliente?.nombre || "Sin cliente";
                const asunto = s.asunto || "Servicio Activo";
                return (
                  <option key={s.id} value={s.id}>
                    #{num} · {asunto} ({clienteNom})
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Las compras imputadas a este servicio se cargarán directamente a sus costos operativos continuos.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mt-1">
            <div className="flex flex-col gap-1.5">
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

            {/* Recuadros de Tipo / Sub-Destino */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Clasificación Específica / Tipo de Costo *</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[
                  { val: "GENERAL", lab: "Costo General", icon: "build_circle" },
                  { val: "PROYECTO_INTERNO", lab: "Proyecto Interno", icon: "assignment" },
                  { val: "EPP", lab: "EPP", icon: "health_and_safety" },
                  { val: "INSUMOS", lab: "Insumos", icon: "inventory_2" },
                ].map((st) => (
                  <button
                    key={st.val}
                    type="button"
                    onClick={() => setSubDestino(st.val)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                      subDestino === st.val
                        ? "bg-indigo-50 text-[#1e3a8a] border-[#1e3a8a] font-bold shadow-sm"
                        : "bg-slate-50 text-slate-600 border-transparent hover:border-slate-200"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{st.icon}</span>
                    <span className="text-xs">{st.lab}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Despliegue de Proyecto Interno */}
            {subDestino === "PROYECTO_INTERNO" && (
              <div className="flex flex-col gap-2 p-3 bg-[#f8fafc] border border-blue-100 rounded-xl">
                <label className="text-xs font-bold text-[#1e3a8a]">Seleccionar Nombre de Proyecto Interno *</label>
                <select
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-xs transition-all outline-none focus:border-[#1e3a8a]"
                  value={isNuevoProyInterno ? "__NUEVO__" : proyectoInternoSel}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__NUEVO__") {
                      setIsNuevoProyInterno(true);
                      setProyectoInternoSel("__NUEVO__");
                    } else {
                      setIsNuevoProyInterno(false);
                      setProyectoInternoSel(val);
                    }
                  }}
                >
                  <option value="">Seleccione o indique proyecto...</option>
                  {PRESET_PROYECTOS_INTERNOS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  <option value="__NUEVO__">✏️ + Indicar nuevo proyecto interno...</option>
                </select>

                {(isNuevoProyInterno || proyectoInternoSel === "__NUEVO__") && (
                  <div className="flex flex-col gap-1 mt-1">
                    <label className="text-[11px] font-semibold text-slate-600">Nombre del Nuevo Proyecto Interno *</label>
                    <input
                      type="text"
                      placeholder="Ej. Remodelación Bodega Central..."
                      value={nuevoProyectoInterno}
                      onChange={(e) => setNuevoProyectoInterno(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:border-[#1e3a8a]"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            )}

            {/* Despliegue de Comentario para EPP o Insumos */}
            {(subDestino === "EPP" || subDestino === "INSUMOS") && (
              <div className="flex flex-col gap-1.5 p-3 bg-[#f8fafc] border border-amber-100 rounded-xl">
                <label className="text-xs font-bold text-amber-900 flex items-center gap-1">
                  <span>Comentario / Detalle de {subDestino === "EPP" ? "EPP" : "Insumos"} *</span>
                </label>
                <textarea
                  rows={2}
                  placeholder={
                    subDestino === "EPP"
                      ? "Ej. Cascos, guantes de cabritilla y calzado de seguridad para personal de operaciones..."
                      : "Ej. Discos de corte, electrodos y grasa industrial..."
                  }
                  value={comentarioDestino}
                  onChange={(e) => setComentarioDestino(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:border-[#1e3a8a]"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </ModalBase>
  );
}
