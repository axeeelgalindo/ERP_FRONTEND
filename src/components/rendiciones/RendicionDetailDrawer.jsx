import React, { useState, useEffect } from "react";
import { makeHeaders } from "@/lib/api";
import FilePreviewModal from "@/components/ui/FilePreviewModal";

function toCLP(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function fmtDateDMY(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  return `${dd}-${mm}-${yy}`;
}

export default function RendicionDetailDrawer({
  rendicion,
  open,
  onClose,
  onUpdateStatus,
  onUpdatePaidAmount,
  onRefresh,
  loading,
  session,
}) {
  const [editPaid, setEditPaid] = useState(false);
  const [newPaidAmount, setNewPaidAmount] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(null); // 'entrega' | 'reembolso'
  const [viewUrl, setViewUrl] = useState(null);

  // Estados para agregar ítems
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ descripcion: "", monto: "", fecha: new Date().toISOString().split("T")[0], categoria: "Gasto General" });
  const [savingItem, setSavingItem] = useState(false);

  // Estados para agregar anticipos
  const [isAddingAnticipo, setIsAddingAnticipo] = useState(false);
  const [newAnticipo, setNewAnticipo] = useState({ monto: "", file: null });
  const [savingAnticipo, setSavingAnticipo] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const getFullUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    const base = API_URL?.endsWith("/") ? API_URL.slice(0, -1) : API_URL;
    const path = url.startsWith("/") ? url : `/${url}`;
    return `${base}${path}`;
  };
  const [searchingCompras, setSearchingCompras] = useState(false);
  const [availableCompras, setAvailableCompras] = useState([]);
  const [loadingCompras, setLoadingCompras] = useState(false);
  const [compraSearch, setCompraSearch] = useState("");
  const fetchAvailableCompras = async (query = "") => {
    setLoadingCompras(true);
    try {
      const params = new URLSearchParams();
      params.append("page", "1");
      params.append("pageSize", "100");
      params.append("sinRendicion", "true");
      if (query.trim()) params.append("q", query);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/compras?${params.toString()}`, {
        headers: makeHeaders(session),
      });
      const data = await res.json();
      setAvailableCompras(data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCompras(false);
    }
  };

  // Debouncing de búsqueda
  useEffect(() => {
    if (!open || !rendicion || !searchingCompras) return;
    
    const delayDebounceFn = setTimeout(() => {
      fetchAvailableCompras(compraSearch);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [compraSearch, searchingCompras, open, rendicion]);

  if (!open || !rendicion) return null;



  const handleLinkCompra = async (compraId) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/compras/${compraId}/asignar-rendicion`, {
        method: "PATCH",
        headers: {
          ...makeHeaders(session),
        },
        body: JSON.stringify({ rendicion_id: rendicion.id }),
      });
      if (!res.ok) throw new Error("Error al vincular compra");

      setSearchingCompras(false);
      onRefresh?.();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleUnlinkCompra = async (compraId) => {
    if (!confirm("¿Desvincular esta compra de la rendición?")) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/compras/${compraId}/asignar-rendicion`, {
        method: "PATCH",
        headers: {
          ...makeHeaders(session),
        },
        body: JSON.stringify({ rendicion_id: null }),
      });
      if (!res.ok) throw new Error("Error al desvincular compra");

      onRefresh?.();
    } catch (e) {
      alert(e.message);
    }
  };

  const items = rendicion.items || [];
  const saldo = (rendicion.monto_entregado || 0) - (rendicion.monto_total || 0);

  const handleSavePaid = () => {
    const val = Number(newPaidAmount);
    if (isNaN(val) || val < 0) return alert("Monto inválido");

    // El máximo a liquidar es el valor absoluto del saldo
    const max = Math.abs(saldo);
    if (val > max + 0.01) { // Pequeño margen para redondeo
      alert(`El monto no puede superar el saldo pendiente de ${toCLP(max)}`);
      setNewPaidAmount(max);
      return;
    }

    onUpdatePaidAmount(rendicion.id, val);
    setEditPaid(false);
  };

  const handleMainDocUpload = async (type, file) => {
    if (!file) return;
    setUploadingDoc(type);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/rendiciones/${rendicion.id}/documento?type=${type}`, {
        method: "POST",
        headers: {
          ...makeHeaders(session, { skipContentType: true }),
        },
        body: fd,
      });

      if (!res.ok) throw new Error("Error al subir documento");
      onRefresh?.();
    } catch (e) {
      alert(e.message);
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleItemDocUpload = async (itemId, file) => {
    if (!file) return;
    setUploadingDoc(`item-${itemId}`);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/rendiciones/${rendicion.id}/items/${itemId}/comprobante`, {
        method: "POST",
        headers: {
          ...makeHeaders(session, { skipContentType: true }),
        },
        body: fd,
      });

      if (!res.ok) throw new Error("Error al subir comprobante");
      onRefresh?.();
    } catch (e) {
      alert(e.message);
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.descripcion || !newItem.monto) return alert("Complete los campos requeridos");
    setSavingItem(true);
    try {
      // Tomamos los items actuales y agregamos el nuevo
      const currentItems = (rendicion.items || []).map(it => ({
        linea: it.linea,
        fecha: it.fecha,
        descripcion: it.descripcion,
        monto: it.monto,
        categoria: it.categoria,
        comprobante_url: it.comprobante_url
      }));

      const payload = {
        items: [
          ...currentItems,
          {
            ...newItem,
            monto: Number(newItem.monto),
            linea: currentItems.length + 1
          }
        ]
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/rendiciones/${rendicion.id}`, {
        method: "PATCH",
        headers: makeHeaders(session),
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Error al agregar ítem");
      
      setIsAddingItem(false);
      setNewItem({ descripcion: "", monto: "", fecha: new Date().toISOString().split("T")[0], categoria: "Gasto General" });
      onRefresh?.();
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingItem(false);
    }
  };

  const handleAddAnticipo = async () => {
    if (!newAnticipo.monto) return alert("Indique el monto");
    setSavingAnticipo(true);
    try {
      const fd = new FormData();
      fd.append("monto", newAnticipo.monto);
      if (newAnticipo.file) fd.append("file", newAnticipo.file);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/rendiciones/${rendicion.id}/anticipos`, {
        method: "POST",
        headers: makeHeaders(session, { skipContentType: true }),
        body: fd
      });

      if (!res.ok) throw new Error("Error al agregar anticipo");

      setIsAddingAnticipo(false);
      setNewAnticipo({ monto: "", file: null });
      onRefresh?.();
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingAnticipo(false);
    }
  };

  const handleDeleteAnticipo = async (anticipoId) => {
    if (!confirm("¿Eliminar este anticipo?")) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/rendiciones/${rendicion.id}/anticipos/${anticipoId}`, {
        method: "DELETE",
        headers: makeHeaders(session)
      });
      if (!res.ok) throw new Error("Error al eliminar anticipo");
      onRefresh?.();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-[90] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      <aside className={`fixed inset-y-0 right-0 w-full max-w-[540px] bg-white shadow-2xl z-[100] flex flex-col transition-transform duration-500 ease-out transform ${open ? "translate-x-0" : "translate-x-full"}`}>
        {/* Header */}
        <header className="px-8 py-6 flex items-center justify-between bg-white border-b border-outline-variant/10">
          <div>
            <h1 className="text-on-surface font-bold text-xl tracking-tight leading-none mb-1">
              Rendición RD-{String(rendicion.id).slice(-6).toUpperCase()}
            </h1>
            <p className="text-on-surface-variant text-xs font-medium tracking-wide flex items-center gap-2 uppercase">
              <span className="material-symbols-outlined text-[16px]">account_tree</span>
              {rendicion.proyecto?.nombre || rendicion.centro_costo || rendicion.destino || "Sin Destino"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container-low transition-colors outline-none"
          >
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 pb-32 scrollbar-none">
          {/* Financial Summary: Bento Style */}
          <section className="grid grid-cols-3 gap-3">
            {/* Anticipo */}
            <div className="p-4 bg-white rounded-xl shadow-sm border-l-4 border-primary/40 flex flex-col justify-between min-h-[90px]">
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase mb-1 whitespace-nowrap overflow-hidden text-ellipsis">Fondo por rendir</p>
                <div className="flex items-center gap-1">
                  <p className="text-lg font-bold text-on-surface tracking-tight">{toCLP(rendicion.monto_entregado)}</p>
                  <button onClick={() => setIsAddingAnticipo(true)} className="text-primary hover:bg-primary/5 p-1 rounded-full"><span className="material-symbols-outlined text-[16px]">add_circle</span></button>
                </div>
              </div>
              <p className="text-[9px] text-on-surface-variant font-bold uppercase">{rendicion.anticipos?.length || 0} Anticipos</p>
            </div>

            {/* Rendido */}
            <div className="p-4 bg-white rounded-xl shadow-sm border-l-4 border-secondary/60 flex flex-col justify-between min-h-[90px]">
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase mb-1 whitespace-nowrap overflow-hidden text-ellipsis">Rendido</p>
                <p className="text-lg font-bold text-on-surface tracking-tight">{toCLP(rendicion.monto_total)}</p>
              </div>
              <p className="text-[9px] text-on-surface-variant font-bold uppercase">{items.length} Items</p>
            </div>

            {/* Balance */}
            <div className={`p-4 bg-white rounded-xl shadow-sm border-l-4 ${saldo < 0 ? "border-error" : "border-secondary"} flex flex-col justify-between min-h-[90px]`}>
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
                  {saldo < 0 ? "Reembolsar" : "Devolver"}
                </p>
                <p className={`text-lg font-bold tracking-tight ${saldo < 0 ? "text-error" : "text-primary"}`}>
                  {saldo > 0 ? "+" : ""}{toCLP(saldo)}
                </p>
              </div>
              <span className={`text-[9px] font-bold uppercase ${saldo < 0 ? "text-error/70" : "text-primary/70"}`}>
                {saldo < 0 ? "Empresa →" : "→ Empresa"}
              </span>
            </div>
          </section>

          {/* Settled / Remaining section */}
          <section className="bg-surface-container-low/50 p-5 rounded-2xl border border-outline-variant/10 flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-outline uppercase tracking-widest leading-none">
                {saldo <= 0 ? "Reembolsado" : "Devuelto"}
              </label>
              <div className="flex items-center gap-2">
                {editPaid ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="number"
                      className="w-24 h-7 text-xs border-primary rounded px-2 outline-none focus:ring-1 focus:ring-primary/30"
                      value={newPaidAmount}
                      onChange={(e) => setNewPaidAmount(e.target.value)}
                    />
                    <button onClick={handleSavePaid} className="bg-primary text-white text-[10px] px-2 py-1 rounded font-bold">OK</button>
                    <button onClick={() => setEditPaid(false)} className="text-outline text-[14px] p-1 font-bold">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <p className={`text-sm font-black ${saldo <= 0 ? "text-error" : "text-secondary"}`}>{toCLP(rendicion.monto_pagado)}</p>
                    {rendicion.estado?.toUpperCase() !== "PAGADA" && (
                      <button
                        onClick={() => {
                          setNewPaidAmount(rendicion.monto_pagado || 0);
                          setEditPaid(true);
                        }}
                        className="text-[10px] bg-white border border-outline-variant/20 px-1.5 py-0.5 rounded text-outline hover:text-on-surface transition-all uppercase font-bold"
                      >
                        Saldar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="text-right space-y-1">
              <label className="text-[10px] font-bold text-outline uppercase tracking-widest leading-none">Restante</label>
              <p className={`text-sm font-black ${Math.abs(Math.abs(saldo) - (rendicion.monto_pagado || 0)) < 1 ? "text-secondary" : "text-on-surface"}`}>
                {toCLP(Math.abs(Math.abs(saldo) - (rendicion.monto_pagado || 0)))}
              </p>
            </div>
          </section>

          {/* Documentos de Respaldo */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-on-surface tracking-tight uppercase tracking-wider">Anticipos y Transferencias</h3>
              <button 
                onClick={() => setIsAddingAnticipo(true)}
                className="text-[10px] font-black bg-primary text-white px-3 py-1 rounded-full shadow-sm hover:scale-105 transition-transform"
              >
                + AGREGAR
              </button>
            </div>

            {/* Formulario para nuevo anticipo */}
            {isAddingAnticipo && (
              <div className="p-4 bg-slate-50 border border-primary/20 rounded-xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Monto transferido</label>
                    <input 
                      type="number" 
                      placeholder="Monto"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary"
                      value={newAnticipo.monto}
                      onChange={e => setNewAnticipo({...newAnticipo, monto: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Comprobante (opcional)</label>
                    <label className="flex items-center gap-2 w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer hover:bg-slate-50 transition-colors">
                      <span className="material-symbols-outlined text-xs text-primary">{newAnticipo.file ? 'check_circle' : 'attach_file'}</span>
                      <span className="truncate">{newAnticipo.file ? newAnticipo.file.name : 'Subir archivo'}</span>
                      <input type="file" className="hidden" onChange={e => setNewAnticipo({...newAnticipo, file: e.target.files[0]})} />
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1 border-t border-slate-200">
                  <button 
                    onClick={() => { setIsAddingAnticipo(false); setNewAnticipo({ monto: "", file: null }); }}
                    className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase hover:text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button 
                    disabled={savingAnticipo}
                    onClick={handleAddAnticipo}
                    className="px-4 py-1.5 bg-primary text-white text-[10px] font-bold rounded-lg uppercase shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingAnticipo && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    Guardar Anticipo
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {/* Lista de Anticipos */}
              {(rendicion.anticipos || []).map((ant, index) => (
                <div key={ant.id} className="p-3 bg-surface-container-low rounded-xl flex items-center justify-between border border-outline-variant/10 group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-primary text-lg">payments</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-on-surface">Transferencia #{index + 1}</p>
                      <p className="text-[10px] text-on-surface-variant font-medium">Monto: {toCLP(ant.monto)} • {fmtDateDMY(ant.fecha)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {ant.doc_url && (
                      <button 
                        onClick={() => setViewUrl(getFullUrl(ant.doc_url))} 
                        className="p-1.5 hover:bg-surface-container-high rounded-lg text-primary transition-colors cursor-pointer"
                        title="Ver comprobante"
                      >
                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                      </button>
                    )}
                    <button 
                      onClick={() => handleDeleteAnticipo(ant.id)}
                      className="p-1.5 hover:bg-error/5 rounded-lg text-error/40 hover:text-error transition-colors cursor-pointer"
                      title="Eliminar registro"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}

              {(!rendicion.anticipos || rendicion.anticipos.length === 0) && !isAddingAnticipo && (
                <div 
                  onClick={() => setIsAddingAnticipo(true)}
                  className="h-16 border-2 border-dashed border-outline-variant/20 bg-surface-container-low/30 rounded-xl flex items-center justify-center gap-3 group cursor-pointer hover:border-primary/30 transition-all"
                >
                  <span className="material-symbols-outlined text-primary opacity-40 group-hover:scale-110 transition-transform">cloud_upload</span>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Agregar primer anticipo</span>
                </div>
              )}
            </div>
          </section>

          {/* Vincular Factura ERP */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-on-surface tracking-tight uppercase tracking-wider">Facturas ERP</h3>
              <button
                onClick={() => {
                  setSearchingCompras(!searchingCompras);
                  if (!searchingCompras) fetchAvailableCompras();
                }}
                className={`text-[10px] font-black px-4 py-1.5 rounded-full transition-all ${searchingCompras ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-primary/5 text-primary border border-primary/20 hover:bg-primary/10"}`}
              >
                {searchingCompras ? "CERRAR" : "+ VINCULAR ERP"}
              </button>
            </div>

            {searchingCompras ? (
              <div className="bg-surface-container-low rounded-xl p-4 space-y-3 border border-primary/10 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex flex-col gap-2 mb-2">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase">Facturas disponibles en contexto</p>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-xs text-outline">search</span>
                    <input
                      type="text"
                      placeholder="Buscar por folio o proveedor..."
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-outline-variant/20 rounded-lg text-[11px] focus:ring-1 focus:ring-primary outline-none transition-all"
                      value={compraSearch}
                      onChange={(e) => setCompraSearch(e.target.value)}
                    />
                  </div>
                </div>

                {loadingCompras ? (
                  <div className="h-12 animate-pulse bg-surface-container-high rounded-xl" />
                ) : availableCompras.length > 0 ? (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 scrollbar-none">
                    {availableCompras.map(c => (
                      <div key={c.id} className="p-3 bg-white rounded-xl border border-outline-variant/10 flex items-center justify-between hover:border-primary/30 transition-all group shadow-sm">
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="text-xs font-bold text-on-surface truncate">
                            {c.descripcion || (c.tipo_doc === 33 ? "Factura Electrónica" : "Documento")}
                          </span>
                          <span className="text-[10px] text-on-surface-variant font-medium uppercase tracking-tight truncate">
                            #{c.numero || c.folio} • {c.proveedor?.nombre?.slice(0, 25)}
                          </span>
                          <span className="text-[10px] text-primary font-black mt-0.5">{toCLP(c.monto_total || c.total)}</span>
                        </div>
                        <button
                          onClick={() => handleLinkCompra(c.id)}
                          className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-sm bg-surface-container-low"
                          title="Vincular a esta rendición"
                        >
                          <span className="material-symbols-outlined text-[18px]">link</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-center text-on-surface-variant py-8 opacity-60">
                    {compraSearch ? "No se encontraron facturas que coincidan." : "No se encontraron facturas pendientes."}
                  </p>
                )}
              </div>
            ) : rendicion.compras?.length > 0 ? (
              <div className="space-y-2">
                {rendicion.compras.map(c => (
                  <div key={c.id} className="p-4 bg-surface-container-low border border-outline-variant/10 rounded-xl flex items-center gap-4 group">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-on-surface-variant">receipt_long</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-on-surface truncate uppercase tracking-tight">{c.descripcion || `Doc #${c.numero || c.folio}`}</p>
                      <p className="text-[10px] text-on-surface-variant font-medium uppercase">{c.proveedor?.nombre}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-on-surface">{toCLP(c.monto_total || c.total)}</p>
                      <button
                        onClick={() => handleUnlinkCompra(c.id)}
                        className="text-[10px] text-error hover:underline font-bold uppercase tracking-tight opacity-40 group-hover:opacity-100 transition-opacity"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 bg-surface-container-low/50 rounded-xl flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-outline-variant text-[40px] mb-3 opacity-30">receipt_long</span>
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">Sin facturas vinculadas</p>
                <p className="text-[11px] text-on-surface-variant/60 mt-1 max-w-[200px]">Conecte con el módulo de compras para asociar comprobantes fiscales.</p>
              </div>
            )}
          </section>

          {/* Detalle de Gastos */}
          <section className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-on-surface tracking-tight uppercase tracking-wider">Detalle del Gasto</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsAddingItem(!isAddingItem)}
                  className="text-[10px] font-black px-3 py-1 bg-secondary text-white rounded-full transition-all hover:scale-105"
                >
                  {isAddingItem ? "CERRAR" : "+ AGREGAR GASTO"}
                </button>
                <span className="text-[11px] px-2.5 py-0.5 bg-surface-container-high text-on-surface-variant font-black rounded-full uppercase">{items.length} Items</span>
              </div>
            </div>

            {isAddingItem && (
              <div className="bg-slate-50 border border-secondary/20 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Descripción</label>
                    <input 
                      type="text" 
                      placeholder="Ej: Combustible, Peaje..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-secondary outline-none shadow-sm"
                      value={newItem.descripcion}
                      onChange={e => setNewItem({...newItem, descripcion: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Monto ($)</label>
                    <input 
                      type="number" 
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-secondary outline-none shadow-sm"
                      value={newItem.monto}
                      onChange={e => setNewItem({...newItem, monto: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Fecha</label>
                    <input 
                      type="date" 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-secondary outline-none shadow-sm"
                      value={newItem.fecha}
                      onChange={e => setNewItem({...newItem, fecha: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Categoría</label>
                    <select 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-secondary outline-none shadow-sm"
                      value={newItem.categoria}
                      onChange={e => setNewItem({...newItem, categoria: e.target.value})}
                    >
                      <option value="Combustible">Combustible</option>
                      <option value="Peaje">Peaje</option>
                      <option value="Alimentación">Alimentación</option>
                      <option value="Materiales">Materiales</option>
                      <option value="Transporte">Transporte</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    onClick={() => setIsAddingItem(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase"
                  >
                    Cancelar
                  </button>
                  <button 
                    disabled={savingItem}
                    onClick={handleAddItem}
                    className="px-6 py-2 bg-secondary text-white text-xs font-black rounded-xl shadow-md hover:bg-secondary/90 transition-all flex items-center gap-2"
                  >
                    {savingItem && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    Añadir Ítem
                  </button>
                </div>
              </div>
            )}
            <div className="bg-surface-container-low/30 rounded-2xl overflow-hidden border border-outline-variant/5">
              {items.map((it, idx) => (
                <div key={idx} className={`flex items-center p-4 hover:bg-surface-container-low/60 transition-colors group ${idx !== items.length - 1 ? 'border-b border-outline-variant/5' : ''}`}>
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm mr-4 border border-outline-variant/5 flex-shrink-0">
                    <span className="material-symbols-outlined text-on-surface-variant">
                      {it.descripcion?.toLowerCase().includes("almuerzo") || it.descripcion?.toLowerCase().includes("comida") || it.descripcion?.toLowerCase().includes("alimenta") ? "restaurant" :
                        it.descripcion?.toLowerCase().includes("bencina") || it.descripcion?.toLowerCase().includes("peaje") || it.descripcion?.toLowerCase().includes("transpo") ? "directions_car" :
                          it.descripcion?.toLowerCase().includes("material") || it.descripcion?.toLowerCase().includes("insumo") ? "construction" : "receipt"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface leading-tight truncate uppercase tracking-tight">{it.descripcion}</p>
                    <p className="text-[11px] text-on-surface-variant font-medium mt-0.5 uppercase tracking-tighter">
                      {it.categoria || "Gasto General"} • {fmtDateDMY(it.fecha)}
                    </p>
                  </div>
                  <div className="text-right ml-4 flex items-center gap-4">
                    <div className="flex flex-col items-end">
                      <p className="text-sm font-black text-on-surface">{toCLP(it.monto)}</p>
                      <p className={`text-[10px] font-bold uppercase tracking-tighter ${it.comprobante_url ? 'text-secondary' : 'text-on-surface-variant/40'}`}>
                        {it.comprobante_url ? 'COMPROBANTE OK' : 'SIN COMPROBANTE'}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {it.comprobante_url && (
                        <button 
                          onClick={() => setViewUrl(getFullUrl(it.comprobante_url))} 
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-primary transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[20px]">visibility</span>
                        </button>
                      )}
                      <label className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-outline-variant transition-colors cursor-pointer relative">
                        {uploadingDoc === `item-${it.id}` ? (
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-[20px]">{it.comprobante_url ? 'edit' : 'add_a_photo'}</span>
                        )}
                        <input 
                          type="file" 
                          className="hidden" 
                          onChange={(e) => handleItemDocUpload(it.id, e.target.files?.[0])} 
                          disabled={uploadingDoc === `item-${it.id}`}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <footer className="p-8 bg-white flex flex-col gap-3 shadow-[0_-8px_32px_rgba(0,0,0,0.06)] border-t border-outline-variant/10">
          {rendicion.estado?.toUpperCase() === "PENDIENTE" ? (
            <button
              onClick={() => onUpdateStatus(rendicion.id, "aprobada")}
              className="w-full h-12 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all uppercase tracking-widest text-sm"
            >
              <span className="material-symbols-outlined text-xl">check_circle</span>
              Aprobar Rendición
            </button>
          ) : (rendicion.estado?.toUpperCase() === "APROBADA" || rendicion.estado?.toUpperCase() === "PAGADA_PARCIAL") ? (
            <button
              onClick={() => {
                setNewPaidAmount(Math.abs(saldo));
                setEditPaid(true);
              }}
              className="w-full h-12 bg-secondary text-white font-black rounded-xl shadow-lg shadow-secondary/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all uppercase tracking-widest text-sm"
            >
              <span className="material-symbols-outlined text-xl">payments</span>
              {saldo < 0 ? "Saldar Reembolso" : "Saldar Devolución"}
            </button>
          ) : rendicion.estado?.toUpperCase() === "PAGADA" ? (
            <div className="w-full h-12 bg-surface-container-low rounded-xl flex items-center justify-center gap-3 text-secondary font-black uppercase tracking-widest text-sm border-2 border-dashed border-secondary/30">
              <span className="material-symbols-outlined text-xl">verified_user</span>
              Liquidación Finalizada
            </div>
          ) : null}

          {rendicion.estado?.toUpperCase() !== "PAGADA" && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onUpdateStatus(rendicion.id, "pendiente")}
                className="h-11 border border-outline-variant/60 text-on-surface font-bold rounded-xl hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2 uppercase tracking-tighter text-[11px]"
              >
                <span className="material-symbols-outlined text-xs">visibility</span>
                Observar
              </button>
              <button
                onClick={() => onUpdateStatus(rendicion.id, "rechazada")}
                className="h-11 border border-error/30 text-error font-bold rounded-xl hover:bg-error-container/10 transition-colors flex items-center justify-center gap-2 uppercase tracking-tighter text-[11px]"
              >
                <span className="material-symbols-outlined text-xs">cancel</span>
                Rechazar
              </button>
            </div>
          )}
        </footer>
      </aside>

      <FilePreviewModal 
        open={!!viewUrl} 
        url={viewUrl} 
        onClose={() => setViewUrl(null)} 
        title="Visor de Rendición"
      />
    </>
  );
}
