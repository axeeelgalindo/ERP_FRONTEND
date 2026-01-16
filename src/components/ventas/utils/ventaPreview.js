export function buildVentaPreview({
  detalles,
  tipoItems,
  tipoDias,
  hhRegistros,
  compraItems,
  empleados,
  findHHForEmpleado,
}) {
  const contains = (s, sub) =>
    String(s || "").toLowerCase().includes(String(sub).toLowerCase());

  const lines = detalles.map((d) => {
    const cantidad = Number(d.cantidad) || 1;
    const alpha = (Number(d.alphaPct ?? 10) || 10) / 100;

    const tipoItem = tipoItems.find((t) => t.id === d.tipoItemId) || null;
    const tipoDia = tipoDias.find((t) => t.id === d.tipoDiaId) || null;

    const gananciaPct = tipoItem ? Number(tipoItem.porcentajeUtilidad || 0) : 0;

    const tipoDiaNombre = tipoDia?.nombre || "";
    const isFinSemana = contains(tipoDiaNombre, "fin de semana");
    const isUrgente = contains(tipoDiaNombre, "urgente");
    const extraFijo = (isFinSemana ? 200000 : 0) + (isUrgente ? 400000 : 0);

    let costoTotal = 0;
    let ventaTotal = 0;

    if (d.modo === "HH") {
      const hh = findHHForEmpleado(d.empleadoId);
      const costoHH = hh?.costoHH != null ? Number(hh.costoHH) : 0;
      const cif = hh?.cif != null ? Number(hh.cif) : 0;

      costoTotal = costoHH * cantidad + cif;

      const ventaUnit = costoHH * (gananciaPct / 100) + cif / cantidad + extraFijo;

      const multGananciaFinSemana = isFinSemana ? 1 + gananciaPct / 100 : 1;
      ventaTotal = ventaUnit * cantidad * multGananciaFinSemana * (1 + alpha);
    } else {
      const ci = compraItems.find((x) => x.id === d.compraId);
      let costoUnit = 0;
      if (ci) {
        const cantCompra = Number(ci.cantidad) || 1;
        costoUnit =
          ci.precio_unit != null
            ? Number(ci.precio_unit)
            : (Number(ci.total) || 0) / cantCompra;
      }

      costoTotal = costoUnit * cantidad;
      ventaTotal = costoTotal * (1 + gananciaPct / 100) * (1 + alpha);
    }

    const utilidad = ventaTotal - costoTotal;
    const pct = ventaTotal > 0 ? (utilidad / ventaTotal) * 100 : 0;

    return { costoTotal, ventaTotal, utilidad, pct };
  });

  const total = lines.reduce((acc, x) => acc + (x.ventaTotal || 0), 0);
  const costo = lines.reduce((acc, x) => acc + (x.costoTotal || 0), 0);
  const utilidad = total - costo;

  return { total, costo, utilidad, lines };
}
