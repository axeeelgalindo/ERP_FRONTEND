"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";

export default function NavItem({ href, label, icon, open, onNavigate, children }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);   // accordion (sidebar abierto)
  const [flyoutOpen, setFlyoutOpen] = useState(false); // flyout (sidebar cerrado)
  const containerRef = useRef(null);

  // Check if any child route is currently active
  const isChildActive = children?.some(
    (child) => pathname === child.href || pathname.startsWith(child.href + "/")
  );

  const isActive = href
    ? (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"))
    : isChildActive;

  // Auto-expand accordion if child path is active
  useEffect(() => {
    if (isChildActive) setExpanded(true);
  }, [isChildActive]);

  // Close flyout when clicking outside
  useEffect(() => {
    if (!flyoutOpen) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setFlyoutOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [flyoutOpen]);

  // Close flyout when sidebar opens
  useEffect(() => {
    if (open) setFlyoutOpen(false);
  }, [open]);

  // ─── COLLAPSED MODE ────────────────────────────────────────────────────────
  if (!open) {
    const handleCollapsedClick = (e) => {
      if (children) {
        e.preventDefault();
        setFlyoutOpen((prev) => !prev);
      } else if (onNavigate) {
        onNavigate();
      }
    };

    return (
      <li
        className="list-none relative"
        ref={containerRef}
        onMouseEnter={() => children && setFlyoutOpen(true)}
        onMouseLeave={() => children && setFlyoutOpen(false)}
      >
        {/* Tooltip wrapper */}
        <div className="group relative">
          {/* Icon button */}
          {href && !children ? (
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={[
                "flex items-center justify-center w-11 h-11 mx-auto rounded-lg transition-all duration-200 cursor-pointer",
                isActive
                  ? "text-blue-700 bg-blue-100/70"
                  : "text-slate-500 hover:text-blue-600 hover:bg-slate-200/50",
              ].join(" ")}
            >
              <span
                className="material-symbols-outlined shrink-0"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0", fontSize: "24px" }}
              >
                {icon}
              </span>
            </Link>
          ) : (
            <button
              onClick={handleCollapsedClick}
              className={[
                "flex items-center justify-center w-11 h-11 mx-auto rounded-lg transition-all duration-200 cursor-pointer border-0 bg-transparent w-full",
                isActive || flyoutOpen
                  ? "text-blue-700 bg-blue-100/70"
                  : "text-slate-500 hover:text-blue-600 hover:bg-slate-200/50",
              ].join(" ")}
            >
              <span
                className="material-symbols-outlined shrink-0"
                style={{ fontVariationSettings: (isActive || flyoutOpen) ? "'FILL' 1" : "'FILL' 0", fontSize: "24px" }}
              >
                {icon}
              </span>
            </button>
          )}

          {/* Tooltip: group/item name on hover (only when flyout is closed) */}
          {!flyoutOpen && (
            <div className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-[210] opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
              <div className="bg-slate-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-lg">
                {label}
              </div>
              <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45" />
            </div>
          )}
        </div>

        {/* Flyout panel (hover/click-based, with gap bridged by padding) */}
        {flyoutOpen && children && (
          <div className="absolute left-full top-0 pl-2 z-[200]">
            <div className="min-w-[200px] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-visible">
              {/* Group header */}
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 rounded-t-xl">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  {label}
                </span>
              </div>

              {/* Children with icons + individual tooltips */}
              <ul className="py-1.5 list-none flex flex-col gap-0.5">
                {children.map((child) => {
                  const childActive =
                    pathname === child.href || pathname.startsWith(child.href + "/");
                  return (
                    <li key={child.href} className="group/child relative px-1.5">
                      <Link
                        href={child.href}
                        onClick={() => { setFlyoutOpen(false); onNavigate?.(); }}
                        className={[
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
                          childActive
                            ? "text-blue-700 bg-blue-50 font-semibold"
                            : "text-slate-600 hover:text-blue-600 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {child.icon && (
                          <span
                            className="material-symbols-outlined shrink-0 text-[20px]"
                            style={{ fontVariationSettings: childActive ? "'FILL' 1" : "'FILL' 0" }}
                          >
                            {child.icon}
                          </span>
                        )}
                        <span className="truncate">{child.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </li>
    );
  }

  // ─── EXPANDED MODE: full label + accordion ────────────────────────────────
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
        >
          {icon && (
            <span
              className="material-symbols-outlined shrink-0"
              style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0", fontSize: "24px" }}
            >
              {icon}
            </span>
          )}
          <span className="text-sm font-medium truncate">{label}</span>
        </Link>
      ) : (
        <div>
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className={[
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer border-0 bg-transparent text-left",
              isActive
                ? "text-blue-700 font-semibold bg-slate-200/50"
                : "text-slate-600 hover:text-blue-600 hover:bg-slate-200/50",
            ].join(" ")}
          >
            {icon && (
              <span
                className="material-symbols-outlined shrink-0"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0", fontSize: "24px" }}
              >
                {icon}
              </span>
            )}
            <span className="text-sm font-medium flex-1 truncate">{label}</span>
            <span className={`material-symbols-outlined text-[18px] shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
              expand_more
            </span>
          </button>

          {/* Children submenu accordion */}
          {expanded && children && (
            <ul className="mt-1 ml-4 pl-4 border-l border-slate-200 flex flex-col gap-0.5 list-none animate-fade-in">
              {children.map((child) => {
                const childActive =
                  pathname === child.href || pathname.startsWith(child.href + "/");
                return (
                  <li key={child.href} className="list-none">
                    <Link
                      href={child.href}
                      onClick={onNavigate}
                      className={[
                        "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer",
                        childActive
                          ? "text-blue-700 bg-blue-50/50 font-bold"
                          : "text-slate-500 hover:text-blue-600 hover:bg-slate-100",
                      ].join(" ")}
                    >
                      {child.icon && (
                        <span
                          className="material-symbols-outlined shrink-0 text-[17px]"
                          style={{ fontVariationSettings: childActive ? "'FILL' 1" : "'FILL' 0" }}
                        >
                          {child.icon}
                        </span>
                      )}
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
