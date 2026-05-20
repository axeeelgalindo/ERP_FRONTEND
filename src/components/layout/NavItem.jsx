"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function NavItem({ href, label, icon, open, onNavigate, children }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  // Check if any child route is currently active
  const isChildActive = children?.some(
    (child) => pathname === child.href || pathname.startsWith(child.href + "/")
  );

  const isActive = href
    ? (href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/"))
    : isChildActive;

  // Auto-expand accordion if child path is active
  useEffect(() => {
    if (isChildActive) {
      setExpanded(true);
    }
  }, [isChildActive]);

  const handleParentClick = (e) => {
    if (children) {
      e.preventDefault();
      setExpanded(!expanded);
    } else if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <li className="list-none">
      {href ? (
        <Link
          href={href}
          onClick={onNavigate}
          aria-current={isActive ? "page" : undefined}
          className={[
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer",
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
      ) : (
        <div>
          <button
            onClick={handleParentClick}
            className={[
              "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer border-0 bg-transparent text-left",
              isActive
                ? "text-blue-700 font-semibold bg-slate-200/50"
                : "text-slate-600 hover:text-blue-600 hover:bg-slate-200/50",
            ].join(" ")}
            title={!open ? label : undefined}
          >
            <div className="flex items-center gap-3">
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
            </div>
            {open && (
              <span className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
                expand_more
              </span>
            )}
          </button>

          {/* Children submenu list */}
          {open && expanded && children && (
            <ul className="mt-1 ml-4 pl-4 border-l border-slate-200 flex flex-col gap-1 list-none animate-fade-in">
              {children.map((child) => {
                const isChildActive = pathname === child.href || pathname.startsWith(child.href + "/");
                return (
                  <li key={child.href} className="list-none">
                    <Link
                      href={child.href}
                      onClick={onNavigate}
                      className={[
                        "block px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer",
                        isChildActive
                          ? "text-blue-700 bg-blue-50/50 font-bold"
                          : "text-slate-500 hover:text-blue-600 hover:bg-slate-100",
                      ].join(" ")}
                    >
                      {child.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
