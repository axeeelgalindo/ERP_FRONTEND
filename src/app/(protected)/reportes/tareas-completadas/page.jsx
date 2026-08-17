"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { makeHeaders } from "@/lib/api";
import {
  CheckCircle2,
  Calendar,
  Users,
  Building2,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  TrendingUp,
  Clock,
  MapPin,
  Search,
  Award,
  Layers,
  BarChart3,
  RefreshCw,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Helper para obtener inicio y fin de la semana (Lunes a Domingo)
function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
    displayStart: monday.toLocaleDateString("es-CL", { day: "2-digit", month: "short" }),
    displayEnd: sunday.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }),
  };
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

// Helper para formatear a "Primer Nombre + Primer Apellido"
function formatShortName(fullName) {
  if (!fullName || typeof fullName !== "string") return "—";
  const s = fullName.trim();
  if (!s || s === "—" || s === "Sin asignar" || s === "No especificado" || s === "Sin Jefatura Asignada" || s === "Sin Jefatura") {
    return s;
  }

  // Caso 1: "Apellidos, Nombres" (ej: "Soto Concha, Marco Aurelio" -> "Marco Soto")
  if (s.includes(",")) {
    const parts = s.split(",");
    const apellidosPart = parts[0]?.trim() || "";
    const nombresPart = parts.slice(1).join(" ")?.trim() || "";
    const primerApellido = apellidosPart.split(/\s+/)[0] || "";
    const primerNombre = nombresPart.split(/\s+/)[0] || "";
    if (primerNombre && primerApellido) return `${primerNombre} ${primerApellido}`;
    return primerNombre || primerApellido || s;
  }

  // Caso 2: "Nombre1 Nombre2 Apellido1 Apellido2" (sin coma)
  const tokens = s.split(/\s+/);
  if (tokens.length <= 2) return s;
  if (tokens.length === 3) return `${tokens[0]} ${tokens[1]}`; // ej: "Marco Soto Concha" -> "Marco Soto"
  return `${tokens[0]} ${tokens[2]}`; // ej: "Marco Aurelio Soto Concha" -> "Marco Soto"
}

export default function ReporteTareasCompletadasPage() {
  const { data: session } = useSession();

  // Fechas de navegación
  const [currentWeekBase, setCurrentWeekBase] = useState(new Date());
  const weekInfo = useMemo(() => getWeekRange(currentWeekBase), [currentWeekBase]);

  const [fechaInicio, setFechaInicio] = useState(weekInfo.start);
  const [fechaFin, setFechaFin] = useState(weekInfo.end);

  // Sincronizar al cambiar de semana con flechas
  useEffect(() => {
    setFechaInicio(weekInfo.start);
    setFechaFin(weekInfo.end);
  }, [weekInfo]);

  // Filtros
  const [selectedJefe, setSelectedJefe] = useState("TODOS");
  const [selectedSede, setSelectedSede] = useState("TODAS");
  const [selectedDestino, setSelectedDestino] = useState("TODOS");
  const [searchTerm, setSearchTerm] = useState("");

  // Datos
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [data, setData] = useState({
    kpis: {
      total_completadas: 0,
      personas_activas: 0,
      tasa_promedio_por_persona: 0,
      porcentaje_a_tiempo: 100,
    },
    distribucion: {
      por_destino: { PROYECTO: 0, TALLER: 0, ADMINISTRACION: 0 },
      por_sede: { PMC: 0, PUQ: 0 },
      por_dia: [],
    },
    rendimiento_equipos: [],
    rendimiento_personas: [],
    jefaturas_disponibles: [],
    tareas: [],
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!session) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        ...(selectedJefe !== "TODOS" ? { jefe_id: selectedJefe } : {}),
        ...(selectedSede !== "TODAS" ? { sede: selectedSede } : {}),
        ...(selectedDestino !== "TODOS" ? { destino: selectedDestino } : {}),
      });

      const res = await fetch(`${API_URL}/reportes/tareas-completadas?${params.toString()}`, {
        headers: makeHeaders(session),
      });

      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Error al cargar reporte de tareas:", err);
    } finally {
      setLoading(false);
    }
  }, [session, fechaInicio, fechaFin, selectedJefe, selectedSede, selectedDestino]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Navegación rápida de semanas
  const handlePrevWeek = () => {
    const d = new Date(currentWeekBase);
    d.setDate(d.getDate() - 7);
    setCurrentWeekBase(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentWeekBase);
    d.setDate(d.getDate() + 7);
    setCurrentWeekBase(d);
  };

  const handleCurrentWeek = () => {
    setCurrentWeekBase(new Date());
  };

  // Filtrado en memoria para la tabla por buscador rápido
  const filteredTareas = useMemo(() => {
    if (!data.tareas) return [];
    if (!searchTerm.trim()) return data.tareas;
    const s = searchTerm.toLowerCase();
    return data.tareas.filter(
      (t) =>
        t.nombre?.toLowerCase().includes(s) ||
        formatShortName(t.completada_por_nombre).toLowerCase().includes(s) ||
        t.completada_por_nombre?.toLowerCase().includes(s) ||
        t.completada_por_cargo?.toLowerCase().includes(s) ||
        t.proyecto_nombre?.toLowerCase().includes(s) ||
        formatShortName(t.jefe_nombre).toLowerCase().includes(s) ||
        t.jefe_nombre?.toLowerCase().includes(s)
    );
  }, [data.tareas, searchTerm]);

  // Exportar a PDF (Continuidad estética formal Reporte de Costeo)
  const handleExportPDF = async () => {
    try {
      setExportingPdf(true);
      const { jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const autoTable = autoTableModule.default || autoTableModule;

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const mx = 14;

      // Colores corporativos
      const colors = {
        primary: [15, 41, 66], // #0f2942
        accent: [2, 132, 199], // #0284c7 Sky blue
        text: [51, 65, 85], // #334155
        lightBg: [248, 250, 252],
        border: [226, 232, 240],
      };

      // Header y Footer
      const drawHeader = () => {
        doc.setFillColor(...colors.primary);
        doc.rect(0, 0, W, 18, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text("BLUE INGENIERÍA SpA  |  CONTROL DE GESTIÓN OPERATIVA", mx, 11);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(
          `Semana: ${weekInfo.displayStart} al ${weekInfo.displayEnd}`,
          W - mx,
          11,
          { align: "right" }
        );
      };

      const drawFooter = (page, total) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Reporte Semanal de Tareas y Rendimiento por Equipos", mx, H - 6);
        doc.text(`Página ${page} de ${total}`, W - mx, H - 6, { align: "right" });
      };

      // Portada / Dashboard Page
      drawHeader();

      let y = 26;

      // Título
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(...colors.primary);
      doc.text("Reporte Semanal de Tareas Completadas", mx, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...colors.text);
      doc.text(
        `Período: ${fechaInicio} al ${fechaFin}   |   Filtro Sede: ${selectedSede}   |   Filtro Destino: ${selectedDestino}`,
        mx,
        y
      );
      y += 8;

      // Cards de KPIs Superiores
      const cardW = (W - mx * 2 - 9) / 4;
      const cardH = 18;

      // Card 1
      doc.setFillColor(238, 242, 255);
      doc.roundedRect(mx, y, cardW, cardH, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(67, 56, 202);
      doc.text("TOTAL TAREAS COMPLETADAS", mx + 4, y + 5.5);
      doc.setFontSize(13);
      doc.text(String(data.kpis.total_completadas || 0), mx + 4, y + 13.5);

      // Card 2
      doc.setFillColor(236, 253, 245);
      doc.roundedRect(mx + cardW + 3, y, cardW, cardH, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(4, 120, 87);
      doc.text("TASA PROMEDIO POR PERSONA", mx + cardW + 7, y + 5.5);
      doc.setFontSize(13);
      doc.text(`${data.kpis.tasa_promedio_por_persona || 0} tareas/colaborador`, mx + cardW + 7, y + 13.5);

      // Card 3
      doc.setFillColor(240, 249, 255);
      doc.roundedRect(mx + (cardW + 3) * 2, y, cardW, cardH, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(3, 105, 161);
      doc.text("CUMPLIMIENTO A TIEMPO", mx + (cardW + 3) * 2 + 4, y + 5.5);
      doc.setFontSize(13);
      doc.text(`${data.kpis.porcentaje_a_tiempo ?? 100}% en plazo`, mx + (cardW + 3) * 2 + 4, y + 13.5);

      // Card 4
      doc.setFillColor(254, 243, 199);
      doc.roundedRect(mx + (cardW + 3) * 3, y, cardW, cardH, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(180, 83, 9);
      doc.text("DISTRIBUCIÓN DE SEDES", mx + (cardW + 3) * 3 + 4, y + 5.5);
      doc.setFontSize(11);
      doc.text(
        `PMC: ${data.distribucion.por_sede.PMC || 0}  |  PUQ: ${data.distribucion.por_sede.PUQ || 0}`,
        mx + (cardW + 3) * 3 + 4,
        y + 13.5
      );

      y += cardH + 8;

      // Resumen por Equipos y Jefaturas
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...colors.primary);
      doc.text("Resumen de Desempeño por Equipos de Trabajo", mx, y);
      y += 4;

      const tablaEquipos = (data.rendimiento_equipos || []).map((eq) => [
        formatShortName(eq.jefe_nombre) || "Sin Jefatura",
        `${eq.miembros_activos_count || 0} pers.`,
        String(eq.total || 0),
        `${eq.tasa_por_persona || 0} tar/p`,
        String(eq.proyecto || 0),
        String(eq.taller || 0),
        String(eq.admin || 0),
        `PMC: ${eq.pmc || 0} / PUQ: ${eq.puq || 0}`,
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: mx, right: mx },
        head: [
          [
            "Jefatura / Equipo",
            "Personal Activo",
            "Total Tareas",
            "Tasa x Persona",
            "Proyecto",
            "Taller",
            "Admin",
            "Sedes (PMC/PUQ)",
          ],
        ],
        body: tablaEquipos.length > 0 ? tablaEquipos : [["Sin registros para el período", "", "", "", "", "", "", ""]],
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: {
          fillColor: colors.primary,
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      y = doc.lastAutoTable.finalY + 8;

      // Página 2: Detalle de tareas finalizadas
      doc.addPage();
      drawHeader();

      let y2 = 26;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...colors.primary);
      doc.text("Detalle Individual de Tareas Finalizadas en la Semana", mx, y2);
      y2 += 4;

      const tablaDetalle = (data.tareas || []).map((t, idx) => [
        String(idx + 1),
        t.nombre || "—",
        t.destino || "PROYECTO",
        t.sede || "PMC",
        `${formatShortName(t.completada_por_nombre)}\n(${t.completada_por_cargo || ""})`,
        formatShortName(t.jefe_nombre) || "—",
        t.proyecto_nombre || "—",
        `${formatDate(t.fecha_inicio_plan)}\nal\n${formatDate(t.fecha_fin_plan)}`,
        `${formatDate(t.fecha_inicio_real)}\nal\n${formatDate(t.completada_en || t.fecha_fin_real)}`,
        t.a_tiempo ? "A tiempo" : "Desviación",
      ]);

      autoTable(doc, {
        startY: y2,
        margin: { left: mx, right: mx },
        head: [
          [
            "#",
            "Tarea / Actividad",
            "Tipo",
            "Sede",
            "Finalizada Por",
            "Jefatura",
            "Proyecto / Área",
            "Plan (Ini - Fin)",
            "Real (Ini - Fin)",
            "Cumplimiento",
          ],
        ],
        body: tablaDetalle.length > 0 ? tablaDetalle : [["Sin tareas finalizadas", "", "", "", "", "", "", "", "", ""]],
        theme: "striped",
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: {
          fillColor: colors.primary,
          textColor: 255,
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 52 },
          2: { cellWidth: 24 },
          3: { cellWidth: 14 },
          4: { cellWidth: 36 },
          5: { cellWidth: 28 },
          6: { cellWidth: 35 },
          7: { cellWidth: 24 },
          8: { cellWidth: 24 },
          9: { cellWidth: 24 },
        },
      });

      // Numeración de páginas
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(i, totalPages);
      }

      doc.save(`Reporte_Tareas_Completadas_${fechaInicio}_${fechaFin}.pdf`);
    } catch (err) {
      console.error("Error al exportar PDF:", err);
      alert("No se pudo generar el PDF. Por favor reintenta.");
    } finally {
      setExportingPdf(false);
    }
  };

  // Cálculos de porcentajes para gráficos de barras CSS
  const totalDestinos =
    (data.distribucion.por_destino.PROYECTO || 0) +
    (data.distribucion.por_destino.TALLER || 0) +
    (data.distribucion.por_destino.ADMINISTRACION || 0);

  const pctProyecto = totalDestinos > 0 ? Math.round(((data.distribucion.por_destino.PROYECTO || 0) / totalDestinos) * 100) : 0;
  const pctTaller = totalDestinos > 0 ? Math.round(((data.distribucion.por_destino.TALLER || 0) / totalDestinos) * 100) : 0;
  const pctAdmin = totalDestinos > 0 ? Math.round(((data.distribucion.por_destino.ADMINISTRACION || 0) / totalDestinos) * 100) : 0;

  const totalSedes = (data.distribucion.por_sede.PMC || 0) + (data.distribucion.por_sede.PUQ || 0);
  const pctPMC = totalSedes > 0 ? Math.round(((data.distribucion.por_sede.PMC || 0) / totalSedes) * 100) : 0;
  const pctPUQ = totalSedes > 0 ? Math.round(((data.distribucion.por_sede.PUQ || 0) / totalSedes) * 100) : 0;

  return (
    <div className="p-4 md:p-8 space-y-8 mx-auto">
      {/* Header y Filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Reporte de Tareas Completadas
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Seguimiento semanal por equipos de trabajo, tasa por persona, sedes y ámbito
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Navegador Semanal */}
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button
              onClick={handlePrevWeek}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
              title="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleCurrentWeek}
              className="px-3 py-1 text-xs font-bold text-slate-700 hover:text-blue-600 transition"
            >
              {weekInfo.displayStart} - {weekInfo.displayEnd}
            </button>
            <button
              onClick={handleNextWeek}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
              title="Semana siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl shadow-sm hover:bg-slate-50 transition"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleExportPDF}
            disabled={exportingPdf || loading || (data.tareas && data.tareas.length === 0)}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exportingPdf ? "Generando PDF..." : "Exportar Reporte PDF"}
          </button>
        </div>
      </div>

      {/* Barra de Filtros Avanzados */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Selector de Rango Personalizado */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Rango de Fechas
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-slate-400 text-xs">a</span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filtro por Jefatura / Equipo */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Equipo / Jefatura a Cargo
            </label>
            <select
              value={selectedJefe}
              onChange={(e) => setSelectedJefe(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="TODOS">Todos los Equipos</option>
              {(data.jefaturas_disponibles || []).map((j) => (
                <option key={j.id} value={j.id}>
                  {formatShortName(j.nombre)} ({j.cargo})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Sede */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Sede Operativa
            </label>
            <select
              value={selectedSede}
              onChange={(e) => setSelectedSede(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="TODAS">Todas las Sedes</option>
              <option value="PMC">Puerto Montt (PMC)</option>
              <option value="PUQ">Punta Arenas (PUQ)</option>
            </select>
          </div>

          {/* Filtro por Destino */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Ámbito / Destino
            </label>
            <select
              value={selectedDestino}
              onChange={(e) => setSelectedDestino(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="TODOS">Todos los Ámbitos</option>
              <option value="PROYECTO">Proyecto</option>
              <option value="TALLER">Taller</option>
              <option value="ADMINISTRACION">Administración</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards Superiores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Tareas */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Tareas Terminadas</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {data.kpis.total_completadas}
            </span>
            <span className="text-xs text-slate-400 font-medium">actividades</span>
          </div>
          <p className="mt-2 text-xs text-slate-500 font-medium">
            Finalizadas en la semana seleccionada
          </p>
        </div>

        {/* Card 2: Tasa Promedio por Persona */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Tasa x Persona</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {data.kpis.tasa_promedio_por_persona}
            </span>
            <span className="text-xs text-slate-400 font-medium">tareas / persona</span>
          </div>
          <p className="mt-2 text-xs text-slate-500 font-medium">
            {data.kpis.personas_activas} colaboradores activos en el período
          </p>
        </div>

        {/* Card 3: Cumplimiento en Plazo */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">A Tiempo</span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {data.kpis.porcentaje_a_tiempo}%
            </span>
            <span className="text-xs text-slate-400 font-medium">en plazo</span>
          </div>
          <p className="mt-2 text-xs text-slate-500 font-medium">
            Cumplimiento respecto a fecha planificada
          </p>
        </div>

        {/* Card 4: Sedes PMC vs PUQ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Sede Líder</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-blue-700">PMC: {data.distribucion.por_sede.PMC}</span>
              <span className="text-xs text-slate-400 ml-1">({pctPMC}%)</span>
            </div>
            <div>
              <span className="text-xs font-bold text-amber-700">PUQ: {data.distribucion.por_sede.PUQ}</span>
              <span className="text-xs text-slate-400 ml-1">({pctPUQ}%)</span>
            </div>
          </div>
          {/* Barra de progreso combinada */}
          <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
            <div style={{ width: `${pctPMC}%` }} className="bg-blue-600 h-full" title={`PMC: ${pctPMC}%`} />
            <div style={{ width: `${pctPUQ}%` }} className="bg-amber-500 h-full" title={`PUQ: ${pctPUQ}%`} />
          </div>
        </div>
      </div>

      {/* Sección Dashboard: Gráficos de Distribución y Rendimiento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribución por Ámbito */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Distribución por Ámbito
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">{totalDestinos} total</span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                  Proyecto
                </span>
                <span>
                  {data.distribucion.por_destino.PROYECTO} ({pctProyecto}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div style={{ width: `${pctProyecto}%` }} className="bg-indigo-600 h-full rounded-full transition-all" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                  Taller
                </span>
                <span>
                  {data.distribucion.por_destino.TALLER} ({pctTaller}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div style={{ width: `${pctTaller}%` }} className="bg-emerald-600 h-full rounded-full transition-all" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
                  Administración
                </span>
                <span>
                  {data.distribucion.por_destino.ADMINISTRACION} ({pctAdmin}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div style={{ width: `${pctAdmin}%` }} className="bg-purple-600 h-full rounded-full transition-all" />
              </div>
            </div>
          </div>
        </div>

        {/* Desempeño por Equipos / Jefaturas */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Rendimiento por Equipos (Líder / Jefatura)
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">
              {data.rendimiento_equipos?.length || 0} equipos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-2.5">Jefatura a Cargo</th>
                  <th className="pb-2.5 text-center">Colaboradores</th>
                  <th className="pb-2.5 text-center">Total Tareas</th>
                  <th className="pb-2.5 text-center">Tasa x Persona</th>
                  <th className="pb-2.5 text-right">Sedes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data.rendimiento_equipos || []).map((eq) => (
                  <tr key={eq.jefe_id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 font-semibold text-slate-800">
                      {formatShortName(eq.jefe_nombre)}
                    </td>
                    <td className="py-2.5 text-center text-slate-600">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 font-bold text-slate-700">
                        {eq.miembros_activos_count}
                      </span>
                    </td>
                    <td className="py-2.5 text-center font-bold text-slate-900">
                      {eq.total}
                    </td>
                    <td className="py-2.5 text-center font-bold text-emerald-600">
                      {eq.tasa_por_persona}
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 mr-1">
                        PMC: {eq.pmc}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        PUQ: {eq.puq}
                      </span>
                    </td>
                  </tr>
                ))}

                {(!data.rendimiento_equipos || data.rendimiento_equipos.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                      No hay tareas completadas para los filtros seleccionados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ranking de Tasa por Persona */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            Tasa de Tareas Completadas por Colaborador en la Semana
          </h3>
          <span className="text-[11px] font-semibold text-slate-400">
            {data.rendimiento_personas?.length || 0} personas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {(data.rendimiento_personas || []).map((p, idx) => {
            const shortName = formatShortName(p.nombre);
            const shortJefe = formatShortName(p.jefe_nombre);
            return (
              <div
                key={p.empleado_id}
                className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-blue-300 transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                    {shortName ? shortName.charAt(0).toUpperCase() : "#"}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-900 truncate" title={shortName}>
                      {shortName}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate" title={p.cargo}>
                      {p.cargo}
                    </p>
                    <p className="text-[9px] text-slate-400 truncate">
                      Jefe: {shortJefe}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 pl-2">
                  <span className="text-base font-black text-slate-900 block leading-none">{p.total}</span>
                  <span className={`block text-[9px] font-bold mt-1 ${p.a_tiempo === p.total ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {p.total > 0 ? `${Math.round((p.a_tiempo / p.total) * 100)}% ok` : "—"}
                  </span>
                </div>
              </div>
            );
          })}

          {(!data.rendimiento_personas || data.rendimiento_personas.length === 0) && (
            <div className="col-span-full py-8 text-center text-slate-400 italic">
              No hay colaboradores con tareas registradas en este período
            </div>
          )}
        </div>
      </div>

      {/* Tabla Detallada con Buscador */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/30">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Listado Detallado de Tareas Finalizadas
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Detalle con responsable de cierre, fechas reales y asignación
            </p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por tarea, persona o proyecto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-72"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Tarea / Actividad</th>
                <th className="py-3 px-4">Ámbito</th>
                <th className="py-3 px-4">Sede</th>
                <th className="py-3 px-4">Finalizada Por</th>
                <th className="py-3 px-4">Jefatura / Equipo</th>
                <th className="py-3 px-4">Proyecto / Área</th>
                <th className="py-3 px-4">Fechas Planificadas</th>
                <th className="py-3 px-4">Fechas Reales</th>
                <th className="py-3 px-4 text-center">Cumplimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTareas.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-4 font-semibold text-slate-900 max-w-xs truncate" title={t.nombre}>
                    {t.nombre}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.destino === "PROYECTO"
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          : t.destino === "TALLER"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}
                    >
                      {t.destino}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.sede === "PUQ" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                        }`}
                    >
                      {t.sede}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <span className="font-bold text-slate-800 block">{formatShortName(t.completada_por_nombre)}</span>
                      <span className="text-[10px] text-slate-400">{t.completada_por_cargo}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{formatShortName(t.jefe_nombre)}</td>
                  <td className="py-3 px-4 text-slate-600 max-w-[150px] truncate" title={t.proyecto_nombre}>
                    {t.proyecto_nombre}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    <div className="flex flex-col text-[11px]">
                      <span><span className="text-slate-400">Ini:</span> {formatDate(t.fecha_inicio_plan)}</span>
                      <span><span className="text-slate-400">Fin:</span> {formatDate(t.fecha_fin_plan)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-800 font-medium">
                    <div className="flex flex-col text-[11px]">
                      <span><span className="text-slate-400">Ini:</span> {formatDate(t.fecha_inicio_real)}</span>
                      <span><span className="text-slate-400">Fin:</span> {formatDate(t.completada_en || t.fecha_fin_real)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {t.a_tiempo ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        A tiempo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        Desviación
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {filteredTareas.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 italic">
                    {loading ? "Cargando reporte de tareas..." : "No se encontraron tareas con los filtros aplicados"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
