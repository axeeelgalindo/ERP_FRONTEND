// src/components/clientes/ClientesTable.jsx
"use client";

import { initials, logoSrc } from "./utils";
import ClientesPagination from "./ClientesPagination";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccountBalance, Person, Edit, Delete, MoreVert, ChevronLeft, ChevronRight, More } from "@mui/icons-material";


function BankTooltip({ cuenta }) {
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const has = !!cuenta?.banco && !!cuenta?.numero;

  const copyText = useMemo(() => {
    if (!has) return "";
    return `${cuenta.banco}, ${cuenta.tipo_cuenta || ""}, ${cuenta.numero}, ${cuenta.titular || ""}`.trim();
  }, [has, cuenta]);

  const copy = async () => {
    if (!has) return;
    try {
      await navigator.clipboard.writeText(copyText);
    } catch {}
  };

  const updatePos = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // tooltip arriba del botón
    setPos({
      top: r.top + window.scrollY - 10,
      left: r.left + window.scrollX + r.width / 2,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    const onResize = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
      <div className="inline-block">
        <button
          ref={btnRef}
          className="p-2 text-blue-600 hover:bg-blue-600/10 rounded-full transition-colors"
          type="button"
          onClick={copy}
          onMouseEnter={() => has && setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => has && setOpen(true)}
          onBlur={() => setOpen(false)}
          title={has ? "Copiar cuenta principal" : "Sin cuenta principal"}
        >
          <AccountBalance fontSize="small" />
        </button>
      </div>

      {open && has
        ? createPortal(
            <div
              style={{
                position: "absolute",
                top: pos.top,
                left: pos.left,
                transform: "translate(-50%, -100%)",
                zIndex: 99999,
              }}
            >
              <div className="w-56 p-4 bg-slate-900 text-white rounded-lg shadow-xl pointer-events-none">
                <p className="text-[10px] uppercase text-slate-400 font-bold mb-2">
                  Cuenta Principal
                </p>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-slate-400">Banco:</span> {cuenta.banco}
                  </p>
                  <p>
                    <span className="text-slate-400">Tipo:</span>{" "}
                    {cuenta.tipo_cuenta || "—"}
                  </p>
                  <p>
                    <span className="text-slate-400">Nº:</span> {cuenta.numero}
                  </p>
                  <p className="truncate">
                    <span className="text-slate-400">Titular:</span>{" "}
                    {cuenta.titular || "—"}
                  </p>
                </div>
                <p className="mt-2 text-[10px] text-blue-400 italic">
                  Haz clic para copiar
                </p>
                <div className="absolute w-2 h-2 bg-slate-900 rotate-45 left-1/2 -translate-x-1/2 -bottom-1" />
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export default function ClientesTable({
  rows,
  loading,
  error,
  page,
  pageSize,
  total,
  onPageChange,
  onEdit,
  onDelete,
}) {
  if (loading)
    return <div className="p-6 text-sm text-slate-500">Cargando…</div>;
  if (error)
    return <div className="p-6 text-sm text-red-500">Error: {error}</div>;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));

  return (
    <div className="bg-white  rounded-xl border border-slate-200  shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50  border-b border-slate-200 ">
              <th className="px-6 py-4 text-xs font-bold text-slate-500  uppercase tracking-wider">
                Cliente
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500  uppercase tracking-wider">
                RUT
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500  uppercase tracking-wider">
                Contacto
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500  uppercase tracking-wider text-center">
                Banco
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500  uppercase tracking-wider">
                Responsables
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500  uppercase tracking-wider text-right">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 ">
            {!rows?.length ? (
              <tr>
                <td className="px-6 py-6 text-sm text-slate-500" colSpan={6}>
                  Sin resultados.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const cuenta = row?.cuenta_principal || row?.cuentaPrincipal || null; // por si tu API usa otro nombre
                const responsablesCount =
                  row?.responsables_count ??
                  row?.responsablesCount ??
                  row?.responsables?.length ??
                  0;

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50  transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {row.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={`Logo ${row.nombre}`}
                            className="w-10 h-10 rounded-full border border-slate-200 object-cover bg-white"
                            src={logoSrc(row.logo_url)}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-100  text-blue-600 flex items-center justify-center font-bold text-sm">
                            {initials(row.nombre)}
                          </div>
                        )}
                        <span className="font-semibold text-slate-900 ">
                          {row.nombre}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-slate-600  text-sm">
                      {row.rut || "—"}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col text-sm">
                        <span className="text-slate-900 ">
                          {row.correo || "—"}
                        </span>
                        <span className="text-slate-500  font-medium">
                          {row.telefono || "—"}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <BankTooltip cuenta={cuenta} />
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100  text-slate-700 ">
                        <Person fontSize="small" />
                        {responsablesCount}{" "}
                        {responsablesCount === 1
                          ? "Responsable"
                          : "Responsables"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        type="button"
                        onClick={() => onEdit(row)}
                        title="Editar"
                      >
                        <Edit fontSize="small" />
                      </button>
                      <button
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        type="button"
                        onClick={() => onDelete(row)}
                        title="Eliminar"
                      >
                        <Delete fontSize="small" />
                      </button>
                      <button
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        type="button"
                        title="Más"
                        onClick={() => {}}
                      >
                        <MoreVert fontSize="small" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-50  px-6 py-4 border-t border-slate-200  flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-slate-500  ">
          Mostrando{" "}
          <span className="font-semibold text-slate-900 ">
            {from}
          </span>{" "}
          a{" "}
          <span className="font-semibold text-slate-900 ">
            {to}
          </span>{" "}
          de{" "}
          <span className="font-semibold text-slate-900 ">
            {total}
          </span>{" "}
          resultados
        </p>

        <ClientesPagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
