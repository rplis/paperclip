import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import type { Company } from "@paperclipai/shared";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { heartbeatsApi } from "../api/heartbeats";
import { sidebarBadgesApi } from "../api/sidebarBadges";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { CompanyPatternIcon } from "./CompanyPatternIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** localStorage key kept in sync with CompanyRail (legacy) so users'
 *  previously-saved order carries over when switching to the dropdown. */
const ORDER_STORAGE_KEY = "paperclip.companyOrder";

function getStoredOrder(): string[] {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function applyStoredOrder(companies: Company[]): Company[] {
  const order = getStoredOrder();
  if (order.length === 0) return companies;
  const byId = new Map(companies.map((c) => [c.id, c]));
  const sorted: Company[] = [];
  for (const id of order) {
    const c = byId.get(id);
    if (c) {
      sorted.push(c);
      byId.delete(id);
    }
  }
  for (const c of byId.values()) sorted.push(c);
  return sorted;
}

interface CompanyDropdownProps {
  className?: string;
}

export function CompanyDropdown({ className }: CompanyDropdownProps) {
  const { companies, selectedCompany, selectedCompanyId, setSelectedCompanyId } = useCompany();
  const { openOnboarding } = useDialog();

  const sidebarCompanies = useMemo(
    () => companies.filter((c) => c.status !== "archived"),
    [companies],
  );

  // Respect the user's saved ordering; re-sync when companies change or
  // another tab reorders via the storage event.
  const [orderedCompanies, setOrderedCompanies] = useState<Company[]>(() =>
    applyStoredOrder(sidebarCompanies),
  );
  useEffect(() => {
    setOrderedCompanies(applyStoredOrder(sidebarCompanies));
  }, [sidebarCompanies]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== ORDER_STORAGE_KEY) return;
      setOrderedCompanies(applyStoredOrder(sidebarCompanies));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [sidebarCompanies]);

  const companyIds = orderedCompanies.map((c) => c.id);

  const liveRunsQueries = useQueries({
    queries: companyIds.map((companyId) => ({
      queryKey: queryKeys.liveRuns(companyId),
      queryFn: () => heartbeatsApi.liveRunsForCompany(companyId),
      refetchInterval: 10_000,
    })),
  });
  const sidebarBadgeQueries = useQueries({
    queries: companyIds.map((companyId) => ({
      queryKey: queryKeys.sidebarBadges(companyId),
      queryFn: () => sidebarBadgesApi.get(companyId),
      refetchInterval: 15_000,
    })),
  });

  const liveByCompanyId = useMemo(() => {
    const m = new Map<string, boolean>();
    companyIds.forEach((id, i) => {
      m.set(id, (liveRunsQueries[i]?.data?.length ?? 0) > 0);
    });
    return m;
  }, [companyIds, liveRunsQueries]);
  const inboxByCompanyId = useMemo(() => {
    const m = new Map<string, boolean>();
    companyIds.forEach((id, i) => {
      m.set(id, (sidebarBadgeQueries[i]?.data?.inbox ?? 0) > 0);
    });
    return m;
  }, [companyIds, sidebarBadgeQueries]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm font-bold text-foreground outline-none transition-colors hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring",
            className,
          )}
          aria-label="Switch company"
        >
          {selectedCompany ? (
            <CompanyPatternIcon
              companyName={selectedCompany.name}
              logoUrl={selectedCompany.logoUrl}
              brandColor={selectedCompany.brandColor}
              className="h-5 w-5 shrink-0 rounded-[6px] text-[10px]"
            />
          ) : null}
          <span className="min-w-0 flex-1 truncate">
            {selectedCompany?.name ?? "Select company"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-60">
        <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Switch workspace
        </DropdownMenuLabel>
        {orderedCompanies.length === 0 && (
          <DropdownMenuItem disabled>No companies</DropdownMenuItem>
        )}
        {orderedCompanies.map((company) => {
          const isSelected = company.id === selectedCompanyId;
          const hasLive = liveByCompanyId.get(company.id) ?? false;
          const hasInbox = inboxByCompanyId.get(company.id) ?? false;
          return (
            <DropdownMenuItem
              key={company.id}
              onClick={() => setSelectedCompanyId(company.id)}
              className={cn("gap-2", isSelected && "bg-accent")}
            >
              <CompanyPatternIcon
                companyName={company.name}
                logoUrl={company.logoUrl}
                brandColor={company.brandColor}
                className="h-5 w-5 shrink-0 rounded-[6px] text-[10px]"
              />
              <span className="min-w-0 flex-1 truncate">{company.name}</span>
              {hasLive && (
                <span className="relative flex h-2 w-2 shrink-0" aria-label="Live activity">
                  <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-blue-400 opacity-80" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                </span>
              )}
              {hasInbox && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                  aria-label="Unread inbox"
                />
              )}
              {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openOnboarding()} className="gap-2">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border border-dashed border-border text-muted-foreground">
            <Plus className="h-3 w-3" />
          </span>
          <span className="text-muted-foreground">Add company…</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
