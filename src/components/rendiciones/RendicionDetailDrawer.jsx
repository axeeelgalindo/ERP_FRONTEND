import React, { useState } from "react";
import { makeHeaders } from "@/lib/api";

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
  const [searchingCompras, setSearchingCompras] = useState(false);
  const [availableCompras, setAvailableCompras] = useState([]);
  const [loadingCompras, setLoadingCompras] = useState(false);

  if (!open || !rendicion) return null;

  const fetchAvailableCompras = async () => {
    setLoadingCompras(true);
    try {
      const params = new URLSearchParams({
        sinRendicion: "true",
        pageSize: "100",
      });
      if (rendicion.proyecto_id) params.append("proyectoId", rendicion.proyecto_id);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/compras?${params.toString()}`, {
        headers: makeHeaders(session),
      });
      const data = await res.json();
      
      // Filtrado extra por destino/centro para asegurar compatibilidad total si no es proyecto
      const compatible = (data.data || []).filter(c => {
        if (rendicion.proyecto_id) return c.proyecto_id === rendicion.proyecto_id;
        return c.destino === rendicion.destino && c.centro_costo === rendicion.centro_costo;
      });

      setAvailableCompras(compatible);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCompras(false);
    }
  };

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
  const saldo = (rendicion.monto_total || 0) - (rendicion.monto_entregado || 0);

  const handleSavePaid = () => {
    const val = Number(newPaidAmount);
    if (isNaN(val) || val < 0) return alert("Monto inválido");
    
    const max = Math.abs(saldo);
    if (val > max) {
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
          ...makeHeaders(session),
        },
        body: fd,
      });

      if (!res.ok) throw new Error("Error al subir documento");
      alert("Documento subido con éxito");
      onRefresh?.();
    } catch (e) {
      alert(e.message);
    } finally {
      setUploadingDoc(null);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[100] w-full max-w-xl bg-white shadow-2xl flex flex-col transition-transform duration-300 transform translate-x-0">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50 sticky top-0 z-10 transition-colors">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <span className="bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
              Rendición
            </span>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              RD-{String(rendicion.id).slice(-6).toUpperCase()}
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Creada el {fmtDateDMY(rendicion.creado_en)} por {rendicion.empleado?.nombre || "Empleado"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-200 rounded-full transition-colors font-bold text-slate-400 hover:text-slate-900"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Info Grid (Look Financiero) */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Monto Entregado</label>
            <p className="text-sm font-black text-slate-900">{toCLP(rendicion.monto_entregado)}</p>
            {rendicion.doc_entrega_url ? (
              <a href={`${process.env.NEXT_PUBLIC_API_URL}${rendicion.doc_entrega_url}`} target="_blank" className="text-[9px] text-blue-600 font-bold uppercase underline">Ver Comprobante</a>
            ) : (
              <label className="text-[9px] text-slate-400 font-bold uppercase cursor-pointer hover:text-slate-900">
                + Subir
                <input type="file" className="hidden" onChange={(e) => handleMainDocUpload("entrega", e.target.files?.[0])} />
              </label>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Monto Rendido</label>
            <p className="text-sm font-black text-slate-900">{toCLP(rendicion.monto_total)}</p>
          </div>

          <div className="space-y-1 border-t border-slate-200 pt-3">
             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                {saldo >= 0 ? "A Reembolsar" : "A Devolver"}
             </label>
             <p className={`text-lg font-black ${saldo >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                {toCLP(Math.abs(saldo))}
             </p>
          </div>

          <div className="space-y-1 border-t border-slate-200 pt-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Liquidado (Pagado)</label>
            <div className="flex items-center gap-2">
              <p className="text-sm font-black text-emerald-600">{toCLP(rendicion.monto_pagado)}</p>
              <button 
                onClick={() => {
                  setNewPaidAmount(rendicion.monto_pagado || 0);
                  setEditPaid(!editPaid);
                }}
                className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-400 hover:text-slate-900 transition-colors uppercase font-bold"
              >
                {editPaid ? "✕" : "Modificar"}
              </button>
            </div>
            {rendicion.doc_reembolso_url ? (
              <a href={`${process.env.NEXT_PUBLIC_API_URL}${rendicion.doc_reembolso_url}`} target="_blank" className="text-[9px] text-blue-600 font-bold uppercase underline">Ver Comprobante Final</a>
            ) : (
               <label className="text-[9px] text-slate-400 font-bold uppercase cursor-pointer hover:text-slate-900">
                + Comprobante Pago/Dev
                <input type="file" className="hidden" onChange={(e) => handleMainDocUpload("reembolso", e.target.files?.[0])} />
              </label>
            )}

            {editPaid && (
              <div className="mt-2 flex gap-2">
                <input 
                  type="number"
                  value={newPaidAmount}
                  onChange={(e) => setNewPaidAmount(e.target.value)}
                  className="w-full text-xs p-1 border rounded outline-none focus:ring-1 focus:ring-slate-900"
                  placeholder="Monto..."
                />
                <button 
                  onClick={handleSavePaid}
                  className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded"
                >
                  OK
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Info Grid 2 */}
        <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
           <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Estado</label>
            <p className="text-sm font-black text-slate-900 uppercase">{rendicion.estado}</p>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Proyecto / Centro</label>
            <p className="text-sm font-bold text-slate-700">{rendicion.proyecto?.nombre || rendicion.centro_costo || "-"}</p>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2">
            Ítems de la Rendición
          </h3>
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={idx} className="p-4 bg-white border border-slate-100 rounded-xl hover:border-slate-300 transition-all flex justify-between items-center group">
                <div className="space-y-0.5">
                  <p className="text-xs text-slate-400 font-bold">{fmtDateDMY(it.fecha)} · {it.categoria || "Gasto"}</p>
                  <p className="text-sm font-bold text-slate-800">{it.descripcion}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="text-sm font-black text-slate-900">{toCLP(it.monto)}</p>
                  {it.comprobante_url && (
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_URL}${it.comprobante_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-tighter"
                    >
                      Ver Comprobante ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Related Compras */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">
                Documentos ERP Vinculados
              </h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Vínculo con facturas oficiales en el sistema.</p>
            </div>
            <button 
              onClick={() => {
                setSearchingCompras(!searchingCompras);
                if (!searchingCompras) fetchAvailableCompras();
              }}
              className={`text-[10px] font-bold px-3 py-1 rounded-full transition-all uppercase tracking-tighter ${
                searchingCompras ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
              }`}
            >
              {searchingCompras ? "Cerrar" : "+ Vincular Factura"}
            </button>
          </div>

          {searchingCompras && (
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-tight">Seleccionar Factura para vincular</p>
              {loadingCompras ? (
                <div className="py-4 flex justify-center">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : availableCompras.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-2 bg-white/50 rounded-lg">No hay facturas compatibles sin rendición.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {availableCompras.map(c => (
                    <div key={c.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-blue-100/50 shadow-sm hover:border-blue-300 transition-colors group">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900">Folio {c.folio || c.numero}</span>
                        <span className="text-[10px] text-slate-500 font-medium">{c.proveedor?.nombre || "Sin Proveedor"}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">{toCLP(c.total)}</span>
                      </div>
                      <button 
                        onClick={() => handleLinkCompra(c.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-lg transition-all active:scale-95 shadow-sm"
                      >
                        Vincular
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {rendicion.compras?.length > 0 ? (
              <>
                <div className="space-y-2">
                  {rendicion.compras.map((c) => (
                    <div key={c.id} className="flex justify-between items-center text-sm p-4 bg-white border border-slate-100 rounded-xl hover:border-slate-200 transition-all shadow-sm group">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 font-black text-[10px]">
                           DOC
                         </div>
                         <div className="flex flex-col">
                            <span className="font-bold text-slate-900 text-xs">#{c.numero} {c.proveedor?.nombre && `· ${c.proveedor.nombre}`}</span>
                            <span className="text-[10px] text-slate-400 font-medium">Documento Vinculado</span>
                         </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-black text-slate-900 text-xs">{toCLP(c.total)}</span>
                        <button 
                          onClick={() => handleUnlinkCompra(c.id)}
                          className="text-[9px] text-rose-500 hover:text-rose-700 font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Quitar Vínculo
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Comparación de Totales */}
                <div className="mt-4 p-4 bg-slate-900 rounded-2xl text-white space-y-2 shadow-xl">
                  <div className="flex justify-between items-center opacity-60">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Total Rendido</span>
                    <span className="text-xs font-bold">{toCLP(rendicion.monto_total)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Total Documentado (ERP)</span>
                    <span className="text-xs font-black text-emerald-400">
                      {toCLP(rendicion.compras.reduce((acc, c) => acc + (c.total || 0), 0))}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Calce de Gastos</span>
                    <span className={`text-sm font-black ${
                      Math.abs(rendicion.monto_total - rendicion.compras.reduce((acc, c) => acc + (c.total || 0), 0)) < 10 
                        ? "text-emerald-400" 
                        : "text-amber-400"
                    }`}>
                      {rendicion.monto_total - rendicion.compras.reduce((acc, c) => acc + (c.total || 0), 0) === 0 
                        ? "MATCH TOTAL" 
                        : `Diferencia: ${toCLP(rendicion.monto_total - rendicion.compras.reduce((acc, c) => acc + (c.total || 0), 0))}`}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                 <p className="text-xs text-slate-400 font-bold uppercase tracking-tighter">Sin facturas vinculadas</p>
                 <button 
                  onClick={() => {
                    setSearchingCompras(true);
                    fetchAvailableCompras();
                  }}
                  className="mt-2 text-[10px] font-black text-blue-600 hover:underline uppercase"
                 >
                   Vincular ahora
                 </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-8 border-t border-slate-100 bg-white sticky bottom-0 z-10 flex flex-wrap gap-3">
        {rendicion.estado?.toUpperCase() === "PENDIENTE" && (
          <button
            onClick={() => onUpdateStatus(rendicion.id, "aprobada")}
            disabled={loading}
            className="flex-1 min-w-[120px] py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-95 disabled:opacity-50"
          >
            Aprobar
          </button>
        )}
        {(rendicion.estado?.toUpperCase() === "PENDIENTE" || rendicion.estado?.toUpperCase() === "APROBADA") && (
          <button
            onClick={() => onUpdateStatus(rendicion.id, "rechazada")}
            disabled={loading}
            className="flex-1 min-w-[120px] py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg shadow-rose-100 transition-all active:scale-95 disabled:opacity-50"
          >
            Rechazar
          </button>
        )}
        {(rendicion.estado?.toUpperCase() === "PENDIENTE" || rendicion.estado?.toUpperCase() === "APROBADA" || rendicion.estado?.toUpperCase() === "PAGADA_PARCIAL") && (
          <button
            onClick={() => {
              setNewPaidAmount(Math.abs(saldo));
              setEditPaid(true);
            }}
            disabled={loading}
            className="flex-1 min-w-[120px] py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-100 transition-all active:scale-95 disabled:opacity-50"
          >
            Saldar Balance
          </button>
        )}
        <button
          onClick={onClose}
          className="px-6 py-3 border border-slate-200 text-slate-500 font-bold text-sm uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all"
        >
          Cerrar
        </button>
      </div>

      {/* Overlay to close when clicking outside */}
      <div
        className="fixed inset-0 -z-10 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
    </div>
  );
}
