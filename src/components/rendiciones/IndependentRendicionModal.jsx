"use client";

import React, { useEffect, useMemo, useState } from "react";

function toCLP(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

async function jsonOrNull(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

const CATEGORIAS = [
  { value: "", label: "Seleccionar…" },
  { value: "MATERIALES", label: "Materiales" },
  { value: "HERRAMIENTAS", label: "Herramientas" },
  { value: "TRANSPORTE", label: "Transporte" },
  { value: "ALIMENTACION", label: "Alimentación" },
  { value: "ALOJAMIENTO", label: "Alojamiento" },
  { value: "SERVICIOS", label: "Servicios" },
  { value: "PEAJES", label: "Peajes" },
  { value: "COMBUSTIBLE", label: "Combustible" },
  { value: "OTROS", label: "Otros" },
];

export default function IndependentRendicionModal({
  open,
  onClose,
  session,
  apiBase,
  onSaved,
}) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Form State
  const [destino, setDestino] = useState("PROYECTO");
  const [centroCosto, setCentroCosto] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [empleadoId, setEmpleadoId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [montoEntregado, setMontoEntregado] = useState("");
  const [docEntregaFile, setDocEntregaFile] = useState(null);
  const [docEntregaName, setDocEntregaName] = useState("");
  const [items, setItems] = useState([
    { fecha: "", descripcion: "", monto: "", categoria: "", comprobante_file: null, comprobante_name: "" }
  ]);

  // Data for selects
  const [proyectos, setProyectos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [filterQ, setFilterQ] = useState("");
  const [filterE, setFilterE] = useState("");

  const filteredProyectos = useMemo(() => {
    if (!filterQ) return proyectos;
    const low = filterQ.toLowerCase();
    return proyectos.filter(p =>
      p.nombre?.toLowerCase().includes(low) ||
      p.id?.toLowerCase().includes(low)
    );
  }, [proyectos, filterQ]);

  const filteredEmpleados = useMemo(() => {
    if (!filterE) return empleados;
    const low = filterE.toLowerCase();
    return empleados.filter(e => {
      const name = e.usuario?.nombre?.toLowerCase() || "";
      const rut = e.rut?.toLowerCase() || "";
      return name.includes(low) || rut.includes(low);
    });
  }, [empleados, filterE]);

  useEffect(() => {
    if (open) {
      loadInitialData();
      const u = session?.user || session || {};
      const eId = u?.empleadoId ?? u?.empleado_id ?? u?.empleado?.id ?? "";
      if (eId) setEmpleadoId(String(eId));
    }
  }, [open]);

  async function loadInitialData() {
    if (!session) return;
    const token = session?.accessToken || session?.user?.accessToken || "";
    const empresaId = session?.user?.empresaId ?? session?.user?.empresa?.id ?? session?.empresaId ?? null;

    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
    };
    try {
      const [resP, resE] = await Promise.all([
        fetch(`${apiBase}/proyectos?pageSize=1000`, { headers }),
        fetch(`${apiBase}/empleados?pageSize=1000`, { headers })
      ]);
      const dataP = await jsonOrNull(resP);
      const dataE = await jsonOrNull(resE);

      const arrP = Array.isArray(dataP?.items) ? dataP.items : Array.isArray(dataP?.data) ? dataP.data : Array.isArray(dataP) ? dataP : [];
      const arrE = Array.isArray(dataE?.items) ? dataE.items : Array.isArray(dataE?.data) ? dataE.data : Array.isArray(dataE) ? dataE : [];

      setProyectos(arrP);
      setEmpleados(arrE);
    } catch (e) {
      console.error(e);
      setProyectos([]);
      setEmpleados([]);
    }
  }

  const totalItems = useMemo(() => items.reduce((acc, it) => acc + Number(it.monto || 0), 0), [items]);
  const balance = totalItems - Number(montoEntregado || 0);

  const addItem = () => setItems([...items, { fecha: "", descripcion: "", monto: "", categoria: "", comprobante_file: null, comprobante_name: "" }]);
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx, key, val) => setItems(items.map((it, i) => i === idx ? { ...it, [key]: val } : it));

  const handleSave = async () => {
    setErr("");
    if (!empleadoId) return setErr("Seleccione un empleado");
    if (!descripcion.trim()) return setErr("Ingrese una descripción");
    if (destino === "PROYECTO" && !proyectoId) return setErr("Seleccione un proyecto");
    if (destino !== "PROYECTO" && !centroCosto) return setErr("Seleccione un centro de costo");

    const validItems = items.filter(it => it.descripcion || it.monto);
    if (validItems.length === 0) return setErr("Agregue al menos un ítem");

    setLoading(true);
    try {
      const body = {
        empleado_id: empleadoId,
        proyecto_id: destino === "PROYECTO" ? proyectoId : null,
        destino,
        centro_costo: destino === "PROYECTO" ? null : centroCosto,
        descripcion,
        monto_entregado: Number(montoEntregado || 0),
        items: validItems.map(it => ({
          fecha: it.fecha ? new Date(it.fecha).toISOString() : new Date().toISOString(),
          descripcion: it.descripcion,
          monto: Number(it.monto || 0),
          categoria: it.categoria || null
        }))
      };

      const token = session?.accessToken || session?.user?.accessToken || "";
      const empresaId = session?.user?.empresaId ?? session?.user?.empresa?.id ?? session?.empresaId ?? null;

      const res = await fetch(`${apiBase}/rendiciones`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
        },
        body: JSON.stringify(body)
      });

      const payload = await jsonOrNull(res);
      if (!res.ok) throw new Error(payload?.error || "Error al crear");

      const rendId = payload.id;

      // 2) Subir comprobante de anticipo si existe
      if (docEntregaFile) {
        const fd = new FormData();
        fd.append("file", docEntregaFile);
        await fetch(`${apiBase}/rendiciones/${rendId}/documento?type=entrega`, {
          method: "POST",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
          },
          body: fd
        });
      }

      // 3) Subir comprobantes por ítem
      // El payload.items viene con los IDs creados. Macheamos por orden.
      const createdItems = payload.items || [];
      for (let i = 0; i < validItems.length; i++) {
        const file = validItems[i].comprobante_file;
        if (file && createdItems[i]) {
          const itemId = createdItems[i].id;
          const fd = new FormData();
          fd.append("file", file);
          await fetch(`${apiBase}/rendiciones/${rendId}/items/${itemId}/comprobante`, {
            method: "POST",
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
            },
            body: fd
          });
        }
      }

      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8 bg-on-surface/20 backdrop-blur-sm">
      <div className="bg-surface-container-lowest w-full max-w-2xl rounded-xl shadow-[0_12px_32px_-4px_rgba(25,28,30,0.06)] overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header section */}
        <div className="px-8 py-6 border-b border-surface-container flex items-center justify-between bg-surface-container-low/50">
          <div>
            <h2 className="text-xl font-bold text-on-surface tracking-tight">Nueva Rendición</h2>
            <p className="text-sm text-on-surface-variant font-medium">
              {step === 1 ? "Paso 1: Identificación y Clasificación" : "Paso 2: Detalle de Gastos"}
            </p>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-grow">
          {err && (
            <div className="p-4 bg-error-container text-on-error-container rounded-xl flex items-center gap-2 text-sm font-bold border border-error/10 animate-shake">
              <span className="material-symbols-outlined">error</span> {err}
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* Collaborator Selection Sector */}
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-[0.05em] text-on-surface-variant font-black">Seleccionar Colaborador</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-outline">person_search</span>
                  </div>
                  <input
                    className="block w-full pl-11 pr-4 py-3 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-primary-container/20 text-on-surface placeholder-on-surface-variant/50 text-sm font-medium transition-all"
                    placeholder="Buscar colaborador por nombre o RUT..."
                    type="text"
                    value={filterE}
                    onChange={(e) => setFilterE(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {filteredEmpleados.map(e => {
                    const isSel = String(empleadoId) === String(e.id);
                    return (
                      <div
                        key={e.id}
                        onClick={() => setEmpleadoId(e.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-l-4 ${isSel
                            ? "bg-surface-container-low border-primary shadow-sm"
                            : "hover:bg-surface-container-low border-transparent"
                          }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center text-primary font-bold text-sm">
                          {e.usuario?.nombre?.[0] || e.rut?.[0] || "?"}
                        </div>
                        <div className="overflow-hidden">
                          <p className={`text-xs font-bold truncate ${isSel ? "text-on-surface" : "text-on-surface-variant"}`}>{e.usuario?.nombre || e.rut || "Sin nombre"}</p>
                          <p className="text-[10px] text-outline font-medium tracking-tight">RUT: {e.rut || "---"}</p>
                        </div>
                        {isSel && <span className="material-symbols-outlined text-primary text-lg ml-auto" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Expense Classification */}
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-[0.05em] text-on-surface-variant font-black underline decoration-primary decoration-4 underline-offset-8">Tipo de Rendición</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { val: "PROYECTO", lab: "Proyecto", icon: "construction" },
                    { val: "TALLER", lab: "Taller", icon: "precision_manufacturing" },
                    { val: "ADMINISTRACION", lab: "Admin", icon: "corporate_fare" }
                  ].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => { setDestino(opt.val); if (opt.val !== "PROYECTO") setProyectoId(""); }}
                      className={`group relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${destino === opt.val
                          ? "bg-primary-container text-on-primary-container border-primary/20 shadow-lg shadow-primary/10"
                          : "bg-surface-container-low text-on-surface-variant border-transparent hover:border-outline-variant"
                        }`}
                    >
                      <span className="material-symbols-outlined mb-1.5 text-2xl" style={{ fontVariationSettings: destino === opt.val ? "'FILL' 1" : "" }}>{opt.icon}</span>
                      <span className="text-[11px] font-black uppercase tracking-tight">{opt.lab}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Project / CC Selector */}
              <div className="space-y-4">
                {destino === "PROYECTO" ? (
                  <>
                    <label className="text-[10px] uppercase tracking-[0.05em] text-on-surface-variant font-black">Seleccionar Proyecto Destino</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-outline">search</span>
                      </div>
                      <input
                        className="block w-full pl-11 pr-4 py-3 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-primary-container/20 text-on-surface placeholder-on-surface-variant/50 text-sm font-medium transition-all"
                        placeholder="Buscar por nombre o código de proyecto..."
                        type="text"
                        value={filterQ}
                        onChange={(e) => setFilterQ(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {filteredProyectos.map(p => {
                        const isSel = String(proyectoId) === String(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => setProyectoId(p.id)}
                            className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border-l-4 ${isSel
                                ? "bg-surface-container-low border-primary shadow-sm"
                                : "hover:bg-surface-container-low border-transparent"
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`material-symbols-outlined text-lg ${isSel ? "text-primary" : "text-outline"}`}>apartment</span>
                              <div className="overflow-hidden">
                                <p className={`text-xs font-bold truncate ${isSel ? "text-on-surface" : "text-on-surface-variant"}`}>{p.nombre}</p>
                                <p className="text-[10px] text-outline font-medium tracking-tight">ID: {p.id.slice(-8).toUpperCase()}</p>
                              </div>
                            </div>
                            {isSel && <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/10 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-widest mb-2.5">Centro de Costo</label>
                    <div className="grid grid-cols-2 gap-3">
                      {["PMC", "PUQ"].map(cc => (
                        <button
                          key={cc}
                          onClick={() => setCentroCosto(cc)}
                          className={`py-2.5 rounded-lg text-xs font-black transition-all border-2 ${centroCosto === cc
                              ? "bg-primary text-on-primary border-primary"
                              : "bg-surface-container-lowest text-on-surface-variant border-transparent hover:border-outline-variant/30"
                            }`}
                        >
                          {cc === "PMC" ? "Puerto Montt" : "Punta Arenas"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Financial & Description (Always Visible) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-surface-container">
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-[0.05em] text-on-surface-variant font-black">Fondo por rendir ($)</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-primary">
                      <span className="text-sm font-black">$</span>
                    </div>
                    <input
                      className="block w-full pl-10 pr-4 py-4 bg-surface-container-low border-none rounded-2xl focus:ring-4 focus:ring-primary/10 text-on-surface font-black text-lg transition-all"
                      type="number"
                      value={montoEntregado}
                      onChange={e => setMontoEntregado(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-[0.05em] text-on-surface-variant font-black">Descripción General</label>
                  <textarea
                    className="w-full rounded-2xl border-none bg-surface-container-low text-on-surface font-medium focus:ring-4 focus:ring-primary/10 placeholder:text-outline-variant/50 text-sm p-4 min-h-[92px] resize-none transition-all"
                    value={descripcion}
                    onChange={e => setDescripcion(e.target.value)}
                    placeholder="Contexto de la rendición..."
                  />
                </div>

                {/* NUEVO: Comprobante de anticipo */}
                <div className="space-y-4 md:col-span-2">
                  <label className="text-[10px] uppercase tracking-[0.05em] text-on-surface-variant font-black">Comprobante de Anticipo (Opcional)</label>
                  <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                    <label className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-outline-variant text-[11px] font-bold cursor-pointer hover:bg-surface-container-lowest transition-colors">
                      <span className="material-symbols-outlined text-lg">upload</span>
                      SELECCIONAR ARCHIVO
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setDocEntregaFile(f);
                            setDocEntregaName(f.name);
                          }
                        }}
                      />
                    </label>
                    <span className="text-xs text-on-surface-variant truncate font-medium">
                      {docEntregaName || "Ningún archivo seleccionado"}
                    </span>
                    {docEntregaFile && (
                      <button onClick={() => { setDocEntregaFile(null); setDocEntregaName(""); }} className="text-error">
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-on-surface-variant/60">Sube el comprobante de la transferencia o depósito entregado por la empresa.</p>
                </div>
              </div>

            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* Financial Summary Head */}
              <div className="flex justify-between items-center bg-inverse-surface text-inverse-on-surface p-6 rounded-2xl shadow-xl shadow-primary/5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Total Rendido</p>
                  <p className="text-2xl font-black">{toCLP(totalItems)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Balance General</p>
                  <p className={`text-2xl font-black ${balance >= 0 ? "text-secondary-fixed-dim" : "text-error-container"}`}>
                    {balance >= 0 ? "+" : ""}{toCLP(balance)}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-tighter opacity-60">
                    {balance >= 0 ? "A Reembolsar al Empleado" : "A Devolver por el Empleado"}
                  </p>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-[0.05em] text-on-surface-variant font-black block">Desglose de Gastos</label>
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                  {items.map((it, idx) => (
                    <div key={idx} className="p-6 border border-outline-variant/10 rounded-2xl bg-surface-container-low relative hover:border-outline-variant transition-all group animate-in fade-in slide-in-from-right-4 duration-300">
                      <button onClick={() => removeItem(idx)} className="absolute top-4 right-4 text-outline hover:text-error transition-colors">
                        <span className="material-symbols-outlined text-xl">delete</span>
                      </button>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-[9px] font-bold text-outline uppercase mb-1">Descripción del Ítem</label>
                          <input className="w-full rounded-lg border-none bg-surface-container-lowest text-on-surface font-medium text-sm focus:ring-2 focus:ring-primary/20 h-10 px-3 transition-colors" value={it.descripcion} onChange={e => updateItem(idx, "descripcion", e.target.value)} placeholder="Ej: Pasajes, almuerzo, etc." />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-outline uppercase mb-1">Monto ($)</label>
                          <input className="w-full rounded-lg border-none bg-surface-container-lowest text-on-surface font-black text-sm focus:ring-2 focus:ring-primary/20 h-10 px-3" type="number" value={it.monto} onChange={e => updateItem(idx, "monto", e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-outline uppercase mb-1">Categoría</label>
                          <select className="w-full rounded-lg border-none bg-surface-container-lowest text-on-surface font-bold text-sm focus:ring-2 focus:ring-primary/20 h-10 px-3 cursor-pointer" value={it.categoria} onChange={e => updateItem(idx, "categoria", e.target.value)}>
                            {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </div>
                        <div className="md:col-span-4 flex items-center gap-4 mt-2 p-3 bg-surface-container-lowest/50 rounded-xl border border-outline-variant/5">
                          <label className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-outline-variant/30 text-[10px] font-bold cursor-pointer hover:bg-white transition-all shadow-sm">
                            <span className="material-symbols-outlined text-[16px]">attach_file</span>
                            {it.comprobante_file ? "CAMBIAR BOLETA" : "ADJUNTAR BOLETA"}
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  updateItem(idx, "comprobante_file", f);
                                  updateItem(idx, "comprobante_name", f.name);
                                }
                              }}
                            />
                          </label>
                          <span className="text-[10px] text-on-surface-variant truncate font-medium flex-1">
                            {it.comprobante_name || "Sin comprobante adjunto"}
                          </span>
                          {it.comprobante_file && (
                            <button onClick={() => { updateItem(idx, "comprobante_file", null); updateItem(idx, "comprobante_name", ""); }} className="text-error/70 hover:text-error transition-colors">
                              <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={addItem} className="w-full py-6 border-2 border-dashed border-outline-variant/30 rounded-2xl text-outline hover:text-on-surface hover:border-primary transition-all font-bold uppercase text-xs tracking-widest bg-surface-container-low/30 flex items-center justify-center gap-2 group">
                  <span className="material-symbols-outlined group-hover:scale-110 transition-transform">add_circle</span>
                  Añadir nuevo gasto
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-8 py-6 bg-surface-container-low border-t border-surface-container flex items-center justify-between">
          <button
            onClick={() => step === 2 ? setStep(1) : onClose()}
            className="px-6 py-2.5 text-sm font-bold text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-2 uppercase tracking-widest"
          >
            <span className="material-symbols-outlined text-lg">{step === 1 ? "close" : "arrow_back"}</span>
            {step === 1 ? "Cancelar" : "Volver"}
          </button>

          <button
            onClick={() => step === 1 ? setStep(2) : handleSave()}
            disabled={loading}
            className="px-8 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary text-xs font-black rounded-lg shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2 uppercase tracking-widest disabled:opacity-50 active:scale-95"
          >
            {loading ? "Procesando..." : (
              <>
                {step === 1 ? "Siguiente Paso" : "Finalizar Rendición"}
                <span className="material-symbols-outlined text-lg">{step === 1 ? "arrow_forward" : "check_circle"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
