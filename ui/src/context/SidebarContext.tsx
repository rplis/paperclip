import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from "react";

interface SidebarContextValue {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  isMobile: boolean;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

const MOBILE_BREAKPOINT = 768;
const SIDEBAR_WIDTH_STORAGE_KEY = "paperclip.sidebarWidth";
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 400;
export const SIDEBAR_DEFAULT_WIDTH = 240;

function readStoredWidth(): number {
  if (typeof window === "undefined") return SIDEBAR_DEFAULT_WIDTH;
  try {
    const raw = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (!raw) return SIDEBAR_DEFAULT_WIDTH;
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return SIDEBAR_DEFAULT_WIDTH;
    return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, parsed));
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= MOBILE_BREAKPOINT);
  const [sidebarWidth, setSidebarWidthState] = useState<number>(() => readStoredWidth());

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      setSidebarOpen(!e.matches);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  const setSidebarWidth = useCallback((width: number) => {
    const clamped = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
    setSidebarWidthState(clamped);
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clamped));
    } catch {
      // ignore storage failures
    }
  }, []);

  return (
    <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen, toggleSidebar, isMobile, sidebarWidth, setSidebarWidth }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return ctx;
}
