"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { makeHeaders } from "@/lib/api";
import { isFeriadoChile } from "@/lib/diasHabiles";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Available months and years
const MESES = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const ANIOS = [2024, 2025, 2026, 2027, 2028];

const ESTADOS_MAP = {
  OFICINA: { label: "Oficina", abbr: "OF", color: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100", icon: "domain" },
  TALLER: { label: "Taller", abbr: "TA", color: "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100", icon: "build" },
  TERRENO: { label: "Terreno", abbr: "TE", color: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100", icon: "engineering" },
  AUSENTE: { label: "Ausente", abbr: "A", color: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100", icon: "person_off" },
  PERMISO: { label: "Permiso", abbr: "PE", color: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100", icon: "event_busy" },
  LICENCIA_MEDICA: { label: "Licencia Médica", abbr: "LM", color: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100", icon: "medical_services" },
  VACACIONES: { label: "Vacaciones", abbr: "V", color: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100", icon: "beach_access" },
};

export default function AsistenciaMensualPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());

  // Current date constants for highlighting today's column
  const today = new Date();
  const currentDayNum = today.getDate();
  const currentMonthNum = today.getMonth() + 1;
  const currentYearNum = today.getFullYear();

  // Scroll container reference & focus to today helper
  const tableContainerRef = useRef(null);

  const scrollToToday = useCallback((smooth = true) => {
    if (!tableContainerRef.current) return;
    const container = tableContainerRef.current;
    const stickyWidth = 430; // 260px (Empleado) + 170px (Cargo)
    const visibleWidth = Math.max(container.clientWidth - stickyWidth, 200);
    // Offset to center today's column (dayNum is 1-indexed, each col is 46px)
    const dayCenterOffset = (currentDayNum - 1) * 46 + 23;
    const targetScroll = Math.max(0, dayCenterOffset - visibleWidth / 2);

    container.scrollTo({
      left: targetScroll,
      behavior: smooth ? "smooth" : "auto",
    });
  }, [currentDayNum]);

  // Auto-scroll to today whenever current month is viewed
  useEffect(() => {
    if (mes === currentMonthNum && anio === currentYearNum) {
      const timer = setTimeout(() => {
        scrollToToday(false);
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [mes, anio, currentMonthNum, currentYearNum, scrollToToday]);

  // Filter States
  const [q, setQ] = useState("");
  const [cargoFilter, setCargoFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");

  // Data & Loading states
  const [loading, setLoading] = useState(false);
  const [empleadosData, setEmpleadosData] = useState([]);
  const [err, setErr] = useState("");

  // Modal Correction State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null); // { empleadoId, nombre, cargo, fechaStr, currentEstado, currentObservacion }
  const [savingCell, setSavingCell] = useState(false);
  const [modalEstado, setModalEstado] = useState("AUSENTE");
  const [modalObservacion, setModalObservacion] = useState("");

  // Redirect if unauthenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // Fetch monthly grid from backend
  const fetchMonthlyData = async () => {
    try {
      if (!session) return;
      setErr("");
      setLoading(true);

      const params = new URLSearchParams();
      params.set("mes", mes.toString());
      params.set("anio", anio.toString());
      if (q.trim()) params.set("q", q.trim());
      if (cargoFilter.trim()) params.set("cargo", cargoFilter.trim());
      if (estadoFilter.trim()) params.set("estado", estadoFilter.trim());

      const res = await fetch(`${API_URL}/asistencia/mensual?${params.toString()}`, {
        headers: makeHeaders(session),
        cache: "no-store",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || "Error al cargar la matriz mensual");
      }

      const data = await res.json();
      setEmpleadosData(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Error cargando la asistencia mensual");
      setEmpleadosData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && session) {
      fetchMonthlyData();
    }
  }, [status, session, mes, anio, q, cargoFilter, estadoFilter]);

  // Compute number of days in the selected month
  const getDaysInMonth = (month, year) => {
    return new Date(year, month, 0).getDate();
  };
  const daysInMonth = getDaysInMonth(mes, anio);

  // Get weekday name in Spanish (Lun, Mar, etc.)
  const getDayName = (dayNumber) => {
    try {
      const date = new Date(anio, mes - 1, dayNumber);
      const options = { weekday: "short" };
      let name = date.toLocaleDateString("es-CL", options);
      name = name.replace(".", "");
      return name.charAt(0).toUpperCase() + name.slice(1, 3);
    } catch (e) {
      return "";
    }
  };

  // Convert "Surname S2, Name N2" to "Name Surname"
  const formatEmployeeName = (fullName) => {
    if (!fullName) return "";
    if (!fullName.includes(",")) {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0]} ${parts[parts.length - 1]}`;
      }
      return fullName;
    }

    const parts = fullName.split(",");
    const surnamesPart = parts[0].trim();
    const namesPart = parts[1].trim();

    const surnames = surnamesPart.split(/\s+/);
    const firstSurname = surnames[0] || "";

    const names = namesPart.split(/\s+/);
    const firstName = names[0] || "";

    return `${firstName} ${firstSurname}`.trim();
  };

  // Format date helper for the modal
  const formatModalDate = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
    return d.toLocaleDateString("es-CL", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC"
    });
  };

  // Open correction Modal
  const handleOpenModal = (emp, dayNumber) => {
    const formattedDay = dayNumber.toString().padStart(2, "0");
    const formattedMonth = mes.toString().padStart(2, "0");
    const fechaStr = `${anio}-${formattedMonth}-${formattedDay}`;
    const cellRecord = emp.asistencias[fechaStr] || { estado: "AUSENTE", observacion: "" };

    setSelectedCell({
      empleadoId: emp.empleadoId,
      nombre: formatEmployeeName(emp.nombre),
      cargo: emp.cargo,
      fechaStr,
    });
    setModalEstado(cellRecord.estado || "AUSENTE");
    setModalObservacion(cellRecord.observacion || "");
    setModalOpen(true);
  };

  // Save correction in Modal
  const handleSaveModal = async () => {
    if (!selectedCell || !session) return;
    try {
      setSavingCell(true);
      setErr("");

      const res = await fetch(`${API_URL}/asistencia`, {
        method: "POST",
        headers: {
          ...makeHeaders(session),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          empleadoId: selectedCell.empleadoId,
          fecha: selectedCell.fechaStr,
          estado: modalEstado,
          observacion: modalObservacion.trim() || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || "Error al actualizar la celda");
      }

      // Update local grid state live
      setEmpleadosData((prev) =>
        prev.map((emp) => {
          if (emp.empleadoId === selectedCell.empleadoId) {
            const updatedAsistencias = { ...emp.asistencias };
            updatedAsistencias[selectedCell.fechaStr] = {
              estado: modalEstado,
              observacion: modalObservacion.trim(),
            };
            return { ...emp, asistencias: updatedAsistencias };
          }
          return emp;
        })
      );

      setModalOpen(false);
      setSelectedCell(null);
    } catch (e) {
      setErr(e.message || "Error guardando los cambios");
    } finally {
      setSavingCell(false);
    }
  };

  // Export dynamically to CSV
  const handleExportCSV = () => {
    try {
      if (empleadosData.length === 0) return;

      const headers = ["Empleado", "Cargo"];
      for (let d = 1; d <= daysInMonth; d++) {
        headers.push(d.toString());
      }

      const rows = [headers];

      empleadosData.forEach((emp) => {
        const row = [emp.nombre, emp.cargo];
        for (let d = 1; d <= daysInMonth; d++) {
          const formattedDay = d.toString().padStart(2, "0");
          const formattedMonth = mes.toString().padStart(2, "0");
          const dateKey = `${anio}-${formattedMonth}-${formattedDay}`;
          const rec = emp.asistencias[dateKey];
          const abbr = rec ? (ESTADOS_MAP[rec.estado]?.abbr || rec.estado) : "-";
          row.push(abbr);
        }
        rows.push(row);
      });

      const csvContent = "\uFEFF" + rows.map((e) => e.join(";")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `asistencia_mensual_${mes}_${anio}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      setErr("Error exportando los datos a CSV");
    }
  };

  if (status === "loading") {
    return (
      <div className="p-6">
        <div className="text-xl font-semibold text-on-surface">Asistencia</div>
        <div className="mt-1 text-sm text-secondary">Cargando sesión...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="p-6">
        <div className="text-xl font-semibold text-on-surface">Asistencia</div>
        <div className="mt-1 text-sm text-secondary">Redirigiendo...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background text-on-background">
      <div className="p-6 flex-1 mx-auto w-full">

        {/* Page Header */}
        <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <h2 className="font-semibold text-3xl text-on-surface tracking-tight">Vista Mensual de Asistencia</h2>
            <p className="text-secondary text-base mt-1">
              Visualización y corrección de la matriz mensual completa de asistencia para RRHH.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-surface-container-low p-3 rounded-xl border border-outline-variant/30 shadow-sm shrink-0">
            {/* Mes Selector */}
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-secondary">calendar_month</span>
              <select
                value={mes}
                onChange={(e) => setMes(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 border border-outline-variant bg-surface-container-lowest rounded-lg font-medium text-sm text-on-surface focus:outline-none cursor-pointer"
              >
                {MESES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Año Selector */}
            <select
              value={anio}
              onChange={(e) => setAnio(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 border border-outline-variant bg-surface-container-lowest rounded-lg font-medium text-sm text-on-surface focus:outline-none cursor-pointer"
            >
              {ANIOS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            {/* Quick button to center Today */}
            <button
              type="button"
              onClick={() => {
                if (mes !== currentMonthNum || anio !== currentYearNum) {
                  setMes(currentMonthNum);
                  setAnio(currentYearNum);
                } else {
                  scrollToToday(true);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-sm hover:cursor-pointer transition-all duration-150 shadow-2xs"
              title="Centrar en el día de hoy"
            >
              <span className="material-symbols-outlined text-[18px]">today</span>
              Hoy
            </button>

            <button
              onClick={handleExportCSV}
              disabled={empleadosData.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 hover:cursor-pointer transition-all duration-150"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Exportar CSV
            </button>
          </div>
        </div>

        {err && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">error</span>
            {err}
          </div>
        )}

        {/* Filter Area */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 bg-surface-container-low/40 p-6 rounded-2xl border border-outline-variant/40">
          {/* Filter 1: Buscar */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-secondary uppercase tracking-wider">
              Empleado
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary text-[20px]">search</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm text-on-surface focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-sm"
                placeholder="Buscar por nombre o correo..."
                type="text"
              />
            </div>
          </div>

          {/* Filter 2: Cargo */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-secondary uppercase tracking-wider">
              Cargo / Puesto
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary text-[20px]">work</span>
              <input
                value={cargoFilter}
                onChange={(e) => setCargoFilter(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm text-on-surface focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-sm"
                placeholder="Filtrar por puesto..."
                type="text"
              />
            </div>
          </div>

          {/* Filter 3: Estado Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-secondary uppercase tracking-wider">
              Filtro por Estado
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary text-[20px]">filter_list</span>
              <select
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm text-on-surface focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-sm cursor-pointer appearance-none"
              >
                <option value="">Filtrar empleados con estado...</option>
                <option value="OFICINA">Oficina</option>
                <option value="TALLER">Taller</option>
                <option value="TERRENO">Terreno</option>
                <option value="AUSENTE">Ausentes</option>
                <option value="PERMISO">Permisos</option>
                <option value="LICENCIA_MEDICA">Licencias Médicas</option>
                <option value="VACACIONES">Vacaciones</option>
              </select>
            </div>
          </div>
        </div>

        {/* Matrix Grid Card Wrapper */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
          <div
            ref={tableContainerRef}
            className="overflow-x-auto w-full max-w-full custom-scrollbar overscroll-x-contain [transform:translateZ(0)] [will-change:scroll-position]"
          >
            <table className="w-max min-w-full table-fixed border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-100">
                  {/* Sticky columns for Employee and Cargo */}
                  <th className="sticky left-0 bg-slate-100 z-30 px-5 py-4 text-left text-xs font-bold text-secondary uppercase tracking-wider w-[260px] min-w-[260px] max-w-[260px] border-b border-r border-slate-200">
                    Empleado
                  </th>
                  <th className="sticky left-[260px] bg-slate-100 z-30 px-4 py-4 text-left text-xs font-bold text-secondary uppercase tracking-wider w-[170px] min-w-[170px] max-w-[170px] border-b border-r-2 border-slate-300">
                    Cargo
                  </th>

                  {/* Day Columns */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const dateObj = new Date(Date.UTC(anio, mes - 1, dayNum));
                    const dayOfWeek = dateObj.getUTCDay(); // 0: Dom, 6: Sab
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const isHoliday = isFeriadoChile(dateObj);
                    const isToday = currentDayNum === dayNum && currentMonthNum === mes && currentYearNum === anio;

                    const headerBg = isToday
                      ? "bg-amber-300/90 border-amber-400 text-amber-950 shadow-inner"
                      : isHoliday
                      ? "bg-rose-200 border-rose-300 text-rose-950"
                      : isWeekend
                      ? "bg-slate-200 border-slate-300 text-slate-800"
                      : "bg-slate-100 border-outline-variant/20 text-slate-800";

                    return (
                      <th
                        key={dayNum}
                        className={`px-1 py-2.5 text-center w-[46px] min-w-[46px] max-w-[46px] border-b border-r border-slate-200 ${headerBg}`}
                        title={isHoliday ? "🎉 Feriado Legal en Chile" : isWeekend ? "🏖️ Fin de semana (Descanso)" : ""}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <span className={`text-[12px] font-black leading-none ${isToday ? "text-amber-950" : isHoliday ? "text-rose-950" : isWeekend ? "text-slate-800" : "text-slate-900"}`}>
                            {dayNum}
                          </span>
                          <span className={`text-[9px] font-extrabold uppercase tracking-tighter mt-1 block leading-none ${isToday ? "text-amber-900 font-black" : isHoliday ? "text-rose-800 font-black" : isWeekend ? "text-slate-600 font-bold" : "text-slate-500"}`}>
                            {getDayName(dayNum)}
                          </span>
                          {/* Contenedor de altura fija reservada para que todos los días tengan la misma altura y se alineen perfectamente */}
                          <div className="h-2 mt-1 flex items-center justify-center">
                            {isToday ? (
                              <span className="w-2 h-2 rounded-full bg-amber-800 block shadow-xs" title="Hoy"></span>
                            ) : isHoliday ? (
                              <span className="w-2 h-2 rounded-full bg-rose-600 block shadow-xs" title="Feriado Legal"></span>
                            ) : isWeekend ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 block" title="Fin de semana"></span>
                            ) : null}
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={daysInMonth + 2} className="px-6 py-12 text-center text-secondary text-sm font-medium border-b border-slate-200">
                      <div className="flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined animate-spin">sync</span>
                        Cargando matriz de asistencia...
                      </div>
                    </td>
                  </tr>
                ) : empleadosData.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonth + 2} className="px-6 py-12 text-center text-secondary text-sm font-medium border-b border-slate-200">
                      No se encontraron registros de empleados que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  empleadosData.map((emp) => {
                    const formattedName = formatEmployeeName(emp.nombre);
                    const initials = formattedName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                    return (
                      <tr key={emp.empleadoId} className="group hover:bg-slate-50">
                        {/* Sticky employee details */}
                        <td className="sticky left-0 bg-white group-hover:bg-slate-50 z-20 px-5 py-3.5 border-b border-r border-slate-200 w-[260px] min-w-[260px] max-w-[260px]">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center font-bold text-sm shrink-0 uppercase shadow-xs">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm text-on-surface truncate" title={formattedName}>{formattedName}</p>
                              <p className="text-[10px] text-secondary truncate" title={emp.correo}>{emp.correo}</p>
                            </div>
                          </div>
                        </td>

                        <td className="sticky left-[260px] bg-white group-hover:bg-slate-50 z-20 px-4 py-3.5 text-xs font-bold text-secondary border-b border-r-2 border-slate-300 w-[170px] min-w-[170px] max-w-[170px]">
                          <span className="truncate block" title={emp.cargo || ""}>{emp.cargo || "—"}</span>
                        </td>

                        {/* Dynamic Cell Generation */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const dayNum = i + 1;
                          const formattedDay = dayNum.toString().padStart(2, "0");
                          const formattedMonth = mes.toString().padStart(2, "0");
                          const dateKey = `${anio}-${formattedMonth}-${formattedDay}`;
                          const record = emp.asistencias[dateKey];
                          const hasRecord = !!record;
                          const estado = record?.estado || "AUSENTE";
                          const ob = record?.observacion || "";

                          const dateObj = new Date(Date.UTC(anio, mes - 1, dayNum));
                          const dayOfWeek = dateObj.getUTCDay();
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                          const isHoliday = isFeriadoChile(dateObj);
                          const isToday = currentDayNum === dayNum && currentMonthNum === mes && currentYearNum === anio;

                          // Resolve badge styling safely with defensive fallbacks for unmapped/legacy statuses
                          const style = (hasRecord && ESTADOS_MAP[estado])
                            ? ESTADOS_MAP[estado]
                            : (hasRecord
                              ? { label: estado, abbr: estado.slice(0, 2).toUpperCase(), color: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200", icon: "help" }
                              : isHoliday
                              ? { label: "Feriado", abbr: "F", color: "bg-rose-100/70 text-rose-500 border-rose-200/80 hover:bg-rose-200 hover:text-rose-900", icon: "flag" }
                              : isWeekend
                              ? { label: "Descanso", abbr: "-", color: "bg-slate-200/60 text-slate-500 border-slate-300/80 hover:bg-slate-300/70 hover:text-slate-800", icon: "weekend" }
                              : { label: "Sin registro", abbr: "-", color: "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-200/60", icon: "help" });

                          const tdBg = isToday
                            ? "bg-amber-100/50"
                            : isHoliday
                            ? "bg-rose-100/40"
                            : isWeekend
                            ? "bg-slate-100"
                            : "bg-white";

                          return (
                            <td key={dayNum} className={`p-1 text-center w-[46px] min-w-[46px] max-w-[46px] border-b border-r border-slate-200 ${tdBg}`}>
                              <div className="relative group flex items-center justify-center">
                                <button
                                  onClick={() => handleOpenModal(emp, dayNum)}
                                  className={`peer w-8 h-8 flex items-center justify-center rounded-lg border transition-transform duration-75 hover:scale-110 active:scale-95 cursor-pointer ${style.color}`}
                                >
                                  {hasRecord ? (
                                    <span className="material-symbols-outlined text-[16px] block" style={{ fontVariationSettings: "'FILL' 1" }}>
                                      {style.icon}
                                    </span>
                                  ) : isHoliday ? (
                                    <span className="text-[11px] font-black text-rose-500">F</span>
                                  ) : (
                                    <span className="text-[11px] font-bold text-slate-400 opacity-80">—</span>
                                  )}
                                </button>

                                {/* CSS Tooltip on cell hover */}
                                <div className="absolute bottom-full mb-2 hidden peer-hover:flex flex-col items-center z-50 pointer-events-none">
                                  <div className="p-2 text-[10px] leading-relaxed text-white whitespace-nowrap bg-slate-900 rounded-md shadow-md font-bold flex flex-col items-start gap-0.5">
                                    <span>
                                      Día {dayNum} ({getDayName(dayNum)}): {style.label} {isHoliday ? "🎉 (Feriado Legal)" : isWeekend ? "🏖️ (Fin de semana)" : ""}
                                    </span>
                                    {ob && <span className="text-[9px] font-normal text-slate-300 max-w-[180px] truncate">Nota: "{ob}"</span>}
                                    <span className="text-[8px] font-medium text-blue-400 mt-0.5 italic">Hacer clic para registrar / corregir</span>
                                  </div>
                                  <div className="w-2 h-2 -mt-1 rotate-45 bg-slate-900"></div>
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Matrix Footer Legend */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-4 items-center justify-between text-xs text-secondary">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-700">Clic en celda para corregir / registrar turno.</span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1.5 text-slate-700 font-bold">
                <span className="w-4 h-4 rounded bg-slate-200 border border-slate-300 inline-block"></span>
                Fin de semana
              </span>
              <span className="flex items-center gap-1.5 text-rose-800 font-bold">
                <span className="w-4 h-4 rounded bg-rose-200 border border-rose-300 inline-block"></span>
                Feriado Legal
              </span>
              <span className="flex items-center gap-1.5 text-amber-900 font-bold">
                <span className="w-4 h-4 rounded bg-amber-300 border border-amber-400 inline-block"></span>
                Día de Hoy
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 items-center">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mr-2">Leyenda de Estados:</span>
              {Object.entries(ESTADOS_MAP).map(([key, s]) => (
                <span key={key} className="flex items-center gap-1.5">
                  <span className={`w-6 h-6 flex items-center justify-center rounded-md border shadow-xs ${s.color}`}>
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                  </span>
                  <span className="text-slate-700 text-[11px] font-semibold">{s.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Cell Correction Modal */}
      {modalOpen && selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-scale-up">

            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Corregir Registro</h3>
                <p className="text-xs text-secondary mt-0.5 font-medium">{selectedCell.nombre}</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-200/50 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-5">
              {/* Date Box */}
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                  <span className="material-symbols-outlined">event</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-blue-800 uppercase tracking-widest font-extrabold leading-none">Fecha seleccionada</p>
                  <p className="font-semibold text-sm text-slate-800 mt-1 capitalize leading-none">
                    {formatModalDate(selectedCell.fechaStr)}
                  </p>
                </div>
              </div>

              {/* Status Picker with Material Symbols, tooltips & scales */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-secondary uppercase tracking-wider">
                  Seleccionar Estado de Asistencia
                </label>
                <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-200 gap-1.5 w-full justify-center shadow-inner relative overflow-visible">

                  {/* OFICINA Button */}
                  <div className="relative group flex items-center justify-center">
                    <button
                      onClick={() => setModalEstado("OFICINA")}
                      type="button"
                      className={`p-2 rounded-lg transition-all duration-150 flex items-center justify-center hover:scale-125 cursor-pointer z-10 ${modalEstado === "OFICINA"
                        ? "bg-emerald-600 text-white shadow-sm scale-110"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                        }`}
                    >
                      <span className="material-symbols-outlined text-[20px] block" style={{ fontVariationSettings: modalEstado === "OFICINA" ? "'FILL' 1" : "'FILL' 0" }}>domain</span>
                    </button>
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none transition-all duration-200">
                      <span className="relative z-10 p-2 text-[10px] leading-none text-white whitespace-nowrap bg-slate-900 rounded-md shadow-lg font-bold shadow-slate-900/20">
                        Oficina
                      </span>
                      <div className="w-2 h-2 -mt-1 rotate-45 bg-slate-900"></div>
                    </div>
                  </div>

                  {/* TALLER Button */}
                  <div className="relative group flex items-center justify-center">
                    <button
                      onClick={() => setModalEstado("TALLER")}
                      type="button"
                      className={`p-2 rounded-lg transition-all duration-150 flex items-center justify-center hover:scale-125 cursor-pointer z-10 ${modalEstado === "TALLER"
                        ? "bg-cyan-600 text-white shadow-sm scale-110"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                        }`}
                    >
                      <span className="material-symbols-outlined text-[20px] block" style={{ fontVariationSettings: modalEstado === "TALLER" ? "'FILL' 1" : "'FILL' 0" }}>build</span>
                    </button>
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none transition-all duration-200">
                      <span className="relative z-10 p-2 text-[10px] leading-none text-white whitespace-nowrap bg-slate-900 rounded-md shadow-lg font-bold shadow-slate-900/20">
                        Taller
                      </span>
                      <div className="w-2 h-2 -mt-1 rotate-45 bg-slate-900"></div>
                    </div>
                  </div>

                  {/* TERRENO Button */}
                  <div className="relative group flex items-center justify-center">
                    <button
                      onClick={() => setModalEstado("TERRENO")}
                      type="button"
                      className={`p-2 rounded-lg transition-all duration-150 flex items-center justify-center hover:scale-125 cursor-pointer z-10 ${modalEstado === "TERRENO"
                        ? "bg-indigo-600 text-white shadow-sm scale-110"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                        }`}
                    >
                      <span className="material-symbols-outlined text-[20px] block" style={{ fontVariationSettings: modalEstado === "TERRENO" ? "'FILL' 1" : "'FILL' 0" }}>engineering</span>
                    </button>
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none transition-all duration-200">
                      <span className="relative z-10 p-2 text-[10px] leading-none text-white whitespace-nowrap bg-slate-900 rounded-md shadow-lg font-bold shadow-slate-900/20">
                        Terreno
                      </span>
                      <div className="w-2 h-2 -mt-1 rotate-45 bg-slate-900"></div>
                    </div>
                  </div>

                  {/* AUSENTE Button */}
                  <div className="relative group flex items-center justify-center">
                    <button
                      onClick={() => setModalEstado("AUSENTE")}
                      type="button"
                      className={`p-2 rounded-lg transition-all duration-150 flex items-center justify-center hover:scale-125 cursor-pointer z-10 ${modalEstado === "AUSENTE"
                        ? "bg-rose-600 text-white shadow-sm scale-110"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                        }`}
                    >
                      <span className="material-symbols-outlined text-[20px] block" style={{ fontVariationSettings: modalEstado === "AUSENTE" ? "'FILL' 1" : "'FILL' 0" }}>person_off</span>
                    </button>
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none transition-all duration-200">
                      <span className="relative z-10 p-2 text-[10px] leading-none text-white whitespace-nowrap bg-slate-900 rounded-md shadow-lg font-bold shadow-slate-900/20">
                        Ausente
                      </span>
                      <div className="w-2 h-2 -mt-1 rotate-45 bg-slate-900"></div>
                    </div>
                  </div>

                  {/* PERMISO Button */}
                  <div className="relative group flex items-center justify-center">
                    <button
                      onClick={() => setModalEstado("PERMISO")}
                      type="button"
                      className={`p-2 rounded-lg transition-all duration-150 flex items-center justify-center hover:scale-125 cursor-pointer z-10 ${modalEstado === "PERMISO"
                        ? "bg-purple-600 text-white shadow-sm scale-110"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                        }`}
                    >
                      <span className="material-symbols-outlined text-[20px] block" style={{ fontVariationSettings: modalEstado === "PERMISO" ? "'FILL' 1" : "'FILL' 0" }}>event_busy</span>
                    </button>
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none transition-all duration-200">
                      <span className="relative z-10 p-2 text-[10px] leading-none text-white whitespace-nowrap bg-slate-900 rounded-md shadow-lg font-bold shadow-slate-900/20">
                        Permiso
                      </span>
                      <div className="w-2 h-2 -mt-1 rotate-45 bg-slate-900"></div>
                    </div>
                  </div>

                  {/* LICENCIA MEDICA Button */}
                  <div className="relative group flex items-center justify-center">
                    <button
                      onClick={() => setModalEstado("LICENCIA_MEDICA")}
                      type="button"
                      className={`p-2 rounded-lg transition-all duration-150 flex items-center justify-center hover:scale-125 cursor-pointer z-10 ${modalEstado === "LICENCIA_MEDICA"
                        ? "bg-amber-500 text-white shadow-sm scale-110"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                        }`}
                    >
                      <span className="material-symbols-outlined text-[20px] block" style={{ fontVariationSettings: modalEstado === "LICENCIA_MEDICA" ? "'FILL' 1" : "'FILL' 0" }}>medical_services</span>
                    </button>
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none transition-all duration-200">
                      <span className="relative z-10 p-2 text-[10px] leading-none text-white whitespace-nowrap bg-slate-900 rounded-md shadow-lg font-bold shadow-slate-900/20">
                        Licencia Médica
                      </span>
                      <div className="w-2 h-2 -mt-1 rotate-45 bg-slate-900"></div>
                    </div>
                  </div>

                  {/* VACACIONES Button */}
                  <div className="relative group flex items-center justify-center">
                    <button
                      onClick={() => setModalEstado("VACACIONES")}
                      type="button"
                      className={`p-2 rounded-lg transition-all duration-150 flex items-center justify-center hover:scale-125 cursor-pointer z-10 ${modalEstado === "VACACIONES"
                        ? "bg-blue-500 text-white shadow-sm scale-110"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                        }`}
                    >
                      <span className="material-symbols-outlined text-[20px] block" style={{ fontVariationSettings: modalEstado === "VACACIONES" ? "'FILL' 1" : "'FILL' 0" }}>beach_access</span>
                    </button>
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none transition-all duration-200">
                      <span className="relative z-10 p-2 text-[10px] leading-none text-white whitespace-nowrap bg-slate-900 rounded-md shadow-lg font-bold shadow-slate-900/20">
                        Vacaciones
                      </span>
                      <div className="w-2 h-2 -mt-1 rotate-45 bg-slate-900"></div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Justification / Observation Note */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-secondary uppercase tracking-wider">
                  Nota / Justificación (Opcional)
                </label>
                <textarea
                  value={modalObservacion}
                  onChange={(e) => setModalObservacion(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm text-on-surface focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-sm h-24 resize-none"
                  placeholder="Ej: Licencia Médica N° 3424, día administrativo, etc..."
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 bg-white font-semibold text-sm rounded-lg hover:bg-slate-50 transition-all hover:cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                disabled={savingCell}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 hover:cursor-pointer transition-all duration-150"
              >
                {savingCell ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                    Guardando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
