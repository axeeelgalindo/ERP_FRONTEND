// src/components/layout/HideSidebar.jsx
"use client";
import { useEffect } from "react";

export default function HideSidebar() {
  useEffect(() => {
    const b = document.body;
    b.classList.add("no-sidebar");
    b.classList.remove("has-sidebar"); // por si venía de una ruta con sidebar
    return () => b.classList.remove("no-sidebar");
  }, []);
  return null;
}
