"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import NavItem from "./NavItem";
import { Menu, X } from "lucide-react";

/**
 * Sidebar responsive + premium "Blue Ingeniería" redesign
 */
export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const userMenuRef = useRef(null);

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

  // Si se abre el sidebar, cerrar el popover de usuario
  useEffect(() => {
    if (open) setShowUserMenu(false);
  }, [open]);

  // Cerrar menú flotante de usuario al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showUserMenu]);

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

  const userName =
    session?.user?.name ||
    session?.user?.nombre ||
    (session?.user?.email ? session.user.email.split("@")[0] : "Usuario");
  const userEmail = session?.user?.email || "";
  const userRole =
    session?.user?.rolNombre ||
    (session?.user?.rolCodigo ? String(session?.user?.rolCodigo).toUpperCase() : "");
  const empresaNombre = session?.user?.empresaNombre || "";

  const initials = useMemo(() => {
    if (!userName) return "U";
    const parts = userName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return userName.slice(0, 2).toUpperCase();
  }, [userName]);

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
          { href: "/servicios-arriendos", label: "Servicios", icon: "build", roles: ["superadmin", "admin", "user", "empleado"] },
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
          { href: "/reportes/tareas-completadas", label: "Reporte de tareas", icon: "assignment_turned_in", roles: ["superadmin", "admin", "user", "empleado"] },
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
        icon: "badge",
        roles: ["superadmin", "admin", "empleado"],
        children: [
          { href: "/empleados", label: "Empleados", icon: "engineering", roles: ["superadmin", "admin"] },
          { href: "/asistencia", label: "Asistencia diaria", icon: "how_to_reg", roles: ["superadmin", "admin"] },
          { href: "/asistencia/mensual", label: "Asistencia mensual", icon: "calendar_month", roles: ["superadmin", "admin"] },
        ],
      },

      // ── Administración del sistema ─────────────────────────────────────
      {
        type: "group",
        label: "Sistema",
        icon: "settings",
        roles: ["superadmin", "admin"],
        children: [
          { href: "/usuarios", label: "Usuarios", icon: "manage_accounts", roles: ["superadmin", "admin"] },
          { href: "/empresas", label: "Empresas", icon: "domain", roles: ["superadmin"] },
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

  // Sincronizar grupo activo según la ruta actual (solo 1 abierto a la vez)
  useEffect(() => {
    const matched = navGroups.find(
      (g) =>
        g.type === "group" &&
        g.children?.some(
          (c) => pathname === c.href || pathname.startsWith(c.href + "/")
        )
    );
    if (matched) {
      setActiveGroup(matched.label);
    }
  }, [pathname, navGroups]);

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
        <div className="fixed top-0 inset-x-0 z-40 h-13 bg-white/95 backdrop-blur border-b border-gray-200 px-3 flex items-center justify-between">
          <button
            onClick={() => setOpen((o) => !o)}
            className="p-2 rounded-lg border bg-white shadow-sm text-gray-700 hover:bg-gray-100"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link href="/" className="flex items-center gap-2" onClick={closeOnMobile} aria-label="Inicio ERP Blue Ingeniería">
            <Image
              src="/Logo_blue.webp"
              alt="Logo Blue Ingeniería"
              width={120}
              height={32}
              className="h-7 w-auto object-contain"
              priority
            />
          </Link>
          <div className="w-9 h-9 flex items-center justify-center">
            <div
              className="w-7 h-7 rounded-full bg-linear-to-tr from-blue-700 to-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shadow-xs"
              title={`${userName} (${userRole || userEmail})`}
            >
              {initials}
            </div>
          </div>
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
        <Link
          href="/"
          className={`flex items-center gap-3 mb-6 transition-all duration-200 hover:opacity-90 ${open ? "px-2" : "justify-center"
            }`}
          aria-label="Ir al inicio de Blue Ingeniería"
        >
          {open ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <Image
                src="/Logo_blue.webp"
                alt="Logo Blue Ingeniería"
                width={140}
                height={36}
                className="h-9 w-auto object-contain"
                priority
              />
            </div>
          ) : (
            <div className="w-10 h-10 shrink-0 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center p-1.5 hover:border-blue-300 transition-colors">
              <Image
                src="/favicon-32x32.png"
                alt="Logo Blue Ingeniería"
                width={26}
                height={26}
                className="object-contain"
                priority
              />
            </div>
          )}
        </Link>

        {/* Navigation */}
        <nav className={`flex-1 flex flex-col gap-1 pr-1 ${open ? "overflow-y-auto" : "overflow-visible"}`}>
          {navGroups.map((item) => (
            <NavItem
              key={item.href || item.label}
              href={item.href}
              label={item.label}
              icon={item.icon}
              open={open}
              isExpanded={activeGroup === item.label}
              onToggle={() =>
                setActiveGroup((prev) => (prev === item.label ? null : item.label))
              }
              onNavigate={closeOnMobile}
              children={item.type === "group" ? item.children : undefined}
            />
          ))}
        </nav>

        {/* Footer actions & User Profile */}
        <div className={`pt-3 mt-auto border-t border-slate-200 flex flex-col gap-2 ${!open && isDesktop ? "items-center" : ""}`}>
          {/* User Profile Card */}
          {open ? (
            <div className="px-2.5 py-2 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 shrink-0 rounded-full bg-linear-to-tr from-blue-700 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate" title={userName}>
                    {userName}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate" title={userRole || userEmail}>
                    {userRole || userEmail}
                  </p>
                </div>
              </div>

              {/* Botón Logout a la derecha dentro de la tarjeta */}
              <button
                onClick={handleLogout}
                className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <span className="material-symbols-outlined text-[18px] block">logout</span>
              </button>
            </div>
          ) : (
            <div className="relative flex justify-center" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setShowUserMenu((v) => !v)}
                className="w-9 h-9 rounded-full bg-linear-to-tr from-blue-700 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs hover:ring-2 hover:ring-blue-400/60 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title={`${userName} (${userRole || userEmail}) - Clic para menú`}
                aria-label="Menú de usuario"
                aria-expanded={showUserMenu}
              >
                {initials}
              </button>

              {/* Menú flotante al hacer clic en el avatar con sidebar cerrado */}
              {showUserMenu && (
                <div className="absolute left-12 bottom-0 z-50 w-56 p-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xl animate-in fade-in slide-in-from-left-2 duration-150 flex flex-col gap-2">
                  <div className="px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
                    <div className="w-8 h-8 shrink-0 rounded-full bg-linear-to-tr from-blue-700 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate" title={userName}>
                        {userName}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate" title={userRole || userEmail}>
                        {userRole || userEmail}
                      </p>
                    </div>
                  </div>

                  {empresaNombre && (
                    <div className="px-2 text-[9px] uppercase tracking-wider text-slate-400 font-bold truncate">
                      {empresaNombre}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:text-red-600 hover:bg-red-50 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Perfil / empresa actual */}
          {open && empresaNombre && (
            <div className="px-2 text-[9px] uppercase tracking-wider text-slate-400 font-bold truncate">
              {empresaNombre}
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
