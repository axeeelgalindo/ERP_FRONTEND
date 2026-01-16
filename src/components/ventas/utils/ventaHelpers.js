import { formatCLP } from "./money";

export function normalizeRut(rut) {
  return String(rut || "")
    .trim()
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .replace(/\s+/g, "");
}

export function getEmpleadoRut(emp) {
  return emp?.rut ?? emp?.RUT ?? emp?.usuario?.rut ?? emp?.usuario?.RUT ?? null;
}

export function getHHRut(hh) {
  return hh?.rut ?? hh?.RUT ?? hh?.empleado?.rut ?? hh?.empleado?.RUT ?? null;
}

export function getHHEmpleadoEmpleadoId(hh) {
  return hh?.empleado_id ?? hh?.empleadoId ?? hh?.empleado?.id ?? null;
}

export function empleadoLabel(emp) {
  return emp?.usuario?.nombre || emp?.nombre || emp?.rut || emp?.id || "Empleado";
}

export function compraItemLabel(ci) {
  const cant = Number(ci?.cantidad) || 1;
  const total = Number(ci?.total) || 0;
  const pu =
    ci?.precio_unit != null ? Number(ci.precio_unit) : cant > 0 ? total / cant : total;

  const proveedor = ci?.proveedor?.nombre;
  const productoId = ci?.producto_id;

  const itemText = (ci?.item != null ? String(ci.item) : "").trim();
  const prodName = (ci?.producto?.nombre != null ? String(ci.producto.nombre) : "").trim();

  const nombreBase = productoId
    ? prodName || `Producto (${String(productoId).slice(0, 6)}…)`
    : itemText || "Ítem sin nombre";

  const compraNumero = ci?.compra?.numero ? `OC #${ci.compra.numero}` : "";

  return `${nombreBase}${proveedor ? ` | ${proveedor}` : ""}${
    compraNumero ? ` | ${compraNumero}` : ""
  } | PU: ${formatCLP(pu)}`;
}
