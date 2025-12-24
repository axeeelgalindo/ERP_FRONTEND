"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavItem({ href, label, Icon, open, onNavigate }) {
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
          "group flex items-center gap-3 px-3 py-2 rounded-lg transition",
          isActive
            ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
            : "text-gray-700 hover:bg-gray-100",
        ].join(" ")}
        title={!open ? label : undefined}
      >
        {Icon ? (
          <Icon
            size={20}
            className={
              isActive
                ? "text-blue-700"
                : "text-gray-600 group-hover:text-gray-800"
            }
          />
        ) : null}
        {open && <span className="text-sm font-medium truncate">{label}</span>}
      </Link>
    </li>
  );
}
