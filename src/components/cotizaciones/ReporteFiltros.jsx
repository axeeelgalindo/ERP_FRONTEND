"use client";

import { Autocomplete, TextField, InputAdornment } from "@mui/material";
import { FileText, CircleCheck, CircleX, ShoppingCart, Truck, Receipt, Banknote, CalendarDays, CalendarRange, Calendar, History, Users, Search, Check, Info, SlidersHorizontal } from "lucide-react";
import { ESTADOS_REPORTE } from "./reporteFiltros.mjs";

const estadoIcons = { COTIZACION: FileText, ACEPTADA: CircleCheck, RECHAZADA: CircleX, ORDEN_VENTA: ShoppingCart, ENTREGADO: Truck, POR_FACTURAR: Receipt, FACTURADA: FileText, PAGADA: Banknote };
const periodos = [
  { value: "total", label: "Todo el historial", icon: History },
  { value: "mensual", label: "Un mes", icon: CalendarDays },
  { value: "anual", label: "Un año", icon: Calendar },
  { value: "rango", label: "Entre fechas", icon: CalendarRange },
];
const todos = { id: "", nombre: "Todos los clientes" };

function SectionTitle({ number, title, description }) {
  return <div className="flex items-start gap-3">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{number}</span>
    <div><h3 className="text-sm font-semibold text-slate-900">{title}</h3><p className="mt-0.5 text-xs text-slate-500">{description}</p></div>
  </div>;
}

export default function ReporteFiltros({ filtros: f, cambiar, clientes, busy, error, cantidad }) {
  const input = "block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50";
  const options = [todos, ...clientes.map(([id, nombre]) => ({ id, nombre }))];
  return <fieldset disabled={busy} className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
    <legend className="sr-only">Configurar reporte</legend>
    <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-800"><SlidersHorizontal size={17} className="text-blue-600" aria-hidden="true" /> Personaliza tu reporte</div>
    <div className="space-y-6 p-4 sm:p-5">
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle number="1" title="Selecciona los estados" description="Puedes incluir uno o varios estados actuales." />
          <div className="flex flex-wrap gap-1 text-xs font-medium">
            {[["Solo cotización", ["COTIZACION"]], ["Todos", Object.keys(ESTADOS_REPORTE)], ["Limpiar", []]].map(([label, value]) => <button key={label} type="button" className="rounded-lg px-2 py-1.5 text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50" onClick={() => cambiar("estados", value)}>{label}</button>)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(ESTADOS_REPORTE).map(([value, label]) => {
            const Icon = estadoIcons[value];
            const selected = f.estados.includes(value);
            return <label key={value} className={`relative flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-blue-500 ${selected ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
              <input className="sr-only" type="checkbox" checked={selected} onChange={e => cambiar("estados", e.target.checked ? [...f.estados, value] : f.estados.filter(v => v !== value))} />
              <Icon size={16} className="shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">{label}</span>
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>{selected && <Check size={12} aria-hidden="true" />}</span>
            </label>;
          })}
        </div>
      </section>
      <section className="space-y-3 border-t border-slate-100 pt-5">
        <SectionTitle number="2" title="Define el período" description="Elige cuánto historial quieres analizar." />
        <div role="radiogroup" aria-label="Período del reporte" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {periodos.map(({ value, label, icon: Icon }) => <label key={value} className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-medium focus-within:ring-2 focus-within:ring-blue-500 ${f.periodo === value ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            <input type="radio" name="reporte-periodo" className="sr-only" value={value} checked={f.periodo === value} onChange={() => cambiar("periodo", value)} /><Icon size={16} aria-hidden="true" />{label}
          </label>)}
        </div>
        {f.periodo !== "total" && <div className="grid min-w-0 grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
          {f.periodo === "mensual" && <label className="min-w-0 space-y-1.5 text-xs font-medium text-slate-600"><span>Mes del reporte</span><input className={input} type="month" value={f.mes} onChange={e => cambiar("mes", e.target.value)} /></label>}
          {f.periodo === "anual" && <label className="min-w-0 space-y-1.5 text-xs font-medium text-slate-600"><span>Año del reporte</span><input className={input} type="number" min="1000" max="9999" value={f.anio} onChange={e => cambiar("anio", e.target.value)} /></label>}
          {f.periodo === "rango" && <>
            <label className="min-w-0 space-y-1.5 text-xs font-medium text-slate-600"><span>Desde</span><input className={input} type="date" value={f.desde} onChange={e => cambiar("desde", e.target.value)} /></label>
            <label className="min-w-0 space-y-1.5 text-xs font-medium text-slate-600"><span>Hasta · incluido</span><input className={input} type="date" value={f.hasta} onChange={e => cambiar("hasta", e.target.value)} /></label>
          </>}
        </div>}
      </section>
      <section className="min-w-0 space-y-3 border-t border-slate-100 pt-5">
        <SectionTitle number="3" title="Filtra por cliente" description="Opcional. Busca por nombre o conserva todos los clientes." />
        <Autocomplete
          id="reporte-cliente" disablePortal fullWidth disabled={busy}
          options={options} value={options.find(o => o.id === f.cliente) || todos}
          getOptionLabel={o => o.nombre} isOptionEqualToValue={(a,b) => a.id === b.id}
          onChange={(_, value) => cambiar("cliente", value?.id || "")}
          noOptionsText="No se encontraron clientes" clearText="Todos los clientes" openText="Buscar cliente" closeText="Cerrar lista"
          sx={{ minWidth: 0, "& .MuiOutlinedInput-root": { borderRadius: "12px", backgroundColor: "white", fontSize: 14 }, "& .MuiAutocomplete-input": { minWidth: "0 !important" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#e2e8f0" } }}
          slotProps={{ listbox: { style: { maxHeight: 200, fontSize: 14 } }, popper: { sx: { "& .MuiAutocomplete-paper": { borderRadius: "12px", boxShadow: "0 12px 32px #0f172a20", border: "1px solid #e2e8f0" } } } }}
          renderOption={(props, option) => { const { key, ...rest } = props; return <li key={option.id} {...rest} style={{ ...rest.style, whiteSpace: "normal", overflowWrap: "anywhere", gap: 10 }}><Users size={16} className="shrink-0 text-slate-400" aria-hidden="true" /><span className="min-w-0">{option.nombre}</span></li>; }}
          renderInput={params => <TextField {...params} label="Cliente" placeholder="Escribe para buscar…" InputProps={{ ...params.InputProps, startAdornment: <><InputAdornment position="start"><Search size={18} aria-hidden="true" /></InputAdornment>{params.InputProps.startAdornment}</> }} />}
        />
      </section>
      <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500"><Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" /><p>Se usa la fecha del documento o, si falta, la fecha de creación en Chile. Montos en CLP con IVA. Estos filtros son independientes de la tabla principal.</p></div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!error && !cantidad && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">No hay cotizaciones para esta selección. Prueba otros estados o un período más amplio.</p>}
    </div>
  </fieldset>;
}
