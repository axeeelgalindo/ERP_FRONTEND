"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Search,
  Filter,
  Users,
  Palmtree,
  CheckCircle2,
  Clock,
  Sparkles,
  Download,
  Building,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from "lucide-react";
import { makeHeaders } from "@/lib/api";
import { calcularDiasHabilesVacaciones } from "@/lib/diasHabiles";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const MESES = [
  { val: "", label: "Todos los Meses" },
  { val: "1", label: "Enero" },
  { val: "2", label: "Febrero" },
  { val: "3", label: "Marzo" },
  { val: "4", label: "Abril" },
  { val: "5", label: "Mayo" },
  { val: "6", label: "Junio" },
  { val: "7", label: "Julio" },
  { val: "8", label: "Agosto" },
  { val: "9", label: "Septiembre" },
  { val: "10", label: "Octubre" },
  { val: "11", label: "Noviembre" },
  { val: "12", label: "Diciembre" },
];

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

function getNombreMes(mNum) {
  const found = MESES.find((m) => m.val === String(mNum));
  return found ? found.label.toUpperCase() : "—";
}

export default function VacacionesGeneralView({ session, onSelectEmpleado }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ saldos: [], vacaciones: [] });
  const [error, setError] = useState("");

  // Filtros
  const [subView, setSubView] = useState("registro"); // "registro" | "saldos" | "calendario"
  const [filtroSede, setFiltroSede] = useState("");
  const [filtroAno, setFiltroAno] = useState(String(new Date().getFullYear()));
  const [filtroMes, setFiltroMes] = useState("");
  const [filtroQ, setFiltroQ] = useState("");

  // Modal para registrar o editar vacación general
  const [showModal, setShowModal] = useState(false);
  const [editingVacacion, setEditingVacacion] = useState(null);
  const [formData, setFormData] = useState({
    empleado_id: "",
    desde: "",
    hasta: "",
    dias: 1,
    estado: "CONFIRMADO",
    detalle: "",
  });
  const [calcDetalle, setCalcDetalle] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Mes y Año para vista Calendario
  const [calAno, setCalAno] = useState(new Date().getFullYear());
  const [calMes, setCalMes] = useState(new Date().getMonth() + 1); // 1-12

  const fetchGeneralVacaciones = async () => {
    if (!session) return;
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (filtroSede) params.append("sede", filtroSede);
      if (filtroAno) params.append("ano", filtroAno);
      if (filtroMes) params.append("mes", filtroMes);
      if (filtroQ.trim()) params.append("q", filtroQ.trim());

      const res = await fetch(`${API_URL}/empleados/vacaciones/general?${params.toString()}`, {
        headers: makeHeaders(session),
      });

      if (!res.ok) {
        throw new Error("Error al obtener reporte general de vacaciones");
      }

      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGeneralVacaciones();
  }, [session, filtroSede, filtroAno, filtroMes, filtroQ]);

  // Lista de empleados activos para el selector del modal
  const listaEmpleados = useMemo(() => {
    return (data.saldos || []).map((s) => ({
      id: s.empleado_id,
      nombre: s.nombre,
      rut: s.rut,
      sede: s.sede,
    }));
  }, [data.saldos]);

  // Manejar apertura de creación
  const handleOpenCreate = () => {
    setEditingVacacion(null);
    const todayStr = new Date().toISOString().slice(0, 10);
    const calc = calcularDiasHabilesVacaciones(todayStr, todayStr);
    setCalcDetalle(calc);
    setFormData({
      empleado_id: listaEmpleados[0]?.id || "",
      desde: todayStr,
      hasta: todayStr,
      dias: calc.diasHabiles || 1,
      estado: "CONFIRMADO",
      detalle: "",
    });
    setFormError("");
    setShowModal(true);
  };

  // Manejar edición
  const handleOpenEdit = (v) => {
    setEditingVacacion(v);
    const dDesde = v.desde ? new Date(v.desde).toISOString().slice(0, 10) : "";
    const dHasta = v.hasta ? new Date(v.hasta).toISOString().slice(0, 10) : "";
    const calc = dDesde && dHasta ? calcularDiasHabilesVacaciones(dDesde, dHasta) : null;
    setCalcDetalle(calc);
    setFormData({
      empleado_id: v.empleado_id,
      desde: dDesde,
      hasta: dHasta,
      dias: v.dias || 1,
      estado: v.estado || "CONFIRMADO",
      detalle: v.detalle || "",
    });
    setFormError("");
    setShowModal(true);
  };

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

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.empleado_id) {
      setFormError("Debes seleccionar un trabajador");
      return;
    }
    if (!formData.desde || !formData.hasta) {
      setFormError("Debes indicar fecha 'Desde' y 'Hasta'");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const url = editingVacacion
        ? `${API_URL}/empleados/vacaciones/${editingVacacion.id}`
        : `${API_URL}/empleados/${formData.empleado_id}/vacaciones`;
      const method = editingVacacion ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: makeHeaders(session),
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || "Error al guardar vacación");
      }

      setShowModal(false);
      await fetchGeneralVacaciones();
    } catch (err) {
      setFormError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vacacionId) => {
    if (!confirm("¿Estás seguro de eliminar este registro de vacaciones?")) return;
    try {
      const res = await fetch(`${API_URL}/empleados/vacaciones/${vacacionId}`, {
        method: "DELETE",
        headers: makeHeaders(session),
      });
      if (res.ok) {
        await fetchGeneralVacaciones();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Métricas globales
  const metricas = useMemo(() => {
    const totalTrabajadores = data.saldos.length;
    const totalDiasTomados = data.saldos.reduce((acc, s) => acc + (s.dias_tomados || 0), 0);
    const totalSaldoDisponible = data.saldos.reduce((acc, s) => acc + (s.saldo_disponible || 0), 0);
    const totalPeriodos = data.vacaciones.length;

    return {
      totalTrabajadores,
      totalDiasTomados: Math.round(totalDiasTomados * 100) / 100,
      totalSaldoDisponible: Math.round(totalSaldoDisponible * 100) / 100,
      totalPeriodos,
    };
  }, [data]);

  // Generador de días para vista Calendario
  const diasMesCalendario = useMemo(() => {
    const totalDias = new Date(calAno, calMes, 0).getDate();
    const dias = [];
    for (let day = 1; day <= totalDias; day++) {
      const fechaActual = new Date(Date.UTC(calAno, calMes - 1, day));
      
      // Buscar qué vacaciones abarcan este día
      const ausentes = data.vacaciones.filter((v) => {
        const dDesde = new Date(v.desde);
        const dHasta = new Date(v.hasta);
        // Normalizar a fecha sin hora en UTC
        const tActual = fechaActual.getTime();
        const tDesde = Date.UTC(dDesde.getUTCFullYear(), dDesde.getUTCMonth(), dDesde.getUTCDate());
        const tHasta = Date.UTC(dHasta.getUTCFullYear(), dHasta.getUTCMonth(), dHasta.getUTCDate());
        return tActual >= tDesde && tActual <= tHasta;
      });

      dias.push({
        dia: day,
        fecha: fechaActual,
        diaSemana: fechaActual.getUTCDay(), // 0: Dom, 6: Sab
        ausentes,
      });
    }
    return dias;
  }, [calAno, calMes, data.vacaciones]);

  const prevMonth = () => {
    if (calMes === 1) {
      setCalMes(12);
      setCalAno((prev) => prev - 1);
    } else {
      setCalMes((prev) => prev - 1);
    }
  };

  const nextMonth = () => {
    if (calMes === 12) {
      setCalMes(1);
      setCalAno((prev) => prev + 1);
    } else {
      setCalMes((prev) => prev + 1);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* HEADER Y ACCIONES */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Palmtree className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Gestión Consolidada de Vacaciones
              </h2>
              <p className="text-xs text-slate-500">
                Control de devengo automático por sede (PMC 1.25 / PUQ 1.75 días/mes), ausencias e historial
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selector de subvista */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/60">
            <button
              onClick={() => setSubView("registro")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subView === "registro"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📋 Registro Vacaciones
            </button>
            <button
              onClick={() => setSubView("saldos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subView === "saldos"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📊 Resumen de Saldos
            </button>
            <button
              onClick={() => setSubView("calendario")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subView === "calendario"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📅 Calendario
            </button>
          </div>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Registrar Vacaciones
          </button>
        </div>
      </div>

      {/* METRICAS GLOBALES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Personal Activo
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">
              {metricas.totalTrabajadores}
            </span>
            <span className="text-xs font-semibold text-slate-500">trabajadores</span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Periodos Registrados
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-600">
              {metricas.totalPeriodos}
            </span>
            <span className="text-xs font-semibold text-slate-500">solicitudes</span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Días Tomados (Total)
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-600">
              {metricas.totalDiasTomados}
            </span>
            <span className="text-xs font-semibold text-slate-500">días</span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Saldo Disponible Empresa
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-600">
              {metricas.totalSaldoDisponible}
            </span>
            <span className="text-xs font-semibold text-slate-500">días hábiles</span>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sede */}
          <select
            value={filtroSede}
            onChange={(e) => setFiltroSede(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 cursor-pointer focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">🏢 Todas las Sedes</option>
            <option value="PMC">Puerto Montt (PMC - 1.25 d/m)</option>
            <option value="PUQ">Punta Arenas (PUQ - 1.75 d/m)</option>
          </select>

          {/* Año */}
          <select
            value={filtroAno}
            onChange={(e) => setFiltroAno(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 cursor-pointer focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Todos los Años</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>

          {/* Mes */}
          <select
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 cursor-pointer focus:ring-2 focus:ring-blue-500/20"
          >
            {MESES.map((m) => (
              <option key={m.val} value={m.val}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Buscador */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar trabajador o RUT..."
            value={filtroQ}
            onChange={(e) => setFiltroQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL SEGÚN SUBVISTA */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
          Cargando datos de vacaciones...
        </div>
      ) : error ? (
        <div className="bg-white p-8 rounded-2xl border border-red-200 text-center text-xs text-red-600 flex items-center justify-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      ) : subView === "registro" ? (
        /* VISTA 1: REGISTRO CONSOLIDADO (COMO SU EXCEL MEJORADO) */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Detalle Cronológico de Vacaciones
              </h3>
              <p className="text-xs text-slate-500">
                Listado consolidado de periodos tomados ({data.vacaciones.length} registros encontrados)
              </p>
            </div>
          </div>

          {data.vacaciones.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Palmtree className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No se encontraron vacaciones con los filtros seleccionados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Mes</th>
                    <th className="px-4 py-3">Trabajador / Cargo</th>
                    <th className="px-4 py-3">RUT</th>
                    <th className="px-4 py-3 text-center">Sede</th>
                    <th className="px-4 py-3 text-center">Total Días</th>
                    <th className="px-4 py-3">Desde</th>
                    <th className="px-4 py-3">Hasta</th>
                    <th className="px-4 py-3">Detalle / Observaciones</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.vacaciones.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-extrabold text-blue-700 uppercase whitespace-nowrap">
                        {getNombreMes(v.mes)} {v.ano}
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="font-bold text-slate-900 hover:text-blue-600 cursor-pointer"
                          onClick={() => onSelectEmpleado?.(v.empleado_id)}
                        >
                          {v.nombre}
                        </div>
                        <div className="text-[10px] text-slate-400">{v.cargo}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {v.rut}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          v.sede === "PUQ" ? "bg-indigo-100 text-indigo-800" : "bg-blue-100 text-blue-800"
                        }`}>
                          {v.sede || "PMC"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                          {v.dias} {v.dias === 1 ? "DÍA" : "DÍAS"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                        {fmtDate(v.desde)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                        {fmtDate(v.hasta)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700 max-w-[240px] truncate" title={v.detalle || ""}>
                          {v.detalle || <span className="text-slate-400 italic">confirmado</span>}
                        </p>
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
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(v)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar vacación"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(v.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar vacación"
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
      ) : subView === "saldos" ? (
        /* VISTA 2: RESUMEN DE SALDOS POR TRABAJADOR */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Saldos y Devengos por Trabajador
              </h3>
              <p className="text-xs text-slate-500">
                Cálculo automático según fecha de ingreso y tasa de sede (PMC: 1.25 d/m | PUQ: 1.75 d/m)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Trabajador / RUT</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3 text-center">Sede & Tasa</th>
                  <th className="px-4 py-3">Fecha Ingreso</th>
                  <th className="px-4 py-3 text-center">Antigüedad</th>
                  <th className="px-4 py-3 text-center">Días Devengados</th>
                  <th className="px-4 py-3 text-center">Días Tomados</th>
                  <th className="px-4 py-3 text-center">Saldo Disponible</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.saldos.map((s) => (
                  <tr key={s.empleado_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div
                        className="font-bold text-slate-900 hover:text-blue-600 cursor-pointer"
                        onClick={() => onSelectEmpleado?.(s.empleado_id)}
                      >
                        {s.nombre}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{s.rut}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {s.cargo}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.sede === "PUQ" ? "bg-indigo-100 text-indigo-800" : "bg-blue-100 text-blue-800"
                      }`}>
                        {s.sede || "PMC"} ({s.tasa_mensual} d/m)
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                      {fmtDate(s.fecha_ingreso)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-700">
                      {s.meses_trabajados} m
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-600">
                      {s.dias_acumulados.toFixed(2)} d
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-amber-600">
                      {s.dias_tomados.toFixed(2)} d
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-black px-2.5 py-1 rounded-lg text-xs ${
                        s.saldo_disponible < 0
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {s.saldo_disponible.toFixed(2)} días
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onSelectEmpleado?.(s.empleado_id)}
                        className="px-3 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                      >
                        Ver Perfil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VISTA 3: CALENDARIO MENSUAL / TIMELINE */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="font-extrabold text-slate-900 text-base">
                {getNombreMes(calMes)} {calAno}
              </h3>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Vista visual de trabajadores ausentes por día
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
            {diasMesCalendario.map((d) => {
              const esFinde = d.diaSemana === 0 || d.diaSemana === 6;
              const tieneAusentes = d.ausentes.length > 0;

              return (
                <div
                  key={d.dia}
                  className={`p-3 rounded-xl border min-h-[90px] flex flex-col justify-between transition-all ${
                    esFinde
                      ? "bg-slate-50/60 border-slate-100 opacity-60"
                      : tieneAusentes
                      ? "bg-blue-50/40 border-blue-200 shadow-xs"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">Día {d.dia}</span>
                    {tieneAusentes && (
                      <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.2 rounded-full">
                        {d.ausentes.length} {d.ausentes.length === 1 ? "ausente" : "ausentes"}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 space-y-1 overflow-y-auto max-h-[60px]">
                    {d.ausentes.map((a) => (
                      <div
                        key={a.id}
                        className="text-[10px] font-semibold bg-white border border-blue-100 text-blue-900 px-1.5 py-0.5 rounded shadow-2xs truncate"
                        title={`${a.nombre} (${a.sede})`}
                      >
                        🏖️ {a.nombre}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL GENERAL PARA CREAR / EDITAR VACACIONES */}
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
                  <p className="text-xs text-slate-500">Módulo general de RRHH</p>
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

              {/* Selector de Empleado */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Trabajador *
                </label>
                <select
                  required
                  disabled={Boolean(editingVacacion)}
                  value={formData.empleado_id}
                  onChange={(e) => setFormData({ ...formData, empleado_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">-- Seleccionar Trabajador --</option>
                  {listaEmpleados.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nombre} ({emp.rut}) - {emp.sede === "PUQ" ? "Punta Arenas" : "Puerto Montt"}
                    </option>
                  ))}
                </select>
              </div>

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
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 font-medium"
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
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 font-medium"
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
                    <span>🏖️ <strong>{calcDetalle.finesDeSemana}</strong> fines de semana (excluidos)</span>
                    {calcDetalle.feriadosCount > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-amber-800 font-semibold">
                          🎉 <strong>{calcDetalle.feriadosCount}</strong> {calcDetalle.feriadosCount === 1 ? "feriado" : "feriados"} (excluidos)
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    * Sábados, domingos y feriados no descuentan del saldo de vacaciones.
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
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estado
                  </label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 cursor-pointer"
                  >
                    <option value="CONFIRMADO">Confirmado</option>
                    <option value="AJUSTE">Ajuste</option>
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
                  placeholder="Ej: confirmado, vacaciones invierno, etc."
                  value={formData.detalle}
                  onChange={(e) => setFormData({ ...formData, detalle: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
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
    </div>
  );
}
