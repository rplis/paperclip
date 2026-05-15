import { spawn } from "node:child_process";
import { store } from "@lean/db";

/**
 * Runs Codex with the prompt on stdin (`codex exec … -`), matching the
 * paperclip codex-local pattern so newlines, parentheses, and quotes in the
 * prompt do not break the shell.
 */
export async function runCodexForCard(input: { cardId: string; prompt: string }) {
  const card = store.cards.get(input.cardId);
  if (!card) {
    throw new Error("Card not found");
  }

  const log: string[] = [];
  const codexBin = process.env.LEAN_CODEX_BIN?.trim() || "codex";
  const extraFromEnv = process.env.LEAN_CODEX_EXTRA_ARGS?.trim();
  const extraArgs = extraFromEnv ? extraFromEnv.split(/\s+/).filter(Boolean) : [];
  const timeoutMs = Number(process.env.LEAN_CODEX_TIMEOUT_MS ?? 8 * 60_000);

  const args = ["exec", ...extraArgs, "-"];

  const child = spawn(codexBin, args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env
  });

  log.push(`$ ${codexBin} ${args.join(" ")}`);
  log.push("[stdin] UTF-8 prompt");

  child.stdout.on("data", (chunk) => {
    log.push(String(chunk));
  });
  child.stderr.on("data", (chunk) => {
    log.push(`[stderr] ${String(chunk)}`);
  });

  if (child.stdin) {
    child.stdin.write(input.prompt, "utf8");
    child.stdin.end();
  }

  const exitCode: number = await new Promise((resolve, reject) => {
    let settled = false;
    const timeout =
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? setTimeout(() => {
            if (settled) return;
            log.push(`[stderr] Kodeks runtime timed out after ${timeoutMs}ms; terminating codex process.`);
            child.kill("SIGTERM");
            setTimeout(() => {
              if (!settled) child.kill("SIGKILL");
            }, 5_000).unref();
          }, timeoutMs)
        : null;
    timeout?.unref();
    child.on("error", reject);
    child.on("close", (code) => {
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve(code ?? -1);
    });
  });

  log.push(`process_exit=${exitCode}`);
  store.runLogs.set(card.id, log);
  return { cardId: card.id, exitCode, log };
}
