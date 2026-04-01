import React, { useState } from "react";

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
  loading,
}) {
  const [editPaid, setEditPaid] = useState(false);
  const [newPaidAmount, setNewPaidAmount] = useState("");

  if (!open || !rendicion) return null;

  const items = rendicion.items || [];
  const saldo = Math.max(0, (rendicion.monto_total || 0) - (rendicion.monto_pagado || 0));

  const handleSavePaid = () => {
    const val = Number(newPaidAmount);
    if (isNaN(val) || val < 0) return alert("Monto inválido");
    onUpdatePaidAmount(rendicion.id, val);
    setEditPaid(false);
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
        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
           <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Estado</label>
            <p className="text-sm font-black text-slate-900">{rendicion.estado?.toUpperCase()}</p>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Monto Total</label>
            <p className="text-lg font-black text-slate-900">{toCLP(rendicion.monto_total)}</p>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Pagado</label>
            <div className="flex items-center gap-2">
              <p className="text-sm font-black text-emerald-600">{toCLP(rendicion.monto_pagado)}</p>
              <button 
                onClick={() => {
                  setNewPaidAmount(rendicion.monto_pagado || 0);
                  setEditPaid(!editPaid);
                }}
                className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-400 hover:text-slate-900 transition-colors uppercase font-bold"
              >
                {editPaid ? "Cancelar" : "Editar"}
              </button>
            </div>
            {editPaid && (
              <div className="mt-2 flex gap-2">
                <input 
                  type="number"
                  value={newPaidAmount}
                  onChange={(e) => setNewPaidAmount(e.target.value)}
                  className="w-full text-xs p-1 border rounded outline-none focus:ring-1 focus:ring-slate-900"
                  placeholder="Monto pagado..."
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
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Saldo Pendiente</label>
            <p className={`text-sm font-black ${saldo > 0 ? "text-amber-600" : "text-slate-400"}`}>{toCLP(saldo)}</p>
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
        {rendicion.compras?.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2">
              Facturas/Compras Vinculadas
            </h3>
            <div className="space-y-2">
              {rendicion.compras.map((c) => (
                <div key={c.id} className="flex justify-between items-center text-sm p-3 bg-slate-50/50 rounded-lg group">
                  <span className="font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Compra #{c.numero}</span>
                  <span className="font-bold text-slate-800">{toCLP(c.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
        {(rendicion.estado?.toUpperCase() === "PENDIENTE" || rendicion.estado?.toUpperCase() === "APROBADA" || rendicion.estado?.toUpperCase() === "PAGADA_PARCIAL") && saldo > 0 && (
          <button
            onClick={() => {
              setNewPaidAmount(rendicion.monto_total);
              setEditPaid(true);
            }}
            disabled={loading}
            className="flex-1 min-w-[120px] py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-100 transition-all active:scale-95 disabled:opacity-50"
          >
            Pagar Todo
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
