import type { ComponentType, SVGProps } from "react";
import { Bot, FileText, Hexagon, MessageSquare, Quote } from "lucide-react";
import type { Agent, CompanySearchResult, Project } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import { StatusIcon } from "../StatusIcon";
import { StatusBadge } from "../StatusBadge";
import { Identity } from "../Identity";
import { HighlightedText, type HighlightedTextProps } from "./HighlightedText";

type SnippetStyle = {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
};

const SNIPPET_STYLES: Record<string, SnippetStyle> = {
  comment: { Icon: MessageSquare, label: "Comment" },
  document: { Icon: FileText, label: "Doc" },
  description: { Icon: Quote, label: "Description" },
};

function snippetStyle(field: string, fallbackLabel: string): SnippetStyle {
  return SNIPPET_STYLES[field] ?? { Icon: Quote, label: fallbackLabel };
}

function formatRelativeTime(input: string | null): string {
  if (!input) return "";
  const value = new Date(input);
  if (Number.isNaN(value.getTime())) return "";
  const diffMs = Date.now() - value.getTime();
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.round(days / 365);
  return `${years}y`;
}

export interface SearchResultRowProps {
  result: CompanySearchResult;
  agentsById?: ReadonlyMap<string, Pick<Agent, "id" | "name">>;
  projectsById?: ReadonlyMap<string, Pick<Project, "id" | "name">>;
  isActive?: boolean;
  className?: string;
}

export function SearchResultRow({
  result,
  agentsById,
  projectsById,
  isActive,
  className,
}: SearchResultRowProps) {
  if (result.type === "agent") {
    return (
      <Link
        to={result.href}
        className={cn(
          "group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40",
          isActive && "bg-accent/40",
          className,
        )}
        data-result-type="agent"
      >
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Bot className="h-3 w-3" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{result.title}</span>
          </div>
          {result.snippet ? (
            <SnippetLine
              text={result.snippets[0]?.text ?? result.snippet}
              highlights={result.snippets[0]?.highlights}
              field="agent"
              fallbackLabel={result.sourceLabel ?? "Agent"}
            />
          ) : null}
        </div>
      </Link>
    );
  }

  if (result.type === "project") {
    return (
      <Link
        to={result.href}
        className={cn(
          "group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40",
          isActive && "bg-accent/40",
          className,
        )}
        data-result-type="project"
      >
        <Hexagon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <span className="truncate text-sm font-medium">{result.title}</span>
          {result.snippet ? (
            <SnippetLine
              text={result.snippets[0]?.text ?? result.snippet}
              highlights={result.snippets[0]?.highlights}
              field="project"
              fallbackLabel={result.sourceLabel ?? "Project"}
            />
          ) : null}
        </div>
      </Link>
    );
  }

  const issue = result.issue;
  if (!issue) return null;
  const assigneeName = issue.assigneeAgentId
    ? agentsById?.get(issue.assigneeAgentId)?.name ?? null
    : null;
  const projectName = issue.projectId ? projectsById?.get(issue.projectId)?.name ?? null : null;
  const updated = formatRelativeTime(result.updatedAt ?? issue.updatedAt);
  const titleHighlights = result.snippets.find((snippet) => snippet.field === "title")?.highlights;
  const bodySnippets = result.snippets.filter((snippet) => snippet.field !== "title").slice(0, 2);

  return (
    <Link
      to={result.href}
      className={cn(
        "group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/40",
        isActive && "bg-accent/40",
        className,
      )}
      data-result-type="issue"
    >
      <div className="mt-1 shrink-0">
        <StatusIcon status={issue.status} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-x-2.5">
          {issue.identifier ? (
            <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
              {issue.identifier}
            </span>
          ) : null}
          <HighlightedText
            text={issue.title}
            highlights={titleHighlights}
            className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug text-foreground"
          />
          <div className="ml-2 hidden shrink-0 items-center gap-2.5 text-xs text-muted-foreground sm:flex">
            <StatusBadge status={issue.status} />
            {assigneeName ? <Identity name={assigneeName} size="sm" /> : null}
            {projectName ? (
              <span className="inline-flex items-center gap-1">
                <Hexagon className="h-3 w-3" />
                <span className="max-w-[10ch] truncate">{projectName}</span>
              </span>
            ) : null}
            {updated ? (
              <span className="tabular-nums">{updated}</span>
            ) : null}
          </div>
        </div>
        {bodySnippets.map((snippet, index) => (
          <SnippetLine
            key={`${snippet.field}-${index}`}
            text={snippet.text}
            highlights={snippet.highlights}
            field={snippet.field}
            fallbackLabel={snippet.label}
          />
        ))}
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground sm:hidden">
          <StatusBadge status={issue.status} />
          {assigneeName ? <span className="truncate">{assigneeName}</span> : null}
          {projectName ? <span className="truncate">· {projectName}</span> : null}
          {updated ? <span className="ml-auto tabular-nums">{updated}</span> : null}
        </div>
      </div>
    </Link>
  );
}

interface SnippetLineProps {
  text: string;
  highlights?: HighlightedTextProps["highlights"];
  field: string;
  fallbackLabel: string;
}

function SnippetLine({ text, highlights, field, fallbackLabel }: SnippetLineProps) {
  const { Icon, label } = snippetStyle(field, fallbackLabel);
  return (
    <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3 w-3 shrink-0 text-muted-foreground/60" aria-hidden />
      <span className="sr-only">{label}: </span>
      <HighlightedText
        text={text}
        highlights={highlights}
        className="line-clamp-1 truncate"
      />
    </div>
  );
}
