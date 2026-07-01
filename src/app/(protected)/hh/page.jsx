// src/app/(protected)/hh/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Upload, 
  Search, 
  RefreshCw, 
  FileSpreadsheet, 
  DollarSign, 
  Users, 
  Calculator, 
  AlertTriangle,
  X,
  Sparkles,
  TrendingUp,
  Percent,
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function HHPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const empresaIdFromToken = useMemo(
    () => session?.user?.empresa?.id || session?.user?.empresaId || null,
    [session]
  );
  const empresaNombreFromToken = useMemo(
    () => session?.user?.empresa?.nombre || session?.user?.empresaNombre || "",
    [session]
  );

  const now = new Date();

  const [file, setFile] = useState(null);

  const [periodMonth, setPeriodMonth] = useState(() => {
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  });

  const [anio, setAnio] = useState(() => String(now.getFullYear()));
  const [mes, setMes] = useState(() => String(now.getMonth() + 1));

  const [horasMensuales, setHorasMensuales] = useState("");
  const [porcentajeEfectividad, setPorcentajeEfectividad] = useState("");

  // ✅ CIF: input formateado + valor "limpio" para backend
  const [cifInput, setCifInput] = useState("");
  const [cif, setCif] = useState(""); // SOLO NUMEROS (string) para enviar al backend

  const [loadingUpload, setLoadingUpload] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  const [rows, setRows] = useState([]);
  const [periodoLabel, setPeriodoLabel] = useState("Todos los períodos");

  const [periodFilter, setPeriodFilter] = useState("ALL");

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState("success");
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const showSnackbar = (severity, message) => {
    setSnackbarSeverity(severity);
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  const getMesLabel = (m) => {
    const nombres = [
      "",
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    const idx = Number(m);
    if (!idx || idx < 1 || idx > 12) return "";
    return nombres[idx];
  };

  const buildAuthHeaders = () => {
    const token =
      session?.user?.accessToken ||
      session?.user?.token ||
      session?.token ||
      null;

    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  const syncMonthToParts = (value) => {
    if (!value || !/^\d{4}-\d{2}$/.test(value)) return;
    const [yy, mm] = value.split("-");
    setAnio(String(Number(yy)));
    setMes(String(Number(mm)));
  };

  useEffect(() => {
    syncMonthToParts(periodMonth);
  }, [periodMonth]);

  /* =========================
     ✅ Helpers CIF CLP
  ========================= */
  const formatCLP = (n) =>
    Number(n || 0).toLocaleString("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    });

  const onlyDigits = (s) => String(s ?? "").replace(/[^\d]/g, "");

  const parseCLPToNumberString = (s) => {
    const digits = onlyDigits(s);
    return digits ? String(Number(digits)) : "";
  };

  const handleCifChange = (e) => {
    const raw = e.target.value;

    // 1) valor limpio (para backend)
    const clean = parseCLPToNumberString(raw);
    setCif(clean);

    // 2) valor mostrado (formateado)
    if (!clean) {
      setCifInput("");
      return;
    }
    setCifInput(formatCLP(Number(clean)));
  };

  /* =========================
     ✅ SAFE JSON + AUTH ERRORS
  ========================= */
  const safeJson = async (res) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };

  const handleAuthErrors = (statusCode) => {
    if (statusCode === 401) {
      showSnackbar("warning", "Tu sesión no es válida. Inicia sesión nuevamente.");
      setTimeout(() => router.push("/login"), 600);
      return true;
    }

    if (statusCode === 403) {
      showSnackbar("error", "Acceso restringido: módulo HH confidencial.");
      setTimeout(() => router.push("/"), 800);
      return true;
    }

    return false;
  };

  /* =========================
     Data fetch
  ========================= */
  const fetchHH = async () => {
    if (!empresaIdFromToken) {
      showSnackbar("error", "No se encontró empresa en tu sesión. Revisa el token.");
      return;
    }

    try {
      setLoadingList(true);

      const params = new URLSearchParams();
      params.set("empresa_id", empresaIdFromToken);

      const url = `${API_URL}/hh/libro?${params.toString()}`;
      const res = await fetch(url, { headers: buildAuthHeaders() });

      if (handleAuthErrors(res.status)) return;

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Error al obtener HH");

      const registros = Array.isArray(data) ? data : data?.rows || [];
      setRows(registros);

      setPeriodFilter("ALL");
      setPeriodoLabel("Todos los períodos");

      if (!registros.length) showSnackbar("info", "No hay registros HH para esta empresa.");
    } catch (err) {
      showSnackbar("error", err?.message || "Error al obtener HH");
    } finally {
      setLoadingList(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return showSnackbar("error", "Debes seleccionar un archivo .xlsx.");
    if (!empresaIdFromToken) return showSnackbar("error", "No se encontró empresa en tu sesión.");
    if (!anio || !mes) return showSnackbar("error", "Debes indicar Año y Mes para el archivo.");
    if (!horasMensuales || !porcentajeEfectividad) {
      return showSnackbar(
        "error",
        "Debes indicar Horas mensuales y % efectividad para calcular el costo HH."
      );
    }

    // ✅ CIF (limpio)
    const cifNum = Number(cif);
    if (!cif || Number.isNaN(cifNum) || cifNum <= 0) {
      return showSnackbar("error", "Debes indicar un CIF válido (ej: 4000).");
    }

    const formData = new FormData();
    formData.append("empresa_id", empresaIdFromToken);
    formData.append("anio", anio);
    formData.append("mes", mes);
    formData.append("file", file);

    formData.append("horas_mensuales", horasMensuales);
    formData.append("porcentaje_efectividad", porcentajeEfectividad);

    formData.append("cif", String(cif));

    try {
      setLoadingUpload(true);

      const res = await fetch(`${API_URL}/hh/libro/upload`, {
        method: "POST",
        headers: buildAuthHeaders(),
        body: formData,
      });

      if (handleAuthErrors(res.status)) return;

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Error al subir el archivo");

      showSnackbar("success", "Libro de remuneraciones cargado correctamente");
      setFile(null);

      await fetchHH();
    } catch (err) {
      showSnackbar("error", err?.message || "Error al subir el archivo");
    } finally {
      setLoadingUpload(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && empresaIdFromToken) fetchHH();
  }, [status, empresaIdFromToken]);

  const horasMensualesNum = Number(horasMensuales) || 0;
  const porcentajeEfectividadNum = Number(porcentajeEfectividad) || 0;
  const horasEfectivasTotales =
    horasMensualesNum > 0 && porcentajeEfectividadNum > 0
      ? horasMensualesNum * (porcentajeEfectividadNum / 100)
      : 0;

  const getCostoHHForRow = (row) => {
    if (row.costoHH == null) return null;
    return Number(row.costoHH);
  };

  const periodOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (r.nombre_periodo) {
        map.set(r.nombre_periodo, r.nombre_periodo);
        return;
      }
      if (r.anio != null && r.mes != null) {
        const label = `${getMesLabel(r.mes) || `Mes ${r.mes}`} ${r.anio}`;
        map.set(label, label);
      }
    });

    const list = Array.from(map.values());
    list.sort((a, b) => {
      const parse = (s) => {
        const parts = s.split(" ");
        const year = Number(parts[parts.length - 1]) || 0;
        const monthName = parts.slice(0, -1).join(" ").toLowerCase();
        const meses = {
          enero: 1,
          febrero: 2,
          marzo: 3,
          abril: 4,
          mayo: 5,
          junio: 6,
          julio: 7,
          agosto: 8,
          septiembre: 9,
          octubre: 10,
          noviembre: 11,
          diciembre: 12,
        };
        const m = meses[monthName] || 0;
        return year * 100 + m;
      };
      return parse(b) - parse(a);
    });

    return [
      { value: "ALL", label: "Todos los períodos" },
      ...list.map((p) => ({ value: p, label: p })),
    ];
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (periodFilter === "ALL") return rows;

    return rows.filter((r) => {
      if (r.nombre_periodo) return r.nombre_periodo === periodFilter;
      if (r.anio != null && r.mes != null) {
        const label = `${getMesLabel(r.mes) || `Mes ${r.mes}`} ${r.anio}`;
        return label === periodFilter;
      }
      return false;
    });
  }, [rows, periodFilter]);

  const totalEmpleados = filteredRows.length;
  const totalCostoHH = filteredRows.reduce(
    (acc, r) => acc + (getCostoHHForRow(r) || 0),
    0
  );
  const promedioCostoHH =
    totalEmpleados > 0 ? totalCostoHH / totalEmpleados : 0;

  // Auto-close toast
  useEffect(() => {
    if (snackbarOpen) {
      const t = setTimeout(() => setSnackbarOpen(false), 4000);
      return () => clearTimeout(t);
    }
  }, [snackbarOpen]);

  if (status === "loading") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-sm font-medium text-slate-500">Cargando módulo de Remuneraciones...</span>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800 mb-2">Sesión Requerida</h3>
        <p className="text-sm text-slate-500 mb-4">Debes iniciar sesión para ver el Libro de Remuneraciones.</p>
        <button 
          onClick={() => router.push("/login")}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all"
        >
          Ir al Login
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-0px)] pb-12">
      {/* Top Header */}
      <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 md:px-8">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-900">Libro de Remuneraciones (HH)</h2>
        </div>

        {periodoLabel && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-xs font-semibold text-blue-700">
            <Calendar className="w-3.5 h-3.5" />
            Período: {periodoLabel}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-8 mt-8">
        <p className="text-slate-500 mb-6 -mt-2">
          Sube el libro mensual de remuneraciones para calcular automáticamente el costo por hora (HH) por empleado.
        </p>

        {/* Grid Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          
          {/* Parámetros */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Parámetros HH & Período</h3>
                  <p className="text-xs text-slate-400">Configura el período y variables para obtener el costo hora</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Mes y Año</label>
                  <input
                    type="month"
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Período para el cual se asignará el libro</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">CIF Indirecto (CLP)</label>
                  <input
                    type="text"
                    value={cifInput}
                    onChange={handleCifChange}
                    placeholder="Ej: 4.000.000"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {cif ? `Valor de envío: ${formatCLP(cif)}` : "Costos indirectos del período"}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 my-5" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Horas Mensuales (Contrato)</label>
                  <input
                    type="number"
                    value={horasMensuales}
                    onChange={(e) => setHorasMensuales(e.target.value)}
                    placeholder="Ej: 166"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">% Efectividad</label>
                  <input
                    type="number"
                    value={porcentajeEfectividad}
                    onChange={(e) => setPorcentajeEfectividad(e.target.value)}
                    placeholder="Ej: 70"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700"
                  />
                </div>
              </div>

              {horasEfectivasTotales > 0 && (
                <div className="mt-4 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 text-xs flex items-center justify-between">
                  <span>Horas efectivas totales calculadas:</span>
                  <strong className="font-bold">{horasEfectivasTotales.toFixed(2)} hrs/mes</strong>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  const now2 = new Date();
                  const yyyy = String(now2.getFullYear());
                  const mm = String(now2.getMonth() + 1).padStart(2, "0");
                  setPeriodMonth(`${yyyy}-${mm}`);
                  setCif("");
                  setCifInput("");
                  fetchHH();
                }}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-all"
              >
                <RefreshCw className="w-4 h-4 text-slate-400" />
                Limpiar filtros
              </button>

              <button
                type="button"
                onClick={fetchHH}
                disabled={loadingList}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-sm shadow-blue-500/10 transition-all active:scale-95"
              >
                {loadingList ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Buscar HH
              </button>
            </div>
          </div>

          {/* Cargar Archivo */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Cargar Archivo Excel</h3>
                  <p className="text-xs text-slate-400">Formatos admitidos: .xlsx de remuneraciones</p>
                </div>
              </div>

              <div className="mt-6">
                <label className="border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-slate-50/50 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group">
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <div className="p-3 bg-slate-50 group-hover:bg-blue-50 group-hover:text-blue-600 text-slate-400 rounded-2xl transition-all">
                    <FileSpreadsheet className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-semibold text-slate-700 block">
                      {file ? file.name : "Seleccionar Libro de Remuneraciones"}
                    </span>
                    <span className="text-xs text-slate-400 mt-1 block">
                      Haga clic para buscar o arrastre aquí
                    </span>
                  </div>
                </label>
              </div>

              <div className="mt-4 flex items-start gap-2 text-[11px] text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>Recuerda completar el mes/año de período, horas de contrato y CIF antes de presionar subir.</span>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              {file && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  Limpiar
                </button>
              )}
              <button
                type="button"
                onClick={handleUpload}
                disabled={loadingUpload || !file}
                className="flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95"
              >
                {loadingUpload ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Subir y procesar
              </button>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Empleados con HH</span>
              <h4 className="text-2xl font-bold text-slate-800 mt-0.5">{totalEmpleados}</h4>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Suma Costo HH (Aprox.)</span>
              <h4 className="text-2xl font-bold text-slate-800 mt-0.5">{formatCLP(totalCostoHH)}</h4>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Costo HH Promedio</span>
              <h4 className="text-2xl font-bold text-slate-800 mt-0.5">{formatCLP(promedioCostoHH)}</h4>
            </div>
          </div>
        </div>

        {/* Registros Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Registros de HH Cargados</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {filteredRows.length
                  ? "Detalle de costo HH calculado por empleado."
                  : "No hay registros disponibles."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Filtrar:</label>
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700"
              >
                {periodOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5">Año</th>
                  <th className="px-6 py-3.5">Mes</th>
                  <th className="px-6 py-3.5 text-right">CIF</th>
                  <th className="px-6 py-3.5">Nombre Empleado</th>
                  <th className="px-6 py-3.5">RUT</th>
                  <th className="px-6 py-3.5 text-right">Días Trab.</th>
                  <th className="px-6 py-3.5 text-right">Sueldo Pagado</th>
                  <th className="px-6 py-3.5 text-right">Costo Total</th>
                  <th className="px-6 py-3.5 text-right font-bold text-blue-600">Costo HH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const costoHH = getCostoHHForRow(row);
                  const cifValor = row?.cif?.valor != null ? Number(row.cif.valor) : null;

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-700">{row.anio}</td>
                      <td className="px-6 py-4">{getMesLabel(row.mes) || row.mes}</td>
                      <td className="px-6 py-4 text-right">
                        {cifValor != null && !isNaN(cifValor) ? formatCLP(cifValor) : "—"}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">{row.nombre}</td>
                      <td className="px-6 py-4 font-mono text-xs">{row.rut}</td>
                      <td className="px-6 py-4 text-right">{row.dias_trabajados ?? "—"}</td>
                      <td className="px-6 py-4 text-right">{row.pagado != null ? formatCLP(row.pagado) : "—"}</td>
                      <td className="px-6 py-4 text-right">{row.total != null ? formatCLP(row.total) : "—"}</td>
                      <td className="px-6 py-4 text-right font-bold text-blue-600">
                        {costoHH != null && !isNaN(costoHH) ? formatCLP(costoHH) : "—"}
                      </td>
                    </tr>
                  );
                })}

                {!filteredRows.length && !loadingList && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                      <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <span className="text-sm">No hay registros disponibles para el período filtrado.</span>
                    </td>
                  </tr>
                )}

                {loadingList && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-blue-600 font-semibold text-sm">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Actualizando registros...</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Floating Premium Toast Notifications */}
      {snackbarOpen && (
        <div 
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3.5 rounded-xl shadow-xl border animate-bounce-short transition-all duration-300 ${
            snackbarSeverity === "success" 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
              : snackbarSeverity === "error" 
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : snackbarSeverity === "warning"
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-blue-50 border-blue-200 text-blue-800"
          }`}
        >
          {snackbarSeverity === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
          {snackbarSeverity === "error" && <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />}
          {snackbarSeverity === "warning" && <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />}
          {!(["success", "error", "warning"].includes(snackbarSeverity)) && <HelpCircle className="w-5 h-5 text-blue-500 shrink-0" />}
          
          <span className="text-xs font-semibold">{snackbarMessage}</span>
          
          <button 
            type="button"
            onClick={() => setSnackbarOpen(false)}
            className="p-1 hover:bg-black/5 rounded-full transition-colors ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
