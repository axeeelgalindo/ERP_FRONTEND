"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import NavItem from "./NavItem";
import {
  Menu,
  X,
  LogOut,
  Building2,
  Users,
  FolderKanban,
  ShoppingCart,
  FileSpreadsheet,
  FileText,
  Home,
  IdCardIcon,
  CircleDollarSignIcon
  
} from "lucide-react";

/**
 * Sidebar responsive + role-based
 * - Desktop (≥1024px): fijo a la izquierda, se colapsa/expande (w-20 ↔ w-64).
 * - Mobile: botón hamburguesa arriba; se despliega hacia abajo con overlay difuminado.
 * - Ajuste del contenedor principal: define --app-sb (padding-left) y --app-topbar (padding-top en mobile).
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

  // Catálogo de items con control de acceso por rol
  const navItems = useMemo(() => {
    const all = [
      {
        href: "/",
        label: "Inicio",
        Icon: Home,
        roles: ["superadmin", "admin", "user"],
      },
      {
        href: "/clientes",
        label: "Clientes",
        Icon: Users,
        roles: ["superadmin", "admin", "user", "empleado" ],
      },
      {
        href: "/proveedores",
        label: "Proveedores",
        Icon: Building2,
        roles: ["superadmin", "admin"],
      },
      {
        href: "/productos",
        label: "Productos",
        Icon: ShoppingCart,
        roles: ["superadmin", "admin"],
      },
      {
        href: "/proyectos",
        label: "Proyectos",
        Icon: FolderKanban,
        roles: ["superadmin", "admin"],
      },
      {
        href: "/empleados",
        label: "Empleados",
        Icon: IdCardIcon,
        roles: ["superadmin", "admin"],
      },
      {
        href: "/hh",
        label: "HH",
        Icon: CircleDollarSignIcon,
        roles: ["superadmin", "admin"],
      },
      {
        href: "/costeos",
        label: "Costeos",
        Icon: FileText,
        roles: ["superadmin", "admin", "user", "empleado"],
      },
      {
        href: "/compras",
        label: "Compras",
        Icon: FileSpreadsheet,
        roles: ["superadmin", "admin"],
      },
      {
        href: "/cotizaciones",
        label: "Cotizaciones",
        Icon: FileText,
        roles: ["superadmin", "admin", "user", "empleado"],
      },
      {
        href: "/empresas",
        label: "Empresas",
        Icon: Building2,
        roles: ["superadmin"],
      }, // solo superadmin crea/gestiona empresas
      {
        href: "/usuarios",
        label: "Usuarios",
        Icon: Users,
        roles: ["superadmin"],
      },
      , // solo superadmin crea/gestiona empresas
      {
        href: "/admin/folio-cotizaciones",
        label: "Folio Cotizaciones",
        Icon: FileText,
        roles: ["superadmin"],
      },
    ];
    if (rol === "superadmin") return all;
    if (rol === "admin") return all.filter((i) => i.roles.includes("admin"));
    if (rol === "empleado")
      return all.filter((i) => i.roles.includes("empleado"));
    if (rol === "cliente")
      return all.filter((i) => i.roles.includes("cliente"));
    // por defecto, deja lo básico
    return all.filter(
      (i) =>
        ["superadmin", "admin", "empleado", "cliente"].includes("empleado") &&
        i.roles.includes("empleado")
    );
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
          <div className="w-9 "/>
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
          "fixed z-40 bg-white border-r border-gray-200 shadow-lg transition-all duration-300 ease-in-out",
          isDesktop
            ? "top-0 left-0 h-screen " + (open ? "w-64" : "w-20")
            : "top-12 left-0 w-full max-h-[70vh] overflow-auto",
          !isDesktop && !open
            ? "opacity-0 pointer-events-none -translate-y-2"
            : "opacity-100 translate-y-0",
        ].join(" ")}
        aria-label="Barra lateral de navegación"
      >
        {/* Header dentro del sidebar (solo desktop) */}
        {isDesktop && (
          <div className="p-4 flex items-center justify-between border-b border-gray-100">
            <span className="text-base font-semibold truncate">
              ERP Blueinge
            </span>
            <button
              onClick={() => setOpen((o) => !o)}
              className="p-1 rounded hover:bg-gray-100 transition"
              aria-label={open ? "Colapsar" : "Expandir"}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        )}

        {/* Navegación */}
        <nav className="p-3">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                Icon={item.Icon}
                open={open}
                onNavigate={closeOnMobile}
              />
            ))}
          </ul>
        </nav>

        {/* Footer acciones */}
        <div className="mt-auto p-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-red-600 hover:bg-red-50"
          >
            <LogOut size={18} />
            {open && <span className="text-sm font-medium">Cerrar sesión</span>}
          </button>

          {/* Perfil / empresa actual (opcional) */}
          {open && session?.user?.empresaNombre && (
            <div className="mt-3 text-xs text-gray-500">
              Empresa:{" "}
              <span className="font-medium text-gray-700">
                {session.user.empresaNombre}
              </span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
