"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  CheckSquare,
  Square,
  Building,
  Briefcase,
  Wrench,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter,
  Search,
} from "lucide-react";

function toCLP(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function fmtDate(v) {
  if (!v) return "—";
  return String(v);
}

export default function ImportRcvModal({
  open,
  onClose,
  records = [],
  proyectos = [],
  onImport,
  importing,
}) {
  // Lista local con las asignaciones de cada fila
  const [items, setItems] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  // Estado para la barra de asignación masiva
  const [bulkMainType, setBulkMainType] = useState("PROYECTO");
  const [bulkSubType, setBulkSubType] = useState("TALLER");
  const [bulkProjectId, setBulkProjectId] = useState("");

  // Al abrir o cambiar los records iniciales, inicializamos items con destino por defecto
  useEffect(() => {
    if (!open || !records || records.length === 0) {
      setItems([]);
      setSelectedIndices(new Set());
      return;
    }

    const defaultProjId = proyectos.length > 0 ? proyectos[0].id : "";

    const initial = records.map((r, idx) => ({
      ...r,
      index: idx,
      // Destino por defecto: PROYECTO si hay proyectos disponibles, de lo contrario ADMINISTRACION PMC
      destino: "PROYECTO",
      centro_costo: "PMC",
      proyecto_id: defaultProjId,
    }));

    setItems(initial);
    setSelectedIndices(new Set());
    if (defaultProjId) {
      setBulkProjectId(defaultProjId);
    }
  }, [open, records, proyectos]);

  // Selección individual
  const toggleSelect = (idx) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Selección masiva
  const toggleSelectAll = () => {
    if (selectedIndices.size === items.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(items.map((it) => it.index)));
    }
  };

  // Actualizar una fila individual
  const updateItem = (index, updates) => {
    setItems((prev) =>
      prev.map((it) => (it.index === index ? { ...it, ...updates } : it))
    );
  };

  // Aplicar asignación masiva a los seleccionados
  const applyBulkAssign = () => {
    if (selectedIndices.size === 0) return;

    setItems((prev) =>
      prev.map((it) => {
        if (!selectedIndices.has(it.index)) return it;

        if (bulkMainType === "PROYECTO") {
          return {
            ...it,
            destino: "PROYECTO",
            centro_costo: null,
            proyecto_id: bulkProjectId || (proyectos.length > 0 ? proyectos[0].id : null),
          };
        }

        return {
          ...it,
          destino: bulkSubType,
          centro_costo: bulkMainType,
          proyecto_id: null,
        };
      })
    );
  };

  const getMainSelectValue = (item) => {
    if (item.destino === "PROYECTO") return "PROYECTO";
    if (item.centro_costo === "PUQ") return "PUQ";
    return "PMC";
  };

  const getSubSelectValue = (item) => {
    if (item.destino === "TALLER") return "TALLER";
    return "ADMINISTRACION";
  };

  const handleMainChange = (index, val) => {
    if (val === "PROYECTO") {
      updateItem(index, {
        destino: "PROYECTO",
        centro_costo: null,
        proyecto_id: proyectos.length > 0 ? proyectos[0].id : null,
      });
    } else {
      const current = items.find((it) => it.index === index);
      const sub = current?.destino === "ADMINISTRACION" ? "ADMINISTRACION" : "TALLER";
      updateItem(index, {
        destino: sub,
        centro_costo: val,
        proyecto_id: null,
      });
    }
  };

  const handleSubChange = (index, val) => {
    updateItem(index, {
      destino: val,
      proyecto_id: null,
    });
  };

  // Filtrado por búsqueda
  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const q = searchTerm.toLowerCase();
    return items.filter(
      (it) =>
        it.folio?.toLowerCase().includes(q) ||
        it.razon_social?.toLowerCase().includes(q) ||
        it.rut_proveedor?.toLowerCase().includes(q)
    );
  }, [items, searchTerm]);

  // Resumen de distribución
  const summary = useMemo(() => {
    let countProy = 0;
    let countAdminPMC = 0;
    let countAdminPUQ = 0;
    let countTallerPMC = 0;
    let countTallerPUQ = 0;
    let totalMonto = 0;

    items.forEach((it) => {
      totalMonto += Number(it.monto_total || 0);
      if (it.destino === "PROYECTO") countProy++;
      else if (it.destino === "ADMINISTRACION" && it.centro_costo === "PUQ") countAdminPUQ++;
      else if (it.destino === "ADMINISTRACION") countAdminPMC++;
      else if (it.destino === "TALLER" && it.centro_costo === "PUQ") countTallerPUQ++;
      else if (it.destino === "TALLER") countTallerPMC++;
    });

    return { countProy, countAdminPMC, countAdminPUQ, countTallerPMC, countTallerPUQ, totalMonto };
  }, [items]);

  const handleSubmit = async () => {
    if (items.length === 0) return;
    await onImport(items);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={() => {
        if (!importing) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Clasificación de Documentos RCV
              </h2>
              <p className="text-xs text-slate-500">
                Asigna el Centro de Costo (Pto. Montt, Punta Arenas, Taller, Administración o Proyecto) antes de importar.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={importing}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Barra de Acciones Masivas y Búsqueda */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Asignación Masiva */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <CheckSquare size={15} className="text-primary" />
              Asignar {selectedIndices.size > 0 ? `(${selectedIndices.size})` : "seleccionados"} a:
            </span>

            {/* Selector Nivel 1: Proyecto, PMC o PUQ */}
            <select
              value={bulkMainType}
              onChange={(e) => setBulkMainType(e.target.value)}
              className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="PROYECTO">📁 Proyecto</option>
              <option value="PMC">🏢 Puerto Montt (PMC)</option>
              <option value="PUQ">🏢 Punta Arenas (PUQ)</option>
            </select>

            {/* Selector Nivel 2: Proyecto específico */}
            {bulkMainType === "PROYECTO" && (
              <select
                value={bulkProjectId}
                onChange={(e) => setBulkProjectId(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg max-w-[220px] text-slate-800 focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                {proyectos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            )}

            {/* Selector Nivel 2: Taller o Administración para PMC/PUQ */}
            {bulkMainType !== "PROYECTO" && (
              <select
                value={bulkSubType}
                onChange={(e) => setBulkSubType(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="TALLER">🔧 Taller</option>
                <option value="ADMINISTRACION">📋 Administración</option>
              </select>
            )}

            <button
              type="button"
              onClick={applyBulkAssign}
              disabled={selectedIndices.size === 0}
              className="px-4 py-1.5 bg-primary text-white hover:bg-primary/90 text-xs font-bold rounded-lg disabled:opacity-50 transition-all shadow-xs cursor-pointer"
            >
              Aplicar
            </button>
          </div>

          {/* Búsqueda rápida */}
          <div className="relative min-w-[240px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por folio, proveedor, RUT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {/* Tabla de Facturas y Selectores de Asignación */}
        <div className="flex-1 overflow-y-auto max-h-[50vh] p-0">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIndices.size === items.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3">Folio / Tipo</th>
                <th className="px-4 py-3">Proveedor / RUT</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-right">Monto Total</th>
                <th className="px-4 py-3">Centro de Costo / Asignación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const isSelected = selectedIndices.has(item.index);
                const mainVal = getMainSelectValue(item);

                return (
                  <tr
                    key={item.index}
                    onClick={(e) => {
                      if (e.target.closest("select") || e.target.closest("button")) return;
                      toggleSelect(item.index);
                    }}
                    className={`cursor-pointer select-none transition-colors border-b border-slate-100 ${
                      isSelected
                        ? "bg-blue-50/80 hover:bg-blue-100/70 text-slate-900"
                        : "hover:bg-slate-50/90"
                    }`}
                  >
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.index)}
                        className="rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer w-4 h-4"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-extrabold text-slate-900">
                        #{item.folio}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Doc. {item.tipo_doc || item["Tipo Doc"]}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800 truncate max-w-[200px]" title={item.razon_social}>
                        {item.razon_social}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.rut_proveedor}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                      {fmtDate(item.fecha_docto || item["Fecha Docto"])}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-900 whitespace-nowrap">
                      {toCLP(item.monto_total)}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Selector Nivel 1: Proyecto, PMC o PUQ */}
                        <select
                          value={mainVal}
                          onChange={(e) => handleMainChange(item.index, e.target.value)}
                          className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-primary/20 cursor-pointer"
                        >
                          <option value="PROYECTO">📁 Proyecto</option>
                          <option value="PMC">🏢 Puerto Montt (PMC)</option>
                          <option value="PUQ">🏢 Punta Arenas (PUQ)</option>
                        </select>

                        {/* Selector Nivel 2: Proyecto específico si aplica */}
                        {mainVal === "PROYECTO" && (
                          <select
                            value={item.proyecto_id || ""}
                            onChange={(e) =>
                              updateItem(item.index, { proyecto_id: e.target.value })
                            }
                            className="text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg max-w-[220px] text-slate-800 focus:ring-2 focus:ring-primary/20 cursor-pointer"
                          >
                            {proyectos.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre}
                              </option>
                            ))}
                          </select>
                        )}

                        {/* Selector Nivel 2: Taller o Administración si es PMC o PUQ */}
                        {mainVal !== "PROYECTO" && (
                          <select
                            value={getSubSelectValue(item)}
                            onChange={(e) => handleSubChange(item.index, e.target.value)}
                            className="text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-primary/20 cursor-pointer"
                          >
                            <option value="TALLER">🔧 Taller</option>
                            <option value="ADMINISTRACION">📋 Administración</option>
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer del Modal con Resumen de Asignación y Botón Confirmar */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>
              Total: <strong>{items.length} docs ({toCLP(summary.totalMonto)})</strong>
            </span>
            <span>•</span>
            <span className="text-blue-700 font-semibold">
              {summary.countProy} en Proyectos
            </span>
            <span>•</span>
            <span className="text-slate-700 font-semibold">
              {summary.countAdminPMC + summary.countTallerPMC} PMC
            </span>
            <span>•</span>
            <span className="text-indigo-700 font-semibold">
              {summary.countAdminPUQ + summary.countTallerPUQ} PUQ
            </span>
          </div>

          <div className="flex items-center gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={importing || items.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/20 disabled:opacity-60 cursor-pointer"
            >
              {importing ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                  Importando…
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Confirmar e Importar ({items.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
