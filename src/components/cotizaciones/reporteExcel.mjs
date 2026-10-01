import { ESTADOS_REPORTE, fechaReporte } from "./reporteFiltros.mjs";

const blue = "174766";
const money = '"$" #,##0;[Red]-"$" #,##0';
const fill = (color) => ({ type: "pattern", pattern: "solid", fgColor: { argb: `FF${color}` } });
const text = (value) => String(value ?? "");
const number = (value) => {
  const result = Number(value ?? 0);
  if (!Number.isFinite(result)) throw new Error("Hay un monto inválido en las cotizaciones seleccionadas.");
  return result;
};

function header(row) {
  row.height = 30;
  row.eachCell(cell => {
    cell.fill = fill(blue);
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
}

function styleSheet(sheet) {
  sheet.eachRow(row => {
    row.height = 24;
    row.eachCell(cell => {
      cell.font = { name: "Arial", size: 10, color: { argb: "FF26333F" } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
  });
  sheet.getCell("A1").font = { name: "Arial", size: 18, bold: true, color: { argb: `FF${blue}` } };
  sheet.getRow(1).height = 34;
  sheet.headerFooter.oddFooter = "&LReporte de cotizaciones&R Página &P de &N";
}

// Pure workbook builder shared by browser download and export verification.
export async function crearReporteExcel({ cotizaciones, empresa, periodo, estados, cliente, emitido = new Date() }) {
  if (!cotizaciones.length) throw new Error("No hay cotizaciones para exportar.");
  const module = await import("exceljs");
  const ExcelJS = module.default || module;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = empresa || "ERP";
  workbook.created = emitido;
  workbook.calcProperties.fullCalcOnLoad = true;
  const summary = workbook.addWorksheet("Resumen", { views: [{ showGridLines: false }] });
  const detail = workbook.addWorksheet("Cotizaciones", {
    views: [{ state: "frozen", ySplit: 4, xSplit: 1, showGridLines: false }],
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:4" },
  });
  detail.addRow(["Detalle de cotizaciones"]);
  detail.mergeCells("A1:F1");
  detail.addRow([empresa || "Empresa"]);
  detail.mergeCells("A2:F2");
  detail.addRow(["Montos en CLP con IVA. Fecha del documento o, si falta, fecha de creación en Chile."]);
  detail.mergeCells("A3:F3");
  detail.addRow(["N° cotización", "Asunto", "Cliente", "Fecha", "Estado", "Monto total (CLP)"]);
  const data = cotizaciones.map(c => {
    const civil = fechaReporte(c);
    const date = civil ? new Date(`${civil}T00:00:00Z`) : null;
    return [text(c.numero), text(c.asunto || c.descripcion || "-"), text(c.cliente?.nombre || "-"), date && !Number.isNaN(date.getTime()) ? date : null, ESTADOS_REPORTE[c.estado] || text(c.estado), number(c.total)];
  });
  detail.addRows(data);
  const last = 4 + data.length;
  const total = data.reduce((sum, row) => sum + row[5], 0);
  const totalRow = detail.addRow(["TOTAL VISIBLE", null, null, null, null, { formula: `SUBTOTAL(109,F5:F${last})`, result: total }]);
  detail.autoFilter = `A4:F${last}`;
  styleSheet(detail);
  const minimum = [17, 28, 25, 14, 20, 23];
  const maximum = [22, 62, 48, 14, 24, 30];
  detail.columns.forEach((column, index) => {
    const lengths = data.map(row => index === 3 ? 10 : index === 5 ? number(row[index]).toLocaleString("es-CL").length + 3 : Math.max(...text(row[index]).split(/\r?\n/).map(s => s.length)));
    column.width = Math.min(maximum[index], lengths.reduce((width, n) => Math.max(width, n + 3), minimum[index]));
  });
  for (let i = 5; i <= last; i++) {
    const row = detail.getRow(i);
    let lines = 1;
    row.eachCell((cell, col) => {
      if (i % 2) cell.fill = fill("F0F5F9");
      if (typeof cell.value === "string") {
        lines = Math.max(lines, cell.value.split(/\r?\n/).reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / (detail.getColumn(col).width - 4))), 0));
      }
    });
    row.height = Math.max(28, lines * 16 + 10);
  }
  detail.getColumn(4).numFmt = "dd/mm/yyyy";
  detail.getColumn(6).numFmt = money;
  detail.getColumn(6).alignment = { horizontal: "right", vertical: "middle" };
  header(detail.getRow(4));
  header(totalRow);
  totalRow.getCell(6).numFmt = money;

  summary.columns = [{ width: 29 }, { width: 25 }, { width: 29 }];
  summary.addRow(["Reporte de cotizaciones"]);
  summary.mergeCells("A1:C1");
  summary.addRow([empresa || "Empresa"]);
  summary.mergeCells("A2:C2");
  summary.addRow(["Emisión (Chile)", emitido.toLocaleString("es-CL", { timeZone: "America/Santiago" })]);
  summary.mergeCells("B3:C3");
  for (const [label, value] of [["Período", periodo], ["Estados seleccionados", estados.map(e => ESTADOS_REPORTE[e] || e).join(", ")], ["Cliente", cliente || "Todos los clientes"]]) {
    const row = summary.addRow([label, value]);
    summary.mergeCells(row.number, 2, row.number, 3);
  }
  summary.addRow([]);
  summary.addRow(["Estado actual", "Cantidad", "Monto total (CLP)"]);
  for (const estado of estados) {
    const label = ESTADOS_REPORTE[estado] || estado;
    const matches = data.filter(row => row[4] === label);
    const r = summary.rowCount + 1;
    summary.addRow([label, { formula: `COUNTIF('Cotizaciones'!E5:E${last},A${r})`, result: matches.length }, { formula: `SUMIF('Cotizaciones'!E5:E${last},A${r},'Cotizaciones'!F5:F${last})`, result: matches.reduce((sum, row) => sum + row[5], 0) }]);
  }
  const end = summary.rowCount;
  const sumRow = summary.addRow(["TOTAL", { formula: `SUM(B9:B${end})`, result: data.length }, { formula: `SUM(C9:C${end})`, result: total }]);
  summary.addRow([]);
  const note = summary.addRow(["Montos en CLP con IVA. Los estados e indicadores corresponden a la selección al momento de exportar."]);
  summary.mergeCells(note.number, 1, note.number, 3);
  styleSheet(summary);
  for (const r of [4, 5, 6]) {
    const value = text(summary.getCell(`B${r}`).value);
    summary.getRow(r).height = Math.max(28, Math.ceil(value.length / 47) * 16 + 10);
  }
  note.height = 42;
  summary.getColumn(2).numFmt = "#,##0";
  summary.getColumn(3).numFmt = money;
  for (let r = 9; r <= end; r++) {
    if (r % 2) summary.getRow(r).eachCell(cell => { cell.fill = fill("F0F5F9"); });
  }
  header(summary.getRow(8));
  header(sumRow);
  return workbook;
}
