"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Palmtree,
  Info,
  ChevronRight,
  HelpCircle,
  FileText,
} from "lucide-react";
import { makeHeaders } from "@/lib/api";
import { assignComprobanteToEmpleado } from "@/lib/comprobanteVacacionesPDF";
import ComprobanteVacacionesModal from "@/components/empleados/ComprobanteVacacionesModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function fmtDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  });
}

import { calcularDiasHabilesVacaciones } from "@/lib/diasHabiles";

export default function EmpleadoVacacionesTab({ empleado, session }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  // Modal para Comprobante de Vacaciones PDF
  const [comprobanteModalData, setComprobanteModalData] = useState(null);

  // Modal / Form para crear o editar
  const [showModal, setShowModal] = useState(false);
  const [editingVacacion, setEditingVacacion] = useState(null);
  const [formData, setFormData] = useState({
    desde: "",
    hasta: "",
    dias: 1,
    estado: "CONFIRMADO",
    detalle: ""
  });
  const [calcDetalle, setCalcDetalle] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Cargar datos de vacaciones del empleado
  const fetchVacaciones = async () => {
    if (!empleado?.id || !session) return;
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_URL}/empleados/${empleado.id}/vacaciones`, {
        headers: makeHeaders(session)
      });
      if (!res.ok) {
        throw new Error("Error al obtener información de vacaciones");
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message || "Error al cargar vacaciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVacaciones();
  }, [empleado?.id, session]);

  // Manejar apertura de modal para crear
  const handleOpenCreate = () => {
    setEditingVacacion(null);
    const todayStr = new Date().toISOString().slice(0, 10);
    const calc = calcularDiasHabilesVacaciones(todayStr, todayStr);
    setCalcDetalle(calc);
    setFormData({
      desde: todayStr,
      hasta: todayStr,
      dias: calc.diasHabiles || 1,
      estado: "CONFIRMADO",
      detalle: ""
    });
    setFormError("");
    setShowModal(true);
  };

  // Manejar apertura de modal para editar
  const handleOpenEdit = (v) => {
    setEditingVacacion(v);
    const dDesde = v.desde ? new Date(v.desde).toISOString().slice(0, 10) : "";
    const dHasta = v.hasta ? new Date(v.hasta).toISOString().slice(0, 10) : "";
    const calc = dDesde && dHasta ? calcularDiasHabilesVacaciones(dDesde, dHasta) : null;
    setCalcDetalle(calc);
    setFormData({
      desde: dDesde,
      hasta: dHasta,
      dias: v.dias || 1,
      estado: v.estado || "CONFIRMADO",
      detalle: v.detalle || ""
    });
    setFormError("");
    setShowModal(true);
  };

  // Actualizar días hábiles automáticamente al cambiar fechas
  const handleDateChange = (field, val) => {
    const nextForm = { ...formData, [field]: val };
    if (nextForm.desde && nextForm.hasta) {
      const calc = calcularDiasHabilesVacaciones(nextForm.desde, nextForm.hasta);
      setCalcDetalle(calc);
      if (calc.diasHabiles >= 0) {
        nextForm.dias = calc.diasHabiles;
      }
    } else {
      setCalcDetalle(null);
    }
    setFormData(nextForm);
  };

  // Guardar vacación
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.desde || !formData.hasta) {
      setFormError("Debes indicar fecha 'Desde' y 'Hasta'");
      return;
    }
    if (Number(formData.dias) <= 0) {
      setFormError("La cantidad de días debe ser mayor a 0");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const url = editingVacacion
        ? `${API_URL}/empleados/vacaciones/${editingVacacion.id}`
        : `${API_URL}/empleados/${empleado.id}/vacaciones`;
      const method = editingVacacion ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: makeHeaders(session),
        body: JSON.stringify(formData)
      });

      const savedVac = await res.json().catch(() => ({}));

      setShowModal(false);
      await fetchVacaciones();

      // Si fue un registro nuevo, auto-asignar PDF a documentos del empleado y abrir comprobante
      if (!editingVacacion) {
        const empPayload = {
          id: empleado.id,
          nombre: empleado?.usuario?.nombre || data?.nombre || "Funcionario",
          rut: empleado?.rut || data?.rut,
          cargo: empleado?.cargo || data?.cargo,
          sede: empleado?.sede || data?.sede || "PMC",
          fecha_ingreso: empleado?.fecha_ingreso || data?.fecha_ingreso,
        };
        const vacPayload = {
          ...savedVac,
          desde: formData.desde,
          hasta: formData.hasta,
          dias: Number(formData.dias),
          saldo_anterior: savedVac.saldo_anterior ?? saldoDisponible,
          saldo_pendiente: savedVac.saldo_pendiente ?? (saldoDisponible - Number(formData.dias)),
        };

        // Asignar en segundo plano a documentos (carpeta Vacaciones)
        assignComprobanteToEmpleado({
          session,
          empleadoId: empleado.id,
          vacacion: vacPayload,
          empleado: empPayload,
        }).catch((err) => console.error("Error auto-asignando PDF a documentos:", err));

        // Abrir modal de comprobante listo para imprimir o descargar
        setComprobanteModalData({
          vacacion: vacPayload,
          empleado: empPayload,
          isNewlyCreated: true,
        });
      }
    } catch (err) {
      setFormError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenComprobante = (v) => {
    const empPayload = {
      id: empleado.id,
      nombre: empleado?.usuario?.nombre || data?.nombre || "Funcionario",
      rut: empleado?.rut || data?.rut,
      cargo: empleado?.cargo || data?.cargo,
      sede: empleado?.sede || data?.sede || "PMC",
      fecha_ingreso: empleado?.fecha_ingreso || data?.fecha_ingreso,
    };
    const vacPayload = {
      ...v,
      saldo_anterior: v.saldo_anterior ?? (saldoDisponible != null ? Number(saldoDisponible) + Number(v.dias) : null),
      saldo_pendiente: v.saldo_pendiente ?? saldoDisponible,
    };
    setComprobanteModalData({
      vacacion: vacPayload,
      empleado: empPayload,
      isNewlyCreated: false,
    });
  };

  // Eliminar vacación
  const handleDelete = async (vacacionId) => {
    if (!confirm("¿Estás seguro de eliminar este registro de vacaciones?")) return;
    try {
      const res = await fetch(`${API_URL}/empleados/vacaciones/${vacacionId}`, {
        method: "DELETE",
        headers: makeHeaders(session)
      });
      if (res.ok) {
        await fetchVacaciones();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const sede = data?.sede || empleado?.sede || "PMC";
  const tasaMensual = data?.tasa_mensual ?? (sede === "PUQ" ? 1.75 : 1.25);
  const diasAcumulados = data?.dias_acumulados ?? 0;
  const diasTomados = data?.dias_tomados ?? 0;
  const saldoDisponible = data?.saldo_disponible ?? 0;
  const mesesTrabajados = data?.meses_trabajados ?? 0;
  const vacaciones = data?.vacaciones || [];

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-100/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Palmtree className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-base">
                Régimen de Vacaciones
              </h3>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                sede === "PUQ" 
                  ? "bg-indigo-100 text-indigo-800 border border-indigo-200" 
                  : "bg-blue-100 text-blue-800 border border-blue-200"
              }`}>
                Sede: {sede === "PUQ" ? "Punta Arenas (PUQ)" : "Puerto Montt (PMC)"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <span>Tasa: <strong>{tasaMensual} días/mes</strong></span>
              <span>•</span>
              <span>Ingreso: <strong>{fmtDate(empleado?.fecha_ingreso)}</strong></span>
              <span>•</span>
              <span>Antigüedad: <strong>{mesesTrabajados} meses</strong></span>
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Registrar Vacaciones
        </button>
      </div>

      {/* Tarjetas de Métricas de Saldo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Acumulados */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Días Devengados
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-600">
              {diasAcumulados.toFixed(2)}
              <span className="text-xs font-semibold text-slate-400 ml-1">días</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Calculados desde {fmtDate(empleado?.fecha_ingreso)}
            </p>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
        </div>

        {/* Tomados */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Días Tomados
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-600">
              {diasTomados.toFixed(2)}
              <span className="text-xs font-semibold text-slate-400 ml-1">días</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {vacaciones.length} {vacaciones.length === 1 ? "periodo tomado" : "periodos tomados"}
            </p>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
        </div>

        {/* Saldo Disponible */}
        <div className={`p-5 rounded-2xl border shadow-xs flex flex-col justify-between relative overflow-hidden ${
          saldoDisponible < 0 
            ? "bg-red-50/50 border-red-200" 
            : "bg-blue-50/50 border-blue-200"
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${
              saldoDisponible < 0 ? "text-red-500" : "text-blue-600"
            }`}>
              Saldo Disponible
            </span>
            <div className={`p-1.5 rounded-lg ${
              saldoDisponible < 0 ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
            }`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-black ${
              saldoDisponible < 0 ? "text-red-600" : "text-blue-700"
            }`}>
              {saldoDisponible.toFixed(2)}
              <span className="text-xs font-semibold text-slate-400 ml-1">días</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Disponibles para solicitar
            </p>
          </div>
        </div>
      </div>

      {/* Historial de Periodos de Vacaciones */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Historial de Vacaciones y Ausencias
            </h4>
            <p className="text-xs text-slate-500">
              Registro cronológico de periodos tomados
            </p>
          </div>
          <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
            {vacaciones.length} {vacaciones.length === 1 ? "registro" : "registros"}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Cargando historial de vacaciones...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-red-500 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        ) : vacaciones.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center justify-center text-slate-400">
            <Palmtree className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">No hay periodos de vacaciones registrados</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Haz clic en "Registrar Vacaciones" para añadir el primer periodo tomado por este empleado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Periodo (Desde - Hasta)</th>
                  <th className="px-4 py-3 text-center">Días Tomados</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Observaciones / Detalle</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vacaciones.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        {fmtDate(v.desde)} — {fmtDate(v.hasta)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                        {v.dias} {v.dias === 1 ? "día" : "días"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        v.estado === "CONFIRMADO"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : v.estado === "AJUSTE"
                          ? "bg-blue-100 text-blue-800 border border-blue-200"
                          : "bg-amber-100 text-amber-800 border border-amber-200"
                      }`}>
                        {v.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700 max-w-[280px] truncate" title={v.detalle || "Sin detalle"}>
                        {v.detalle || <span className="text-slate-400 italic">Sin observaciones</span>}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenComprobante(v)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Comprobante de Vacaciones (PDF para imprimir y firmar)"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(v)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar periodo"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar periodo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PARA REGISTRAR / EDITAR VACACIONES */}
      {showModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scaleUp">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-600 font-bold">
                  <Palmtree className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {editingVacacion ? "Editar Periodo de Vacaciones" : "Registrar Vacaciones"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {empleado?.usuario?.nombre || "Empleado"} ({sede})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Desde *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.desde}
                    onChange={(e) => handleDateChange("desde", e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hasta *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.hasta}
                    onChange={(e) => handleDateChange("hasta", e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              {/* DESGLOSE EXPLICATIVO DE DÍAS HÁBILES Y FERIADOS */}
              {calcDetalle && (
                <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 text-xs text-slate-700 space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-blue-900">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      Cálculo legal (Días hábiles):
                    </span>
                    <span className="text-sm font-black text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200">
                      {calcDetalle.diasHabiles} {calcDetalle.diasHabiles === 1 ? "día a descontar" : "días a descontar"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>🗓️ <strong>{calcDetalle.diasTotales}</strong> corridos</span>
                    <span>•</span>
                    <span>🏖️ <strong>{calcDetalle.finesDeSemana}</strong> días fin de semana (excluidos)</span>
                    {calcDetalle.feriadosCount > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-amber-800 font-semibold">
                          🎉 <strong>{calcDetalle.feriadosCount}</strong> {calcDetalle.feriadosCount === 1 ? "feriado legal" : "feriados legales"} (excluidos)
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    * Según Art. 67 y 69 del Código del Trabajo, sábados, domingos y feriados no se descuentan de las vacaciones.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Días a Descontar *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={formData.dias}
                    onChange={(e) => setFormData({ ...formData, dias: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estado
                  </label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-800 cursor-pointer"
                  >
                    <option value="CONFIRMADO">Confirmado</option>
                    <option value="AJUSTE">Ajuste / Regularización</option>
                    <option value="PENDIENTE">Pendiente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observaciones / Detalle
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Vacaciones verano 2026, viaje familiar..."
                  value={formData.detalle}
                  onChange={(e) => setFormData({ ...formData, detalle: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? "Guardando..." : editingVacacion ? "Actualizar" : "Guardar Vacaciones"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE COMPROBANTE DE VACACIONES PDF */}
      {comprobanteModalData && (
        <ComprobanteVacacionesModal
          isOpen={Boolean(comprobanteModalData)}
          onClose={() => setComprobanteModalData(null)}
          vacacion={comprobanteModalData.vacacion}
          empleado={comprobanteModalData.empleado}
          session={session}
          isNewlyCreated={comprobanteModalData.isNewlyCreated}
        />
      )}
    </div>
  );
}
