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
  const [items, setItems] = useState([
    { fecha: "", descripcion: "", monto: "", categoria: "", comprobante_file: null, comprobante_name: "" }
  ]);

  // Data for selects
  const [proyectos, setProyectos] = useState([]);
  const [empleados, setEmpleados] = useState([]);

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

      console.log("DEBUG RendicionModal:", { 
        urlP: `${apiBase}/proyectos?pageSize=1000`,
        okP: resP.ok,
        dataP,
        dataE 
      });

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">Nueva Rendición de Gastos</h1>
            <p className="text-sm text-slate-500 mt-1">Complete los datos generales y el detalle de gastos.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 font-bold">✕</button>
        </div>

        <div className="p-8 max-h-[70vh] overflow-y-auto">
          {err && <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-700 text-sm rounded-xl font-medium">{err}</div>}

          {step === 1 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Empleado Responsable</label>
                    <select className="w-full rounded-xl border-slate-200 focus:ring-slate-900" value={empleadoId} onChange={e => setEmpleadoId(e.target.value)}>
                      <option value="">Seleccionar...</option>
                      {empleados.map(e => <option key={e.id} value={e.id}>{e.usuario?.nombre || e.rut}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Descripción General</label>
                    <textarea className="w-full rounded-xl border-slate-200 focus:ring-slate-900" rows={3} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Motivo de la rendición..." />
                  </div>
                </div>

                <div className="space-y-5 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Destino</label>
                    <select className="w-full rounded-xl border-slate-200 focus:ring-slate-900" value={destino} onChange={e => setDestino(e.target.value)}>
                      <option value="PROYECTO">Proyecto</option>
                      <option value="ADMINISTRACION">Administración</option>
                      <option value="TALLER">Taller</option>
                    </select>
                  </div>
                  {destino === "PROYECTO" ? (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Proyecto</label>
                      <select className="w-full rounded-xl border-slate-200 focus:ring-slate-900" value={proyectoId} onChange={e => setProyectoId(e.target.value)}>
                        <option value="">Seleccionar Proyecto...</option>
                        {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Centro de Costo</label>
                      <select className="w-full rounded-xl border-slate-200 focus:ring-slate-900" value={centroCosto} onChange={e => setCentroCosto(e.target.value)}>
                        <option value="">Seleccionar...</option>
                        <option value="PMC">PMC</option>
                        <option value="PUQ">PUQ</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Monto Entregado (Anticipo)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <input className="w-full pl-7 rounded-xl border-slate-200 focus:ring-slate-900 font-bold" type="number" value={montoEntregado} onChange={e => setMontoEntregado(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-200 mb-8">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Rendido</p>
                  <p className="text-2xl font-black">{toCLP(totalItems)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Balance</p>
                  <p className={`text-2xl font-black ${balance >= 0 ? "text-blue-400" : "text-rose-400"}`}>{toCLP(Math.abs(balance))}</p>
                  <p className="text-[10px] font-bold uppercase tracking-tighter opacity-60">{balance >= 0 ? "A Reembolsar" : "A Devolver"}</p>
                </div>
              </div>

              <div className="space-y-4">
                {items.map((it, idx) => (
                  <div key={idx} className="p-6 border border-slate-200 rounded-2xl bg-white relative hover:border-slate-400 transition-all group">
                    <button onClick={() => removeItem(idx)} className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors">🗑️</button>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Descripción</label>
                        <input className="w-full rounded-lg border-slate-200 text-sm" value={it.descripcion} onChange={e => updateItem(idx, "descripcion", e.target.value)} placeholder="Ej: Pasajes, almuerzo..." />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Monto</label>
                        <input className="w-full rounded-lg border-slate-200 text-sm font-bold" type="number" value={it.monto} onChange={e => updateItem(idx, "monto", e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Categoría</label>
                        <select className="w-full rounded-lg border-slate-200 text-sm" value={it.categoria} onChange={e => updateItem(idx, "categoria", e.target.value)}>
                          {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addItem} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 hover:border-slate-900 transition-all font-bold uppercase text-xs tracking-widest">+ Agregar Ítem</button>
              </div>
            </div>
          )}
        </div>

        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <button onClick={() => setStep(step === 1 ? 1 : 1)} className={`px-6 py-2.5 rounded-xl font-bold text-sm uppercase tracking-widest ${step === 2 ? "text-slate-600 hover:bg-slate-200" : "text-transparent pointer-events-none"}`}>Atrás</button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 text-sm uppercase tracking-widest">Cancelar</button>
            {step === 1 ? (
              <button onClick={() => setStep(2)} className="px-8 py-2.5 rounded-xl bg-slate-900 text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-slate-200 active:scale-95 transition-all">Siguiente Detail →</button>
            ) : (
              <button onClick={handleSave} disabled={loading} className="px-8 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-emerald-100 active:scale-95 transition-all disabled:opacity-50">
                {loading ? "Guardando..." : "Finalizar y Crear"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
