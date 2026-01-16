"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";

const Sidebar = dynamic(() => import("./Sidebar"), { ssr: false });

export default function SidebarPortalMount() {
  const { status } = useSession();
  const pathname = usePathname();
  const [slot, setSlot] = useState(null);

  const hidden = useMemo(() => {
    const deny = ["/login", "/register", "/auth/login", "/auth/register"];
    return deny.some((p) => pathname.startsWith(p));
  }, [pathname]);

  useEffect(() => {
    setSlot(document.getElementById("sidebar-slot"));
  }, []);

  // Activa/desactiva el padding del main
  useEffect(() => {
    const show = status === "authenticated" && !hidden;
    document.body.classList.toggle("has-sidebar", show);
    return () => document.body.classList.remove("has-sidebar");
  }, [status, hidden]);

  if (status !== "authenticated" || hidden || !slot) return null;
  return createPortal(<Sidebar />, slot);
}
