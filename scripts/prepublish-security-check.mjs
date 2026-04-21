import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const blockedPathRules = [
  {
    test: (file) => file === ".claude/launch.json" || file.startsWith(".claude/"),
    message: "Claude local launcher files must stay local.",
  },
  {
    test: (file) => file.startsWith(".codex/context/"),
    message: "Codex session context files must not be published.",
  },
  {
    test: (file) => file.startsWith(".codex/qa/"),
    message: "Browser QA screenshots are local review artifacts.",
  },
  {
    test: (file) => file.startsWith(".codex/reviews/"),
    message: "Review artifacts are local process outputs.",
  },
  {
    test: (file) => file.startsWith(".codex/telemetry/"),
    message: "Telemetry append-only logs must stay out of the public repo.",
  },
  {
    test: (file) => file === ".codex/runtime.json",
    message: "Codex runtime state must stay local.",
  },
  {
    test: (file) => file.startsWith(".codex/") && /(?:^|\/)repolens-dev.*\.log$/i.test(file),
    message: "Local development logs must not be published.",
  },
  {
    test: (file) => file !== ".env.example" && /^\.env(?:\.|$)/.test(path.basename(file)),
    message: "Environment files must stay local; publish only .env.example.",
  },
  {
    test: (file) => path.basename(file) === ".DS_Store",
    message: "macOS metadata files must not be published.",
  },
];

const textLeakPatterns = [
  {
    label: "GitHub personal access token",
    regex: /(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g,
  },
  {
    label: "OpenAI API key",
    regex: /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/g,
  },
  {
    label: "AWS access key id",
    regex: /AKIA[0-9A-Z]{16}/g,
  },
  {
    label: "Slack token",
    regex: /xox[baprs]-[A-Za-z0-9-]{20,}/g,
  },
  {
    label: "Local absolute path",
    regex: /(?:\/Users\/[A-Za-z0-9._ -]+\/|[A-Za-z]:\\Users\\[A-Za-z0-9._ -]+\\)/g,
  },
  {
    label: "file:// path",
    regex: /file:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/g,
  },
];

function runGitList() {
  const output = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function isBinary(buffer) {
  const length = Math.min(buffer.length, 8000);
  for (let index = 0; index < length; index += 1) {
    if (buffer[index] === 0) {
      return true;
    }
  }

  return false;
}

function snippetForMatch(text, index, length) {
  const start = Math.max(0, index - 28);
  const end = Math.min(text.length, index + length + 28);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function collectFindings(files) {
  const findings = [];

  for (const file of files) {
    for (const rule of blockedPathRules) {
      if (rule.test(file)) {
        findings.push({
          type: "path",
          file,
          message: rule.message,
        });
      }
    }

    const absolutePath = path.join(repoRoot, file);
    const buffer = readFileSync(absolutePath);

    if (isBinary(buffer)) {
      continue;
    }

    const text = buffer.toString("utf8");

    for (const pattern of textLeakPatterns) {
      const matches = [...text.matchAll(pattern.regex)];
      for (const match of matches) {
        findings.push({
          type: "content",
          file,
          message: pattern.label,
          snippet: snippetForMatch(text, match.index ?? 0, match[0].length),
        });
      }
    }
  }

  return findings;
}

function main() {
  if (!existsSync(path.join(repoRoot, ".env.example"))) {
    console.error("[security:check] Missing .env.example");
    process.exit(1);
  }

  const files = runGitList();
  const findings = collectFindings(files);

  if (findings.length > 0) {
    console.error(`[security:check] Found ${findings.length} publish blocker(s):`);
    for (const finding of findings) {
      if (finding.type === "path") {
        console.error(`- ${finding.file}: ${finding.message}`);
        continue;
      }

      console.error(`- ${finding.file}: ${finding.message}`);
      if (finding.snippet) {
        console.error(`  snippet: ${finding.snippet}`);
      }
    }
    process.exit(1);
  }

  console.log(`[security:check] OK — scanned ${files.length} file(s) with no publish blockers.`);
}

main();
