"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import NavItem from "./NavItem";
import { Menu, X } from "lucide-react";

/**
 * Sidebar responsive + premium "Blue Ingeniería" redesign
 */
export default function Sidebar() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Detecta breakpoint lg
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Estado inicial según viewport
  useEffect(() => {
    setOpen(isDesktop); // desktop: abierto por defecto; mobile: cerrado
  }, [isDesktop]);

  // Actualiza variables CSS para empujar el contenido
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--app-sb",
      isDesktop ? (open ? "16rem" : "5rem") : "0px"
    );
    root.style.setProperty("--app-topbar", isDesktop ? "0px" : "3.25rem");
  }, [open, isDesktop]);

  const rol = (session?.user?.rolCodigo || session?.user?.role || "")
    .toString()
    .toLowerCase();

  // Catálogo estructurado por categorías con control de acceso
  const navGroups = useMemo(() => {
    const groups = [
      // ── Inicio (sin grupo) ─────────────────────────────────────────────
      {
        type: "item",
        href: "/",
        label: "Inicio",
        icon: "dashboard",
        roles: ["superadmin", "admin", "user", "empleado", "cliente"],
      },

      // ── Gestión comercial ──────────────────────────────────────────────
      {
        type: "group",
        label: "Comercial",
        icon: "storefront",
        roles: ["superadmin", "admin", "user", "empleado"],
        children: [
          { href: "/costeos", label: "Costeos", icon: "calculate", roles: ["superadmin", "admin", "user", "empleado"] },
          { href: "/cotizaciones", label: "Cotizaciones", icon: "request_quote", roles: ["superadmin", "admin", "user", "empleado"] },
          { href: "/clientes", label: "Clientes", icon: "group", roles: ["superadmin", "admin", "user", "empleado"] },
          { href: "/proveedores", label: "Proveedores", icon: "conveyor_belt", roles: ["superadmin", "admin", "user", "empleado"] },
        ],
      },

      // ── Ejecución de proyectos ─────────────────────────────────────────
      {
        type: "group",
        label: "Operaciones",
        icon: "construction",
        roles: ["superadmin", "admin", "user", "empleado"],
        children: [
          { href: "/proyectos", label: "Proyectos", icon: "account_tree", roles: ["superadmin", "admin"] },
          { href: "/kanban", label: "Kanban", icon: "view_kanban", roles: ["superadmin", "admin", "user", "empleado"] },
          { href: "/hh", label: "HH", icon: "timer", roles: ["superadmin", "admin"] },
        ],
      },

      // ── Control financiero ─────────────────────────────────────────────
      {
        type: "group",
        label: "Finanzas",
        icon: "payments",
        roles: ["superadmin", "admin", "user", "empleado"],
        children: [
          { href: "/compras", label: "Compras", icon: "shopping_cart", roles: ["superadmin", "admin"] },
          { href: "/rendiciones", label: "Rendiciones", icon: "receipt_long", roles: ["superadmin", "admin", "empleado"] },
        ],
      },

      // ── Recursos humanos ───────────────────────────────────────────────
      {
        type: "group",
        label: "RRHH",
        icon: "groups",
        roles: ["superadmin", "admin"],
        children: [
          { href: "/empleados", label: "Empleados", icon: "badge", roles: ["superadmin", "admin"] },
          { href: "/asistencia", label: "Registro diario", icon: "event_available", roles: ["superadmin", "admin"] },
          { href: "/asistencia/mensual", label: "Vista mensual", icon: "calendar_month", roles: ["superadmin", "admin"] },
        ],
      },

      // ── Administración del sistema ─────────────────────────────────────
      {
        type: "group",
        label: "Administración",
        icon: "admin_panel_settings",
        roles: ["superadmin"],
        children: [
          { href: "/empresas", label: "Empresas", icon: "domain", roles: ["superadmin"] },
          { href: "/usuarios", label: "Usuarios", icon: "manage_accounts", roles: ["superadmin"] },
          { href: "/admin/folio-cotizaciones", label: "Folio Cotizaciones", icon: "description", roles: ["superadmin"] },
        ],
      },
    ];

    // Filtra grupos e ítems hijos según rol
    return groups
      .filter((g) => g.roles.includes(rol) || rol === "superadmin")
      .map((g) => {
        if (g.type === "group") {
          const filteredChildren = (g.children || []).filter(
            (c) => c.roles.includes(rol) || rol === "superadmin"
          );
          return { ...g, children: filteredChildren };
        }
        return g;
      })
      .filter((g) => g.type === "item" || (g.children && g.children.length > 0));
  }, [rol]);

  function closeOnMobile() {
    if (!isDesktop) setOpen(false);
  }

  function handleLogout() {
    signOut({ callbackUrl: "/login" });
  }

  return (
    <>
      {/* Topbar móvil con hamburguesa */}
      {!isDesktop && (
        <div className="fixed top-0 inset-x-0 z-40 h-13 bg-white/90 backdrop-blur border-b border-gray-200 px-3 flex items-center justify-between ">
          <button
            onClick={() => setOpen((o) => !o)}
            className="p-2 rounded-lg border bg-white shadow-sm text-gray-700 hover:bg-gray-100 "
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="text-sm font-semibold">ERP Blueinge</div>
          <div className="w-9 " />
        </div>
      )}

      {/* Overlay difuminado (solo mobile cuando está abierto) */}
      {!isDesktop && open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          "fixed z-40 bg-slate-50 border-r border-outline-variant/10 shadow-lg transition-all duration-300 ease-in-out flex flex-col",
          isDesktop
            ? "top-0 left-0 h-screen py-6 px-4 " + (open ? "w-64" : "w-20")
            : "top-12 left-0 w-full max-h-[70vh] overflow-auto px-4 py-6",
          !isDesktop && !open
            ? "opacity-0 pointer-events-none -translate-y-2"
            : "opacity-100 translate-y-0",
        ].join(" ")}
        aria-label="Barra lateral de navegación"
      >
        {/* Header / Brand */}
        <div className={`flex items-center gap-3 mb-6 ${open ? "px-2" : "justify-center"}`}>
          <div className="w-10 h-10 shrink-0 rounded-lg bg-primary flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>architecture</span>
          </div>
          {open && (
            <div>
              <h1 className="text-lg font-bold tracking-tighter text-blue-900 leading-none">Blue Ingeniería</h1>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 flex flex-col gap-1 pr-1 ${open ? "overflow-y-auto" : "overflow-visible"}`}>
          {navGroups.map((item) => (
            <NavItem
              key={item.href || item.label}
              href={item.href}
              label={item.label}
              icon={item.icon}
              open={open}
              onNavigate={closeOnMobile}
              children={item.type === "group" ? item.children : undefined}
            />
          ))}
        </nav>

        {/* Footer actions */}
        <div className={`pt-4 mt-4 border-t border-slate-200 ${!open && isDesktop ? "flex justify-center" : ""}`}>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:text-error hover:bg-error-container/20 transition-all duration-200"
          >
            <span className="material-symbols-outlined">logout</span>
            {open && <span className="text-sm font-medium">Logout</span>}
          </button>

          {/* Perfil / empresa actual */}
          {open && session?.user?.empresaNombre && (
            <div className="mt-3 px-3 text-[10px] uppercase tracking-widest text-gray-400 font-bold">
              {session.user.empresaNombre}
            </div>
          )}
        </div>

        {/* Toggle Collapse (Desktop only) */}
        {isDesktop && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="absolute -right-5 top-7 w-10 h-10 bg-white border border-outline-variant/30 rounded-full shadow-lg flex items-center justify-center text-slate-500 hover:text-primary hover:scale-110 active:scale-95 transition-all duration-200 z-50 cursor-pointer group"
            aria-label={open ? "Colapsar" : "Expandir"}
          >
            <div className={`transition-transform duration-300 ${open ? "" : "rotate-180"}`}>
              <span className="material-symbols-outlined text-[24px] font-bold">
                chevron_left
              </span>
            </div>
          </button>
        )}
      </aside>
    </>
  );
}
