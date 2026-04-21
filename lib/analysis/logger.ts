type LogLevel = "info" | "warn" | "error";

type LoggerContext = {
  scope: string;
  repoUrl?: string;
  runId?: string;
};

function now() {
  return Date.now();
}

function shouldLog(level: LogLevel) {
  return process.env.REPOLENS_DEBUG === "1" || level !== "info";
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function createAnalysisLogger(context: LoggerContext) {
  const startedAt = now();

  function emit(level: LogLevel, message: string, details?: Record<string, unknown>) {
    if (!shouldLog(level)) {
      return;
    }

    const prefix = `[RepoLens][${context.scope}]`;
    const suffix = details ? ` ${safeStringify(details)}` : "";
    const elapsedMs = now() - startedAt;
    const line = `${prefix} +${elapsedMs}ms ${message}${suffix}`;

    if (level === "error") {
      console.error(line);
      return;
    }

    if (level === "warn") {
      console.warn(line);
      return;
    }

    console.info(line);
  }

  return {
    info(message: string, details?: Record<string, unknown>) {
      emit("info", message, details);
    },
    warn(message: string, details?: Record<string, unknown>) {
      emit("warn", message, details);
    },
    error(message: string, details?: Record<string, unknown>) {
      emit("error", message, details);
    },
    time<T>(label: string, run: () => Promise<T>) {
      const start = now();

      return run()
        .then((value) => {
          emit("info", `${label}:ok`, { durationMs: now() - start });
          return value;
        })
        .catch((error) => {
          emit("warn", `${label}:failed`, {
            durationMs: now() - start,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        });
    },
  };
}
