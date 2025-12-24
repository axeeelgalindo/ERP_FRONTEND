// src/components/layout/SidebarWrapper.jsx
"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Sidebar = dynamic(() => import("./Sidebar"), { ssr: false });

export default function SidebarWrapper() {
  const pathname = usePathname();
  const [noSidebarFlag, setNoSidebarFlag] = useState(false);

  // si not-found añadió .no-sidebar al body, no montamos nada
  useEffect(() => {
    setNoSidebarFlag(document.body.classList.contains("no-sidebar"));
  }, [pathname]);

  // rutas donde nunca debe aparecer
  const hiddenRoutes = ["/login", "/register", "/auth/login", "/auth/register"];

  if (noSidebarFlag) return null;                         // 👈 PRIORIDAD
  if (hiddenRoutes.some(p => pathname.startsWith(p))) return null;

  return <Sidebar />;
}
