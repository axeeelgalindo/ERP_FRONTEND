// (tu página HHPage.jsx / page.jsx)
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  CardActions,
  Button,
  TextField,
  CircularProgress,
  Snackbar,
  Alert,
  Divider,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  MenuItem,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function HHPage() {
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

  // ✅ CIF float
  const [cif, setCif] = useState("");

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

  const handleCloseSnackbar = (_, reason) => {
    if (reason === "clickaway") return;
    setSnackbarOpen(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodMonth]);

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
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error al obtener HH");

      const registros = Array.isArray(data) ? data : data.rows || [];
      setRows(registros);

      setPeriodFilter("ALL");
      setPeriodoLabel("Todos los períodos");

      if (!registros.length) showSnackbar("info", "No hay registros HH para esta empresa.");
    } catch (err) {
      showSnackbar("error", err.message || "Error al obtener HH");
    } finally {
      setLoadingList(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return showSnackbar("error", "Debes seleccionar un archivo .xlsx.");
    if (!empresaIdFromToken) return showSnackbar("error", "No se encontró empresa en tu sesión.");
    if (!anio || !mes) return showSnackbar("error", "Debes indicar Año y Mes para el archivo.");
    if (!horasMensuales || !porcentajeEfectividad) {
      return showSnackbar("error", "Debes indicar Horas mensuales y % efectividad para calcular el costo HH.");
    }

    // ✅ CIF numérico
    const cifNum = Number(String(cif).replace(",", "."));
    if (!cif || Number.isNaN(cifNum)) {
      return showSnackbar("error", "Debes indicar un CIF numérico (ej: 1234.56).");
    }

    const formData = new FormData();
    formData.append("empresa_id", empresaIdFromToken);
    formData.append("anio", anio);
    formData.append("mes", mes);
    formData.append("file", file);

    formData.append("horas_mensuales", horasMensuales);
    formData.append("porcentaje_efectividad", porcentajeEfectividad);

    // ✅ enviar como texto, backend lo parsea a float con parseNumber
    formData.append("cif", String(cif));

    try {
      setLoadingUpload(true);

      const res = await fetch(`${API_URL}/hh/libro/upload`, {
        method: "POST",
        headers: buildAuthHeaders(),
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir el archivo");

      showSnackbar("success", "Libro de remuneraciones cargado correctamente");
      setFile(null);

      await fetchHH();
    } catch (err) {
      showSnackbar("error", err.message || "Error al subir el archivo");
    } finally {
      setLoadingUpload(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && empresaIdFromToken) fetchHH();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const totalCostoHH = filteredRows.reduce((acc, r) => acc + (getCostoHHForRow(r) || 0), 0);
  const promedioCostoHH = totalEmpleados > 0 ? totalCostoHH / totalEmpleados : 0;

  if (status === "loading") {
    return (
      <Box sx={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6">
          Debes iniciar sesión para ver el Libro de Remuneraciones.
        </Typography>
      </Box>
    );
  }

  const empresaLabel =
    empresaNombreFromToken && empresaIdFromToken
      ? `${empresaNombreFromToken} (${empresaIdFromToken})`
      : empresaNombreFromToken || empresaIdFromToken || "Sin empresa";

  return (
    <Box sx={{ maxWidth: "3xl", mx: "auto", p: { xs: 2, md: 3 } }}>
      <Box
        sx={{
          mb: 3,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Libro de Remuneraciones (HH)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Empresa: <strong>{empresaLabel}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sube tu libro mensual y visualiza el costo hora (HH) por empleado.
          </Typography>
        </Box>
        {periodoLabel && (
          <Chip
            label={`Período: ${periodoLabel}`}
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 500 }}
          />
        )}
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.2fr 1fr" },
          gap: 2,
          mb: 3,
        }}
      >
        <Card sx={{ borderRadius: 3, boxShadow: 3 }}>
          <CardHeader
            title="Período & Parámetros HH"
            subheader="Define el filtro de período y los parámetros para costo hora"
          />
          <CardContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <TextField
                  label="Mes y Año"
                  size="small"
                  sx={{ flex: 1, minWidth: 220 }}
                  type="month"
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  helperText="Selecciona mes/año (no requiere librerías extra)"
                />
              </Box>

              <Divider sx={{ my: 1 }} />

              <Typography variant="subtitle2" color="text.secondary">
                Parámetros para cálculo de costo HH
              </Typography>

              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <TextField
                  label="Horas mensuales (contrato)"
                  type="number"
                  size="small"
                  sx={{ flex: 1, minWidth: 160 }}
                  value={horasMensuales}
                  onChange={(e) => setHorasMensuales(e.target.value)}
                  placeholder="Ej: 166"
                />
                <TextField
                  label="% efectividad"
                  type="number"
                  size="small"
                  sx={{ flex: 1, minWidth: 140 }}
                  value={porcentajeEfectividad}
                  onChange={(e) => setPorcentajeEfectividad(e.target.value)}
                  placeholder="Ej: 70"
                />
              </Box>

              <TextField
                label="CIF (costos indirectos del período)"
                type="number"
                size="small"
                value={cif}
                onChange={(e) => setCif(e.target.value)}
                placeholder="Ej: 123456.78"
                helperText="Número (float). Si usas coma, igual lo parseamos."
              />

              {horasEfectivasTotales > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
                  Horas efectivas totales:{" "}
                  <strong>{horasEfectivasTotales.toFixed(2)} hrs/mes</strong>
                </Typography>
              )}
            </Box>
          </CardContent>

          <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<SearchIcon />}
              onClick={() => fetchHH()}
              disabled={loadingList}
            >
              {loadingList ? <CircularProgress size={20} color="inherit" /> : "Buscar HH"}
            </Button>

            <Button
              variant="text"
              color="inherit"
              startIcon={<RefreshIcon />}
              onClick={() => {
                const now2 = new Date();
                const yyyy = String(now2.getFullYear());
                const mm = String(now2.getMonth() + 1).padStart(2, "0");
                setPeriodMonth(`${yyyy}-${mm}`);
                setCif("");
                fetchHH();
              }}
            >
              Limpiar filtros
            </Button>
          </CardActions>
        </Card>

        <Card sx={{ borderRadius: 3, boxShadow: 3 }}>
          <CardHeader
            title="Cargar archivo Excel"
            subheader="Sube el libro de remuneraciones mensual (.xlsx)"
          />
          <CardContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Button
                variant="outlined"
                component="label"
                fullWidth
                startIcon={<UploadFileIcon />}
              >
                {file ? file.name : "Seleccionar archivo .xlsx"}
                <input
                  type="file"
                  hidden
                  accept=".xlsx"
                  onChange={(e) => setFile(e.target.files[0] || null)}
                />
              </Button>
              <Typography variant="caption" color="text.secondary">
                Recuerda seleccionar Mes/Año, parámetros HH y el CIF antes de subir el archivo.
              </Typography>
            </Box>
          </CardContent>
          <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleUpload}
              disabled={loadingUpload}
              startIcon={!loadingUpload && <UploadFileIcon />}
            >
              {loadingUpload ? <CircularProgress size={22} color="inherit" /> : "Subir y procesar"}
            </Button>
            <Button
              variant="text"
              color="inherit"
              startIcon={<RefreshIcon />}
              onClick={() => setFile(null)}
            >
              Limpiar archivo
            </Button>
          </CardActions>
        </Card>
      </Box>

      <Card
        sx={{
          mb: 3,
          borderRadius: 3,
          boxShadow: 2,
          background: "linear-gradient(135deg, rgba(25,118,210,0.06), rgba(25,118,210,0.01))",
        }}
      >
        <CardContent>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">Empleados con HH</Typography>
              <Typography variant="h5" fontWeight={700}>{totalEmpleados}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">Suma costo HH (aprox.)</Typography>
              <Typography variant="h5" fontWeight={700}>
                {totalCostoHH.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">Costo HH promedio</Typography>
              <Typography variant="h5" fontWeight={700}>
                {promedioCostoHH.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3, boxShadow: 3 }}>
        <CardHeader
          title="Registros HH cargados"
          subheader={
            filteredRows.length
              ? "Detalle por empleado. Usa los filtros para acotar el período."
              : "No hay registros aún. Sube un archivo o ajusta los filtros."
          }
          action={
            <TextField
              select
              size="small"
              label="Filtrar período"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              {periodOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          }
        />
        <Divider />
        <CardContent sx={{ p: 0 }}>
          <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Año</TableCell>
                  <TableCell>Mes</TableCell>
                  <TableCell align="right">CIF</TableCell>
                  <TableCell>Nombre</TableCell>
                  <TableCell>RUT</TableCell>
                  <TableCell align="right">Días trab.</TableCell>
                  <TableCell align="right">Haberes</TableCell>
                  <TableCell align="right">Empleador</TableCell>
                  <TableCell align="right">Pagado</TableCell>
                  <TableCell align="right">Feriado</TableCell>
                  <TableCell align="right">Indemnización</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Costo HH</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.map((row) => {
                  const costoHH = getCostoHHForRow(row);
                  const money = (v) =>
                    v != null
                      ? v.toLocaleString("es-CL", {
                          style: "currency",
                          currency: "CLP",
                          maximumFractionDigits: 0,
                        })
                      : "-";

                  const cifFmt =
                    row.cif != null
                      ? Number(row.cif).toLocaleString("es-CL", {
                          style: "currency",
                          currency: "CLP",
                          maximumFractionDigits: 0,
                        })
                      : "-";

                  return (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.anio}</TableCell>
                      <TableCell>{getMesLabel(row.mes) || row.mes}</TableCell>
                      <TableCell align="right">{cifFmt}</TableCell>
                      <TableCell>{row.nombre}</TableCell>
                      <TableCell>{row.rut}</TableCell>
                      <TableCell align="right">{row.dias_trabajados ?? "-"}</TableCell>
                      <TableCell align="right">{money(row.haberes)}</TableCell>
                      <TableCell align="right">{money(row.empleador)}</TableCell>
                      <TableCell align="right">{money(row.pagado)}</TableCell>
                      <TableCell align="right">{money(row.feriado)}</TableCell>
                      <TableCell align="right">{money(row.indemnizacion)}</TableCell>
                      <TableCell align="right">{money(row.total)}</TableCell>
                      <TableCell align="right">
                        {costoHH != null && !Number.isNaN(costoHH)
                          ? costoHH.toLocaleString("es-CL", {
                              style: "currency",
                              currency: "CLP",
                              maximumFractionDigits: 0,
                            })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!filteredRows.length && !loadingList && (
                  <TableRow>
                    <TableCell colSpan={13} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        No hay datos para mostrar con el filtro seleccionado.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}

                {loadingList && (
                  <TableRow>
                    <TableCell colSpan={13} align="center">
                      <Box sx={{ py: 3, display: "flex", gap: 1, justifyContent: "center" }}>
                        <CircularProgress size={24} />
                        <Typography variant="body2" color="text.secondary">
                          Cargando HH de la empresa...
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbarSeverity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
