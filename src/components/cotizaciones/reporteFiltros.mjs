export const ESTADOS_REPORTE = {
  COTIZACION: "Cotización", ACEPTADA: "Aceptada", RECHAZADA: "Rechazada",
  ORDEN_VENTA: "Orden de venta", ENTREGADO: "Entregado", POR_FACTURAR: "Por facturar",
  FACTURADA: "Facturada", PAGADA: "Pagada",
};

// Las fechas de documento son fechas civiles; no se desplazan por zona horaria.
export function fechaReporte(c) {
  if (c.fecha_documento) return String(c.fecha_documento).slice(0, 10);
  if (!c.creada_en || Number.isNaN(new Date(c.creada_en).getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(c.creada_en));
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function fechaValida(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function errorFiltros(f) {
  if (!f.estados.length) return "Selecciona al menos un estado.";
  if (f.periodo === "rango" && (!fechaValida(f.desde) || !fechaValida(f.hasta))) return "Indica ambas fechas válidas.";
  if (f.periodo === "rango" && f.desde > f.hasta) return "La fecha inicial no puede ser posterior a la final.";
  if (f.periodo === "mensual" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(f.mes)) return "Selecciona un mes válido.";
  if (f.periodo === "anual" && !/^[1-9]\d{3}$/.test(String(f.anio))) return "Ingresa un año de cuatro dígitos.";
  return "";
}

export function filtrarReporte(list, f) {
  if (errorFiltros(f)) return [];
  return list.filter((c) => {
    if (c.es_suscripcion || !f.estados.includes(c.estado)) return false;
    if (f.cliente && String(c.cliente_id || c.cliente?.id) !== f.cliente) return false;
    const fecha = fechaReporte(c);
    if (f.periodo === "mensual") return fecha.startsWith(f.mes);
    if (f.periodo === "anual") return fecha.startsWith(`${f.anio}-`);
    if (f.periodo === "rango") return fecha >= f.desde && fecha <= f.hasta;
    return true;
  }).sort((a, b) => fechaReporte(b).localeCompare(fechaReporte(a)) || Number(b.numero) - Number(a.numero));
}
