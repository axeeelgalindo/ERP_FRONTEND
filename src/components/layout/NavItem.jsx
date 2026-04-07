"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavItem({ href, label, icon, open, onNavigate }) {
  const pathname = usePathname();
  const isActive =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={isActive ? "page" : undefined}
        className={[
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
          isActive
            ? "text-blue-700 border-r-4 border-blue-700 font-semibold bg-slate-200/50"
            : "text-slate-600 hover:text-blue-600 hover:bg-slate-200/50",
        ].join(" ")}
        title={!open ? label : undefined}
      >
        {icon ? (
          <span
            className="material-symbols-outlined shrink-0"
            style={{
               fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
               fontSize: '24px'
            }}
          >
            {icon}
          </span>
        ) : null}
        {open && <span className="text-sm font-medium truncate">{label}</span>}
      </Link>
    </li>
  );
}
