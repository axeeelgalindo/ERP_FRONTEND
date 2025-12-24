"use client";

import { ChevronRight, Plus } from "lucide-react";

/**
 * PageHeader
 * Props:
 * - title: string
 * - subtitle?: string
 * - breadcrumbs?: Array<{ label:string, href?:string }>
 * - actions?: ReactNode  // botones a la derecha
 * - children?: ReactNode // barra de filtros u otros controles debajo
 */
export default function PageHeader({
  title,
  subtitle,
  breadcrumbs = [],
  actions,
  children,
}) {
  return (
    <header className="mb-4">
      {/* Top row: breadcrumbs + title + actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {breadcrumbs?.length > 0 && (
            <nav className="mb-1 text-xs text-gray-500">
              <ol className="flex items-center gap-1">
                {breadcrumbs.map((b, i) => {
                  const isLast = i === breadcrumbs.length - 1;
                  const El = b.href && !isLast ? "a" : "span";
                  return (
                    <li key={i} className="flex items-center gap-1">
                      <El
                        {...(b.href && !isLast ? { href: b.href } : {})}
                        className={!isLast ? "hover:underline" : "font-medium text-gray-700"}
                      >
                        {b.label}
                      </El>
                      {!isLast && <ChevronRight size={14} className="text-gray-400" />}
                    </li>
                  );
                })}
              </ol>
            </nav>
          )}

          <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">
            {title}
          </h1>
          {!!subtitle && (
            <p className="mt-0.5 text-sm text-gray-600">{subtitle}</p>
          )}
        </div>

        {/* right actions */}
        {actions ? (
          <div className="shrink-0">{actions}</div>
        ) : null}
      </div>

      {/* Bottom row: filters/toolbars */}
      {children ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 md:p-4 shadow-sm">
          {children}
        </div>
      ) : null}
    </header>
  );
}

/* Botón genérico por si quieres reutilizar */
export function PrimaryActionButton({ children, onClick, icon:Icon = Plus }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow 
      hover:bg-blue-700 hover:cursor-pointer 
      focus:outline-none 
      focus:ring-2 
      focus:ring-blue-400"
    >
      <Icon size={16} />
      {children}
    </button>
  );
}
