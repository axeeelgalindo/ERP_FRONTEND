"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { makeHeaders } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const getTodayStr = () => {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
};

export default function AsistenciaPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Core States
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [err, setErr] = useState("");

  const [fecha, setFecha] = useState(getTodayStr());
  const [empleados, setEmpleados] = useState([]);

  // Local filter states
  const [q, setQ] = useState("");
  const [cargoFilter, setCargoFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // Fetch daily attendance
  const fetchAsistencia = async () => {
    try {
      if (!session) return;
      setErr("");
      setLoading(true);

      const params = new URLSearchParams();
      params.set("fecha", fecha);

      const res = await fetch(`${API_URL}/asistencia?${params.toString()}`, {
        headers: makeHeaders(session),
        cache: "no-store",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || "Error al cargar la asistencia");
      }

      const data = await res.json();
      setEmpleados(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Error cargando asistencia");
      setEmpleados([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && session) {
      fetchAsistencia();
    }
  }, [status, session, fecha]);

  // Handle single state change
  const handleUpdateStatus = async (empleadoId, newStatus, currentObs) => {
    try {
      setSavingId(empleadoId);
      setErr("");

      const res = await fetch(`${API_URL}/asistencia`, {
        method: "POST",
        headers: {
          ...makeHeaders(session),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          empleadoId,
          fecha,
          estado: newStatus,
          observacion: currentObs || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || "Error al actualizar estado");
      }

      // Update local state smoothly
      setEmpleados((prev) =>
        prev.map((emp) =>
          emp.empleadoId === empleadoId ? { ...emp, estado: newStatus } : emp
        )
      );
    } catch (e) {
      setErr(e.message || "Error al guardar asistencia");
    } finally {
      setSavingId("");
    }
  };

  // Handle observation update (save on blur or Enter)
  const handleUpdateObservacion = async (empleadoId, currentStatus, newObs) => {
    // Check if it's actually different to avoid double fetch
    const currentEmp = empleados.find((e) => e.empleadoId === empleadoId);
    if (currentEmp && (currentEmp.observacion || "") === newObs.trim()) {
      return;
    }

    try {
      setSavingId(empleadoId);
      setErr("");

      const res = await fetch(`${API_URL}/asistencia`, {
        method: "POST",
        headers: {
          ...makeHeaders(session),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          empleadoId,
          fecha,
          estado: currentStatus,
          observacion: newObs.trim() || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || "Error al guardar notas");
      }

      setEmpleados((prev) =>
        prev.map((emp) =>
          emp.empleadoId === empleadoId ? { ...emp, observacion: newObs.trim() } : emp
        )
      );
    } catch (e) {
      setErr(e.message || "Error al guardar justificación");
    } finally {
      setSavingId("");
    }
  };

  // Computations for Bento statistics (over the complete loaded list)
  const totalCount = empleados.length;
  const countPresentes = empleados.filter((e) => ["PRESENTE", "OFICINA", "TALLER", "TERRENO"].includes(e.estado.toUpperCase())).length;
  const countAusentes = empleados.filter((e) => e.estado === "AUSENTE").length;
  const countPermisos = empleados.filter((e) => e.estado === "PERMISO").length;
  const countLicencias = empleados.filter((e) => e.estado === "LICENCIA_MEDICA").length;
  const countVacaciones = empleados.filter((e) => e.estado === "VACACIONES").length;

  const pctPresentes = totalCount > 0 ? Math.round((countPresentes / totalCount) * 100) : 0;
  const pctAusentes = totalCount > 0 ? Math.round((countAusentes / totalCount) * 100) : 0;

  // Local filtered list for display
  const filteredList = empleados.filter((emp) => {
    const matchQ =
      !q.trim() ||
      emp.nombre.toLowerCase().includes(q.toLowerCase()) ||
      emp.correo.toLowerCase().includes(q.toLowerCase());

    const matchCargo =
      !cargoFilter.trim() ||
      emp.cargo.toLowerCase().includes(cargoFilter.toLowerCase());

    const matchEstado =
      !estadoFilter ||
      emp.estado.toUpperCase() === estadoFilter.toUpperCase();

    return matchQ && matchCargo && matchEstado;
  });

  if (status === "loading") {
    return (
      <div className="p-6">
        <div className="text-xl font-semibold">Asistencia</div>
        <div className="mt-1 text-sm text-slate-500">Cargando sesión...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="p-6">
        <div className="text-xl font-semibold">Asistencia</div>
        <div className="mt-1 text-sm text-slate-500">Redirigiendo...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background text-on-background">
      <div className="p-6 flex-1  mx-auto w-full">

        {/* Page Header Section */}
        <div className="mb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <h2 className="font-semibold text-3xl text-on-surface tracking-tight">Control de Asistencia</h2>
            <p className="text-secondary text-base mt-1">
              Seguimiento diario de presencia, permisos y justificaciones de RRHH.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-surface-container-low p-3 rounded-xl border border-outline-variant/30 shadow-sm shrink-0">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary flex items-center gap-2" htmlFor="attendance-date">
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
              Fecha del Registro
            </label>
            <input
              id="attendance-date"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="px-4 py-2 border border-outline-variant bg-surface-container-lowest rounded-lg font-medium text-sm text-on-surface focus:ring-2 focus:ring-primary focus:outline-none transition-all cursor-pointer"
            />
            <button
              onClick={fetchAsistencia}
              disabled={loading}
              className="flex items-center justify-center p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
              title="Actualizar datos"
            >
              <span className="material-symbols-outlined text-[20px]">refresh</span>
            </button>
          </div>
        </div>

        {err && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm flex items-center gap-2 animate-pulse">
            <span className="material-symbols-outlined text-[20px]">error</span>
            {err}
          </div>
        )}

        {/* Bento Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">

          {/* Card 1: Presentes */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-sm flex items-center relative overflow-hidden group hover:shadow-md transition-all duration-300">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mr-4 shrink-0 transition-transform group-hover:scale-110 duration-300">
              <span className="material-symbols-outlined text-[28px]">check_circle</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-secondary uppercase tracking-wider">Presentes</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold text-on-surface">{countPresentes}</span>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                  {pctPresentes}%
                </span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${pctPresentes}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Ausentes */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-sm flex items-center relative overflow-hidden group hover:shadow-md transition-all duration-300">
            <div className="w-12 h-12 bg-rose-100 text-rose-800 rounded-full flex items-center justify-center mr-4 shrink-0 transition-transform group-hover:scale-110 duration-300">
              <span className="material-symbols-outlined text-[28px]">cancel</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-secondary uppercase tracking-wider">Ausentes</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold text-on-surface">{countAusentes}</span>
                <span className="text-xs font-semibold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded-md">
                  {pctAusentes}%
                </span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${pctAusentes}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Permisos, Licencias y Vacaciones */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-sm flex items-center relative overflow-hidden group hover:shadow-md transition-all duration-300">
            <div className="w-12 h-12 bg-purple-100 text-purple-800 rounded-full flex items-center justify-center mr-4 shrink-0 transition-transform group-hover:scale-110 duration-300">
              <span className="material-symbols-outlined text-[28px]">edit_calendar</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-secondary uppercase tracking-wider">Licencias, Vacaciones y Permisos</p>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-3xl font-extrabold text-on-surface">
                  {countPermisos + countLicencias + countVacaciones}
                </span>
                <div className="text-[9px] font-bold text-slate-500 flex flex-col leading-none">
                  <span>{countPermisos} Permisos</span>
                  <span className="mt-0.5">{countLicencias} Licencias</span>
                  <span className="mt-0.5">{countVacaciones} Vacaciones</span>
                </div>
              </div>
              <div className="flex gap-1 mt-3 w-full">
                <div
                  className="bg-purple-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: totalCount > 0 ? `${(countPermisos / totalCount) * 100}%` : "0%" }}
                  title="Permisos"
                />
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: totalCount > 0 ? `${(countLicencias / totalCount) * 100}%` : "0%" }}
                  title="Licencias Médicas"
                />
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: totalCount > 0 ? `${(countVacaciones / totalCount) * 100}%` : "0%" }}
                  title="Vacaciones"
                />
              </div>
            </div>
          </div>

          {/* Card 4: Total Personal */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-sm flex items-center relative overflow-hidden group hover:shadow-md transition-all duration-300">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mr-4 shrink-0 transition-transform group-hover:scale-110 duration-300">
              <span className="material-symbols-outlined text-[28px]">badge</span>
            </div>
            <div>
              <p className="text-xs font-bold text-secondary uppercase tracking-wider">Personal Activo</p>
              <p className="text-3xl font-extrabold text-on-surface leading-none mt-1">{totalCount}</p>
              <p className="text-[11px] font-semibold text-slate-400 mt-2">Personal elegible para asistencia</p>
            </div>
          </div>
        </div>

        {/* Data Table Filters Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

          {/* Filter 1: Name/Email */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-secondary uppercase tracking-wider" htmlFor="filter-name">
              Nombre o correo
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary text-[20px]">search</span>
              <input
                id="filter-name"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm text-on-surface focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-sm"
                placeholder="Buscar por nombre o correo..."
                type="text"
              />
            </div>
          </div>

          {/* Filter 2: Cargo */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-secondary uppercase tracking-wider" htmlFor="filter-cargo">
              Cargo / Puesto
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary text-[20px]">work</span>
              <input
                id="filter-cargo"
                value={cargoFilter}
                onChange={(e) => setCargoFilter(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm text-on-surface focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-sm"
                placeholder="Filtrar por puesto..."
                type="text"
              />
            </div>
          </div>

          {/* Filter 3: Estado */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-secondary uppercase tracking-wider" htmlFor="filter-state">
              Filtrar por Estado
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary text-[20px]">rule</span>
              <select
                id="filter-state"
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm text-on-surface focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-sm cursor-pointer appearance-none"
              >
                <option value="">Todos los estados</option>
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

        {/* Data Table */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">

          <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low/30">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">
              {filteredList.length} empleados listados
            </span>
            {loading && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-primary animate-pulse">
                <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                Actualizando...
              </span>
            )}
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider w-[20%]">Empleado</th>
                  <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider w-[15%]">Cargo</th>
                  <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider w-[45%] text-center">Registro de Asistencia</th>
                  <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider w-[20%]">Justificación / Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">

                {filteredList.map((emp) => {
                  const nombre = emp.nombre || "(Sin usuario)";
                  const correo = emp.correo || "—";
                  const initial = nombre.charAt(0);

                  const isSaving = savingId === emp.empleadoId;

                  return (
                    <tr
                      key={emp.empleadoId}
                      className={`hover:bg-slate-50/50 transition-colors duration-150 group ${isSaving ? "opacity-60 pointer-events-none" : ""
                        }`}
                    >
                      {/* Column 1: Employee Block */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center text-on-secondary-container font-extrabold uppercase text-lg shrink-0 border border-outline-variant shadow-sm">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-base text-on-surface truncate">{nombre}</p>
                            <p className="text-xs font-medium text-secondary truncate">{correo}</p>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Cargo */}
                      <td className="px-6 py-4 text-sm font-semibold text-secondary">
                        {emp.cargo || "—"}
                      </td>

                      {/* Column 3: Segmented Controls Attendance */}
                      <td className="px-6 py-4 overflow-visible">
                        <div className="flex items-center justify-center">
                          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 gap-1.5 max-w-fit shadow-inner relative justify-center animate-fade-in">

                            {/* OFICINA Pill */}
                            <div className="relative flex items-center justify-center">
                              <button
                                onClick={() => handleUpdateStatus(emp.empleadoId, "OFICINA", emp.observacion)}
                                className={`peer p-2 rounded-lg transition-all duration-150 flex items-center justify-center hover:scale-125 cursor-pointer z-10 ${emp.estado === "OFICINA"
                                    ? "bg-emerald-600 text-white shadow-sm scale-110"
                                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                                  }`}
                              >
                                <span className="material-symbols-outlined text-[20px] block" style={{ fontVariationSettings: emp.estado === "OFICINA" ? "'FILL' 1" : "'FILL' 0" }}>domain</span>
                              </button>
                              <div className="absolute bottom-full mb-2.5 hidden peer-hover:flex flex-col items-center z-50 pointer-events-none transition-all duration-200">
                                <span className="relative z-10 p-2 text-[10px] leading-none text-white whitespace-nowrap bg-slate-900 rounded-md shadow-lg font-bold shadow-slate-900/20">
                                  Oficina
                                </span>
                                <div className="w-2 h-2 -mt-1 rotate-45 bg-slate-900"></div>
                              </div>
                            </div>

                            {/* TALLER Pill */}
                            <div className="relative flex items-center justify-center">
                              <button
                                onClick={() => handleUpdateStatus(emp.empleadoId, "TALLER", emp.observacion)}
                                className={`peer p-2 rounded-lg transition-all duration-150 flex items-center justify-center hover:scale-125 cursor-pointer z-10 ${emp.estado === "TALLER"
                                    ? "bg-cyan-600 text-white shadow-sm scale-110"
                                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                                  }`}
                              >
                                <span className="material-symbols-outlined text-[20px] block" style={{ fontVariationSettings: emp.estado === "TALLER" ? "'FILL' 1" : "'FILL' 0" }}>build</span>
                              </button>
                              <div className="absolute bottom-full mb-2.5 hidden peer-hover:flex flex-col items-center z-50 pointer-events-none transition-all duration-200">
                                <span className="relative z-10 p-2 text-[10px] leading-none text-white whitespace-nowrap bg-slate-900 rounded-md shadow-lg font-bold shadow-slate-900/20">
                                  Taller
                                </span>
                                <div className="w-2 h-2 -mt-1 rotate-45 bg-slate-900"></div>
                              </div>
                            </div>

                            {/* TERRENO Pill */}
                            <div className="relative flex items-center justify-center">
                              <button
                                onClick={() => handleUpdateStatus(emp.empleadoId, "TERRENO", emp.observacion)}
                                className={`peer p-2 rounded-lg transition-all duration-150 flex items-center justify-center hover:scale-125 cursor-pointer z-10 ${emp.estado === "TERRENO"
                                    ? "bg-indigo-600 text-white shadow-sm scale-110"
                                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                                  }`}
                              >
                                <span className="material-symbols-outlined text-[20px] block" style={{ fontVariationSettings: emp.estado === "TERRENO" ? "'FILL' 1" : "'FILL' 0" }}>engineering</span>
                              </button>
                              <div className="absolute bottom-full mb-2.5 hidden peer-hover:flex flex-col items-center z-50 pointer-events-none transition-all duration-200">
                                <span className="relative z-10 p-2 text-[10px] leading-none text-white whitespace-nowrap bg-slate-900 rounded-md shadow-lg font-bold shadow-slate-900/20">
                                  Terreno
                                </span>
                                <div className="w-2 h-2 -mt-1 rotate-45 bg-slate-900"></div>
                              </div>
                            </div>

                            {/* AUSENTE Pill */}
                            <div className="relative flex items-center justify-center">
                              <button
                                onClick={() => handleUpdateStatus(emp.empleadoId, "AUSENTE", emp.observacion)}
                                className={`peer p-2 rounded-lg transition-all duration-150 flex items-center justify-center hover:scale-125 cursor-pointer z-10 ${emp.estado === "AUSENTE"
                                    ? "bg-rose-600 text-white shadow-sm scale-110"
                                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                                  }`}
                              >
                                <span className="material-symbols-outlined text-[20px] block" style={{ fontVariationSettings: emp.estado === "AUSENTE" ? "'FILL' 1" : "'FILL' 0" }}>person_off</span>
                              </button>
                              <div className="absolute bottom-full mb-2.5 hidden peer-hover:flex flex-col items-center z-50 pointer-events-none transition-all duration-200">
                                <span className="relative z-10 p-2 text-[10px] leading-none text-white whitespace-nowrap bg-slate-900 rounded-md shadow-lg font-bold shadow-slate-900/20">
                                  Ausente
                                </span>
                                <div className="w-2 h-2 -mt-1 rotate-45 bg-slate-900"></div>
                              </div>
                            </div>

                            {/* PERMISO Pill */}
                            <div className="relative flex items-center justify-center">
                              <button
                                onClick={() => handleUpdateStatus(emp.empleadoId, "PERMISO", emp.observacion)}
                                className={`peer p-2 rounded-lg transition-all duration-150 flex items-center justify-center hover:scale-125 cursor-pointer z-10 ${emp.estado === "PERMISO"
                                    ? "bg-purple-600 text-white shadow-sm scale-110"
                                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                                  }`}
                              >
                                <span className="material-symbols-outlined text-[20px] block" style={{ fontVariationSettings: emp.estado === "PERMISO" ? "'FILL' 1" : "'FILL' 0" }}>event_busy</span>
                              </button>
                              <div className="absolute bottom-full mb-2.5 hidden peer-hover:flex flex-col items-center z-50 pointer-events-none transition-all duration-200">
                                <span className="relative z-10 p-2 text-[10px] leading-none text-white whitespace-nowrap bg-slate-900 rounded-md shadow-lg font-bold shadow-slate-900/20">
                                  Permiso
                                </span>
                                <div className="w-2 h-2 -mt-1 rotate-45 bg-slate-900"></div>
                              </div>
                            </div>

                            {/* LICENCIA MEDICA Pill */}
                            <div className="relative flex items-center justify-center">
                              <button
                                onClick={() => handleUpdateStatus(emp.empleadoId, "LICENCIA_MEDICA", emp.observacion)}
                                className={`peer p-2 rounded-lg transition-all duration-150 flex items-center justify-center hover:scale-125 cursor-pointer z-10 ${emp.estado === "LICENCIA_MEDICA"
                                    ? "bg-amber-500 text-white shadow-sm scale-110"
                                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                                  }`}
                              >
                                <span className="material-symbols-outlined text-[20px] block" style={{ fontVariationSettings: emp.estado === "LICENCIA_MEDICA" ? "'FILL' 1" : "'FILL' 0" }}>medical_services</span>
                              </button>
                              <div className="absolute bottom-full mb-2.5 hidden peer-hover:flex flex-col items-center z-50 pointer-events-none transition-all duration-200">
                                <span className="relative z-10 p-2 text-[10px] leading-none text-white whitespace-nowrap bg-slate-900 rounded-md shadow-lg font-bold shadow-slate-900/20">
                                  Licencia Médica
                                </span>
                                <div className="w-2 h-2 -mt-1 rotate-45 bg-slate-900"></div>
                              </div>
                            </div>

                            {/* VACACIONES Pill */}
                            <div className="relative flex items-center justify-center">
                              <button
                                onClick={() => handleUpdateStatus(emp.empleadoId, "VACACIONES", emp.observacion)}
                                className={`peer p-2 rounded-lg transition-all duration-150 flex items-center justify-center hover:scale-125 cursor-pointer z-10 ${emp.estado === "VACACIONES"
                                    ? "bg-blue-500 text-white shadow-sm scale-110"
                                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                                  }`}
                              >
                                <span className="material-symbols-outlined text-[20px] block" style={{ fontVariationSettings: emp.estado === "VACACIONES" ? "'FILL' 1" : "'FILL' 0" }}>beach_access</span>
                              </button>
                              <div className="absolute bottom-full mb-2.5 hidden peer-hover:flex flex-col items-center z-50 pointer-events-none transition-all duration-200">
                                <span className="relative z-10 p-2 text-[10px] leading-none text-white whitespace-nowrap bg-slate-900 rounded-md shadow-lg font-bold shadow-slate-900/20">
                                  Vacaciones
                                </span>
                                <div className="w-2 h-2 -mt-1 rotate-45 bg-slate-900"></div>
                              </div>
                            </div>

                          </div>
                        </div>
                      </td>

                      {/* Column 4: Observation Notes (Auto-saves on blur or enter) */}
                      <td className="px-6 py-4">
                        <div className="relative flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Añadir nota / justificación..."
                            defaultValue={emp.observacion || ""}
                            onBlur={(e) => handleUpdateObservacion(emp.empleadoId, emp.estado, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleUpdateObservacion(emp.empleadoId, emp.estado, e.target.value);
                                e.target.blur();
                              }
                            }}
                            className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-primary text-xs py-1.5 px-2 focus:outline-none rounded-md transition-all focus:bg-white focus:shadow-sm focus:ring-1 focus:ring-primary/20 text-slate-700 font-medium"
                          />
                          <span className="material-symbols-outlined text-[16px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            edit
                          </span>
                        </div>
                      </td>

                    </tr>
                  );
                })}

                {filteredList.length === 0 && (
                  <tr>
                    <td className="px-6 py-12 text-center text-secondary text-sm font-semibold" colSpan={4}>
                      {loading ? "Cargando registros..." : "No se encontraron empleados que coincidan con los filtros."}
                    </td>
                  </tr>
                )}

              </tbody>
            </table>
          </div>

        </div>

      </div>
    </div>
  );
}
