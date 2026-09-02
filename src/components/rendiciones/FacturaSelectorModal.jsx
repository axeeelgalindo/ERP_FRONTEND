"use client";

import React, { useState, useEffect } from "react";
import dayjs from "dayjs";

function toCLP(n) {
  const num = Number(n || 0);
  return `$ ${num.toLocaleString("es-CL")}`;
}

export default function FacturaSelectorModal({
  open,
  onClose,
  onSelect,
  session,
  apiBase,
}) {
  const [q, setQ] = useState("");
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(false);
  const [soloSinRendicion, setSoloSinRendicion] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const API_URL = apiBase || process.env.NEXT_PUBLIC_API_URL;

  const fetchCompras = async (searchTerm = "", currentPage = 1, filterSinRendicion = false) => {
    if (!open) return;
    setLoading(true);
    try {
      const token = session?.accessToken || session?.user?.accessToken || "";
      const empresaId =
        session?.user?.empresaId ??
        session?.empresaId ??
        session?.user?.empresa?.id ??
        session?.user?.empresa_id ??
        session?.empresa_id ??
        "";

      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
      };

      const params = new URLSearchParams();
      params.append("page", String(currentPage));
      params.append("pageSize", "50");
      if (filterSinRendicion) {
        params.append("sinRendicion", "true");
      }
      if (searchTerm.trim()) {
        params.append("q", searchTerm.trim());
      }

      const res = await fetch(`${API_URL}/compras?${params.toString()}`, { headers });
      const data = await res.json();

      const list = Array.isArray(data.data) ? data.data : Array.isArray(data.items) ? data.items : [];
      setCompras(list);
      setTotal(data.total || list.length);
    } catch (e) {
      console.error("Error al buscar compras:", e);
      setCompras([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setPage(1);
      fetchCompras(q, 1, soloSinRendicion);
    }
  }, [open, soloSinRendicion]);

  // Debounce de búsqueda
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setPage(1);
      fetchCompras(q, 1, soloSinRendicion);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-4xl max-h-[90vh] bg-surface rounded-2xl shadow-2xl border border-outline-variant/20 flex flex-col overflow-hidden animate-scale-up">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/15 bg-surface-container-low">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-primary/10 text-primary material-symbols-outlined text-2xl">
              receipt_long
            </span>
            <div>
              <h2 className="text-lg font-black text-on-surface tracking-tight">
                Vincular Factura del ERP
              </h2>
              <p className="text-xs text-on-surface-variant font-medium">
                Busca y selecciona una factura para asociarla a este ítem o rendición
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Barra de Búsqueda y Filtros */}
        <div className="p-5 border-b border-outline-variant/15 bg-surface-container-lowest/70 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant text-xl">
                search
              </span>
              <input
                type="text"
                autoFocus
                placeholder="Buscar por Folio, Proveedor, RUT, Glosa de ítem..."
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant/30 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none text-on-surface transition-all"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-on-surface-variant cursor-pointer select-none bg-surface-container-low px-3 py-2.5 rounded-xl border border-outline-variant/20 hover:bg-surface-container-high transition-colors">
              <input
                type="checkbox"
                checked={soloSinRendicion}
                onChange={(e) => setSoloSinRendicion(e.target.checked)}
                className="rounded border-outline-variant text-primary focus:ring-primary/20"
              />
              <span>Solo sin rendición</span>
            </label>
          </div>
        </div>

        {/* Listado de Facturas */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-outline">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold uppercase tracking-wider">Cargando facturas del ERP...</p>
            </div>
          ) : compras.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-outline">
              <span className="material-symbols-outlined text-5xl mb-2 opacity-40">receipt</span>
              <p className="text-sm font-bold text-on-surface">No se encontraron facturas</p>
              <p className="text-xs text-on-surface-variant mt-1">
                Prueba con otro término de búsqueda o desmarca el filtro de "Solo sin rendición"
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {compras.map((c) => {
                const rut = c.rut_proveedor || c.proveedor?.rut || "SIN RUT";
                const razon = c.razon_social || c.proveedor?.nombre || "PROVEEDOR DESCONOCIDO";
                const fecha = c.fecha_docto ? dayjs(c.fecha_docto).format("DD/MM/YYYY") : dayjs(c.creada_en).format("DD/MM/YYYY");
                const folio = c.folio || String(c.numero || "S/N");
                const itemsDesc = (c.items || [])
                  .map((it) => it.item || it.tipoItem?.nombre)
                  .filter(Boolean)
                  .join(" • ");
                const glosa = itemsDesc || c.comentario_destino || c.sub_destino || c.observaciones || "Sin glosa registrada";

                const yaAsignada = !!c.rendicion_id || !!c.rendicion;

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      onSelect(c);
                      onClose();
                    }}
                    className="p-4 rounded-xl bg-surface border border-outline-variant/20 hover:border-primary/50 hover:bg-primary/[0.02] transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group shadow-sm"
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-xs flex-shrink-0 group-hover:scale-105 transition-transform">
                        {c.tipo_doc === 34 ? "EX" : "FAC"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-on-surface bg-surface-container-high px-2 py-0.5 rounded-md">
                            FOLIO #{folio}
                          </span>
                          <span className="text-xs font-bold text-on-surface truncate">
                            {razon}
                          </span>
                          <span className="text-[11px] text-on-surface-variant font-mono">
                            ({rut})
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant font-medium mt-1 truncate" title={glosa}>
                          {glosa}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-outline font-medium">
                          <span>Fecha: {fecha}</span>
                          {c.destino && (
                            <span className="uppercase">
                              Imputación: {c.destino} {c.centro_costo || ""}
                            </span>
                          )}
                          {yaAsignada && (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.2 rounded font-bold">
                              En Rendición
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-1 border-t md:border-t-0 pt-2 md:pt-0 border-outline-variant/10">
                      <span className="text-base font-black text-on-surface">
                        {toCLP(c.total)}
                      </span>
                      <button
                        type="button"
                        className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold shadow-sm group-hover:bg-primary/90 transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        Vincular
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-outline-variant/15 bg-surface-container-low flex items-center justify-between text-xs text-on-surface-variant">
          <span>Mostrando {compras.length} de {total} facturas encontradas</span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase text-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
