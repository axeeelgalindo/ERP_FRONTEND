"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import FacturaSelectorModal from "./FacturaSelectorModal";

function toCLP(v) {
  const n = Number(v ?? 0);
  return `$ ${n.toLocaleString("es-CL")}`;
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
  rendicionToEdit,
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
    {
      fecha: "",
      descripcion: "",
      monto: "",
      categoria: "",
      proveedor: "",
      rut_proveedor: "",
      tipo_doc: "BOLETA",
      folio: "",
      compra_id: null,
      comprobante_file: null,
      comprobante_name: "",
    },
  ]);

  // Modal selector de facturas ERP
  const [openFacturaSelector, setOpenFacturaSelector] = useState(false);
  const [activeItemIndexForFactura, setActiveItemIndexForFactura] = useState(null);

  // Data for selects
  const [proyectos, setProyectos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [filterQ, setFilterQ] = useState("");
  const [filterE, setFilterE] = useState("");

  const getFullUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    const base = apiBase?.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
    const path = url.startsWith("/") ? url : `/${url}`;
    return `${base}${path}`;
  };

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
      if (rendicionToEdit) {
        setStep(1);
        setDestino(rendicionToEdit.destino || "PROYECTO");
        setCentroCosto(rendicionToEdit.centro_costo || "");
        setProyectoId(rendicionToEdit.proyecto_id || "");
        setEmpleadoId(rendicionToEdit.empleado_id || "");
        setDescripcion(rendicionToEdit.descripcion || "");
        setMontoEntregado(rendicionToEdit.monto_entregado || "");
        setDocEntregaFile(null);
        setDocEntregaName(rendicionToEdit.doc_entrega_url ? "Comprobante cargado" : "");
        if (rendicionToEdit.items && rendicionToEdit.items.length > 0) {
          setItems(rendicionToEdit.items.map(it => ({
            id: it.id,
            fecha: it.fecha ? it.fecha.slice(0, 10) : "",
            descripcion: it.descripcion || "",
            monto: it.monto || "",
            categoria: it.categoria || "",
            proveedor: it.proveedor || "",
            rut_proveedor: it.rut_proveedor || "",
            tipo_doc: it.tipo_doc || "BOLETA",
            folio: it.folio || "",
            compra_id: it.compra_id || null,
            comprobante_url: it.comprobante_url || null,
            comprobante_file: null,
            comprobante_name: it.comprobante_url ? "Comprobante cargado" : ""
          })));
        } else {
          setItems([
            { fecha: "", descripcion: "", monto: "", categoria: "", proveedor: "", rut_proveedor: "", tipo_doc: "BOLETA", folio: "", compra_id: null, comprobante_file: null, comprobante_name: "" }
          ]);
        }
      } else {
        setStep(1);
        setDestino("PROYECTO");
        setCentroCosto("");
        setProyectoId("");
        const u = session?.user || session || {};
        const eId = u?.empleadoId ?? u?.empleado_id ?? u?.empleado?.id ?? "";
        setEmpleadoId(eId ? String(eId) : "");
        setDescripcion("");
        setMontoEntregado("");
        setDocEntregaFile(null);
        setDocEntregaName("");
        setItems([
          { fecha: "", descripcion: "", monto: "", categoria: "", proveedor: "", rut_proveedor: "", tipo_doc: "BOLETA", folio: "", compra_id: null, comprobante_file: null, comprobante_name: "" }
        ]);
      }
    }
  }, [open, rendicionToEdit]);

  async function loadInitialData() {
    if (!session) return;
    const token = session?.accessToken || session?.user?.accessToken || "";
    const empresaId =
      session?.user?.empresaId ??
      session?.empresaId ??
      session?.user?.empresa?.id ??
      session?.user?.empresa_id ??
      session?.empresa_id ??
      null;

    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
    };
    try {
      const [resP, resE, resProv] = await Promise.all([
        fetch(`${apiBase}/proyectos?pageSize=1000`, { headers }),
        fetch(`${apiBase}/empleados?pageSize=1000`, { headers }),
        fetch(`${apiBase}/proveedores?pageSize=1000`, { headers })
      ]);
      const dataP = await jsonOrNull(resP);
      const dataE = await jsonOrNull(resE);
      const dataProv = await jsonOrNull(resProv);

      const arrP = Array.isArray(dataP?.items) ? dataP.items : Array.isArray(dataP?.data) ? dataP.data : Array.isArray(dataP?.rows) ? dataP.rows : Array.isArray(dataP) ? dataP : [];
      const arrE = Array.isArray(dataE?.items) ? dataE.items : Array.isArray(dataE?.data) ? dataE.data : Array.isArray(dataE?.rows) ? dataE.rows : Array.isArray(dataE) ? dataE : [];
      const arrProv = Array.isArray(dataProv?.rows) ? dataProv.rows : Array.isArray(dataProv?.items) ? dataProv.items : Array.isArray(dataProv?.data) ? dataProv.data : Array.isArray(dataProv) ? dataProv : [];

      setProyectos(arrP);
      setEmpleados(arrE);
      setProveedores(arrProv.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
    } catch (e) {
      console.error(e);
      setProyectos([]);
      setEmpleados([]);
      setProveedores([]);
    }
  }

  const totalItems = useMemo(() => items.reduce((acc, it) => acc + Number(it.monto || 0), 0), [items]);
  const balance = totalItems - Number(montoEntregado || 0);

  const addItem = () =>
    setItems([
      ...items,
      {
        fecha: "",
        descripcion: "",
        monto: "",
        categoria: "",
        proveedor: "",
        rut_proveedor: "",
        tipo_doc: "BOLETA",
        folio: "",
        compra_id: null,
        comprobante_file: null,
        comprobante_name: "",
      },
    ]);
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx, patchOrKey, maybeVal) => {
    setItems((prevItems) =>
      prevItems.map((it, i) => {
        if (i !== idx) return it;
        if (typeof patchOrKey === "object" && patchOrKey !== null) {
          return { ...it, ...patchOrKey };
        }
        return { ...it, [patchOrKey]: maybeVal };
      })
    );
  };

  const handleSelectFactura = (compra) => {
    if (activeItemIndexForFactura === null || !compra) return;
    const rut = compra.rut_proveedor || compra.proveedor?.rut || "";
    const razon = compra.razon_social || compra.proveedor?.nombre || "";
    const folio = compra.folio || String(compra.numero || "");
    const fecha = compra.fecha_docto
      ? dayjs(compra.fecha_docto).format("YYYY-MM-DD")
      : dayjs(compra.creada_en).format("YYYY-MM-DD");
    const itemsDesc = (compra.items || [])
      .map((it) => it.item || it.tipoItem?.nombre)
      .filter(Boolean)
      .join(", ");
    const descFinal =
      itemsDesc ||
      compra.comentario_destino ||
      compra.sub_destino ||
      compra.observaciones ||
      "COMPRA FACTURA";

    let tipoDoc = "FACTURA";
    if (compra.tipo_doc === 34) tipoDoc = "FACTURA EXENTA";
    else if (compra.tipo_doc === 39 || compra.tipo_doc === 41) tipoDoc = "BOLETA";

    updateItem(activeItemIndexForFactura, {
      proveedor: razon,
      rut_proveedor: rut,
      tipo_doc: tipoDoc,
      folio,
      monto: compra.total || 0,
      fecha,
      descripcion: descFinal,
      compra_id: compra.id,
      is_manual_prov: true,
    });
  };

  const handleSave = async () => {
    setErr("");
    if (!empleadoId) return setErr("Seleccione un empleado");
    if (destino === "PROYECTO" && !proyectoId) return setErr("Seleccione un proyecto");
    if (destino !== "PROYECTO" && !centroCosto) return setErr("Seleccione un centro de costo");

    const validItems = items.filter(it => it.descripcion || it.monto || it.proveedor || it.compra_id);

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
          categoria: it.categoria || null,
          proveedor: it.proveedor || null,
          rut_proveedor: it.rut_proveedor || null,
          tipo_doc: it.tipo_doc || null,
          folio: it.folio || null,
          compra_id: it.compra_id || null,
          comprobante_url: it.comprobante_url || null
        }))
      };

      const token = session?.accessToken || session?.user?.accessToken || "";
      const empresaId = session?.user?.empresaId ?? session?.user?.empresa?.id ?? session?.empresaId ?? null;

      const url = rendicionToEdit 
        ? `${apiBase}/rendiciones/${rendicionToEdit.id}`
        : `${apiBase}/rendiciones`;
        
      const method = rendicionToEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
        },
        body: JSON.stringify(body)
      });

      const payload = await jsonOrNull(res);
      if (!res.ok) throw new Error(payload?.error || `Error al ${rendicionToEdit ? 'actualizar' : 'crear'}`);

      const rendId = rendicionToEdit ? payload.row?.id : payload.id;
      const createdItems = rendicionToEdit ? (payload.row?.items || []) : (payload.items || []);

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
            <h2 className="text-xl font-bold text-on-surface tracking-tight">{rendicionToEdit ? "Editar Rendición" : "Nueva Rendición"}</h2>
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
                    <span className="text-xs text-on-surface-variant truncate font-medium flex-1">
                      {docEntregaName || "Ningún archivo seleccionado"}
                    </span>
                    {!docEntregaFile && rendicionToEdit?.doc_entrega_url && (
                      <a
                        href={getFullUrl(rendicionToEdit.doc_entrega_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 hover:bg-white rounded-lg text-primary transition-colors cursor-pointer"
                        title="Ver comprobante actual"
                      >
                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                      </a>
                    )}
                    {(docEntregaFile || rendicionToEdit?.doc_entrega_url) && (
                      <button onClick={() => { setDocEntregaFile(null); setDocEntregaName(rendicionToEdit?.doc_entrega_url ? "Comprobante cargado" : ""); }} className="text-error">
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
                        {/* Selector / Input Proveedor */}
                        <div className="md:col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[9px] font-bold text-outline uppercase">
                              Proveedor
                            </label>
                            {it.is_manual_prov ? (
                              <button
                                type="button"
                                onClick={() => {
                                  updateItem(idx, "is_manual_prov", false);
                                  updateItem(idx, "proveedor", "");
                                  updateItem(idx, "rut_proveedor", "");
                                }}
                                className="text-[10px] text-primary font-bold hover:underline flex items-center gap-0.5"
                              >
                                <span className="material-symbols-outlined text-[14px]">list</span>
                                Elegir de lista
                              </button>
                            ) : null}
                          </div>

                          {!it.is_manual_prov ? (
                            <select
                              className="w-full rounded-lg border-none bg-surface-container-lowest text-on-surface font-bold text-sm focus:ring-2 focus:ring-primary/20 h-10 px-3 cursor-pointer"
                              value={
                                it.proveedor_id ||
                                proveedores.find(
                                  (p) =>
                                    p.nombre &&
                                    p.nombre.trim().toUpperCase() === (it.proveedor || "").trim().toUpperCase()
                                )?.id ||
                                (it.proveedor ? "__OTRO_MANUAL__" : "")
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "__OTRO_MANUAL__") {
                                  updateItem(idx, {
                                    is_manual_prov: true,
                                    proveedor: "",
                                    rut_proveedor: "",
                                    proveedor_id: "",
                                  });
                                } else if (!val) {
                                  updateItem(idx, {
                                    is_manual_prov: false,
                                    proveedor: "",
                                    rut_proveedor: "",
                                    proveedor_id: "",
                                  });
                                } else {
                                  const p = proveedores.find((prov) => String(prov.id) === String(val));
                                  if (p) {
                                    updateItem(idx, {
                                      is_manual_prov: false,
                                      proveedor: p.nombre,
                                      rut_proveedor: p.rut || "",
                                      proveedor_id: p.id,
                                    });
                                  }
                                }
                              }}
                            >
                              <option value="">-- Seleccionar Proveedor --</option>
                              {proveedores.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.nombre} {p.rut ? `(${p.rut})` : ""}
                                </option>
                              ))}
                              <option value="__OTRO_MANUAL__" className="font-bold text-primary">
                                + Agregar nuevo / No está en la lista
                              </option>
                            </select>
                          ) : (
                            <input
                              autoFocus
                              className="w-full rounded-lg border-none bg-surface-container-lowest text-on-surface font-medium text-sm focus:ring-2 focus:ring-primary/20 h-10 px-3 transition-colors uppercase"
                              value={it.proveedor || ""}
                              onChange={(e) => updateItem(idx, "proveedor", e.target.value)}
                              placeholder="Escribir nombre del proveedor..."
                            />
                          )}
                        </div>

                        {/* RUT Proveedor */}
                        <div>
                          <label className="block text-[9px] font-bold text-outline uppercase mb-1">
                            RUT Proveedor
                          </label>
                          <input
                            className={`w-full rounded-lg border-none text-on-surface font-medium text-sm focus:ring-2 focus:ring-primary/20 h-10 px-3 transition-colors ${
                              !it.is_manual_prov && it.proveedor
                                ? "bg-surface-container-lowest font-bold text-slate-700"
                                : "bg-surface-container-lowest"
                            }`}
                            value={it.rut_proveedor || ""}
                            onChange={(e) => updateItem(idx, "rut_proveedor", e.target.value)}
                            placeholder={it.proveedor ? "Sin RUT registrado" : "Ej: 76.123.456-7"}
                          />
                        </div>

                        {/* Tipo Documento */}
                        <div>
                          <label className="block text-[9px] font-bold text-outline uppercase mb-1">
                            Tipo Documento
                          </label>
                          <select
                            className="w-full rounded-lg border-none bg-surface-container-lowest text-on-surface font-bold text-sm focus:ring-2 focus:ring-primary/20 h-10 px-3 cursor-pointer uppercase"
                            value={it.tipo_doc || "BOLETA"}
                            onChange={(e) => updateItem(idx, "tipo_doc", e.target.value)}
                          >
                            <option value="BOLETA">BOLETA</option>
                            <option value="FACTURA">FACTURA</option>
                            <option value="FACTURA EXENTA">FACTURA EXENTA</option>
                            <option value="VOUCHER">VOUCHER</option>
                            <option value="BOLETA HONORARIOS">BOLETA HONORARIOS</option>
                            <option value="COMPROBANTE">COMPROBANTE</option>
                          </select>
                        </div>

                        {/* Folio / N° */}
                        <div>
                          <label className="block text-[9px] font-bold text-outline uppercase mb-1">
                            Folio / N° (Opcional)
                          </label>
                          <input
                            className="w-full rounded-lg border-none bg-surface-container-lowest text-on-surface font-medium text-sm focus:ring-2 focus:ring-primary/20 h-10 px-3 transition-colors"
                            value={it.folio || ""}
                            onChange={(e) => updateItem(idx, "folio", e.target.value)}
                            placeholder="Ej: 12345 (opcional)"
                          />
                        </div>

                        {/* Descripción */}
                        <div className="md:col-span-3">
                          <label className="block text-[9px] font-bold text-outline uppercase mb-1">Descripción del Ítem / Detalle</label>
                          <input className="w-full rounded-lg border-none bg-surface-container-lowest text-on-surface font-medium text-sm focus:ring-2 focus:ring-primary/20 h-10 px-3 transition-colors" value={it.descripcion} onChange={e => updateItem(idx, "descripcion", e.target.value)} placeholder="Ej: Almuerzo equipo, combustible ruta, etc." />
                        </div>

                        {/* Monto */}
                        <div>
                          <label className="block text-[9px] font-bold text-outline uppercase mb-1">Monto ($)</label>
                          <input className="w-full rounded-lg border-none bg-surface-container-lowest text-on-surface font-black text-sm focus:ring-2 focus:ring-primary/20 h-10 px-3" type="number" value={it.monto} onChange={e => updateItem(idx, "monto", e.target.value)} />
                        </div>

                        {/* Categoría */}
                        <div>
                          <label className="block text-[9px] font-bold text-outline uppercase mb-1">Categoría</label>
                          <select className="w-full rounded-lg border-none bg-surface-container-lowest text-on-surface font-bold text-sm focus:ring-2 focus:ring-primary/20 h-10 px-3 cursor-pointer" value={it.categoria} onChange={e => updateItem(idx, "categoria", e.target.value)}>
                            {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </div>
                        {/* Botón Vincular Factura ERP */}
                        <div className="md:col-span-4 flex items-center justify-between p-2.5 bg-primary/[0.03] rounded-xl border border-primary/10">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveItemIndexForFactura(idx);
                                setOpenFacturaSelector(true);
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                it.compra_id
                                  ? "bg-primary text-white shadow-sm"
                                  : "bg-surface text-primary border border-primary/30 hover:bg-primary hover:text-white"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                              {it.compra_id
                                ? `FACTURA ERP VINCULADA (FOLIO: ${it.folio || "S/N"})`
                                : "+ VINCULAR FACTURA DEL ERP"}
                            </button>
                            {it.compra_id && (
                              <button
                                type="button"
                                onClick={() => updateItem(idx, { compra_id: null })}
                                className="text-xs font-bold text-error/80 hover:text-error hover:underline ml-2"
                              >
                                Desvincular
                              </button>
                            )}
                          </div>
                          {it.compra_id && (
                            <span className="text-[11px] text-primary font-bold hidden sm:inline">
                              Datos y glosas importados desde el ERP
                            </span>
                          )}
                        </div>

                        <div className="md:col-span-4 flex items-center gap-4 mt-2 p-3 bg-surface-container-lowest/50 rounded-xl border border-outline-variant/5">
                          <label className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-outline-variant/30 text-[10px] font-bold cursor-pointer hover:bg-white transition-all shadow-sm">
                            <span className="material-symbols-outlined text-[16px]">attach_file</span>
                            {it.comprobante_file ? "CAMBIAR BOLETA" : it.comprobante_url ? "CAMBIAR BOLETA" : "ADJUNTAR BOLETA"}
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
                          {it.comprobante_url && !it.comprobante_file && (
                            <a
                              href={getFullUrl(it.comprobante_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 hover:bg-white rounded-lg text-primary transition-colors cursor-pointer"
                              title="Ver comprobante"
                            >
                              <span className="material-symbols-outlined text-[20px]">visibility</span>
                            </a>
                          )}
                          {(it.comprobante_file || it.comprobante_url) && (
                            <button 
                              onClick={() => { 
                                updateItem(idx, "comprobante_file", null); 
                                updateItem(idx, "comprobante_name", ""); 
                                updateItem(idx, "comprobante_url", null); 
                              }} 
                              className="text-error/70 hover:text-error transition-colors"
                            >
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
                {step === 1 ? "Siguiente Paso" : (rendicionToEdit ? "Guardar Cambios" : "Finalizar Rendición")}
                <span className="material-symbols-outlined text-lg">{step === 1 ? "arrow_forward" : "check_circle"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      <FacturaSelectorModal
        open={openFacturaSelector}
        onClose={() => {
          setOpenFacturaSelector(false);
          setActiveItemIndexForFactura(null);
        }}
        onSelect={handleSelectFactura}
        session={session}
        apiBase={apiBase}
      />
    </div>
  );
}
