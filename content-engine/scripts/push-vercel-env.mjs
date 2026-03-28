import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const token = process.env.VERCEL_API_TOKEN;

const envPath = resolve(process.cwd(), ".env.local");
const parsed = parseEnv(readFileSync(envPath, "utf8"));

const skipKeys = new Set([
  "VERCEL_API_TOKEN",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID",
]);

const entries = Object.entries(parsed).filter(([key, value]) => {
  return !skipKeys.has(key) && Boolean(value);
});

if (entries.length === 0) {
  console.error("No env variables found to push from .env.local");
  process.exit(1);
}

for (const [key, value] of entries) {
  console.log(`Syncing ${key} to Vercel production env...`);

  await runVercel([
    "env",
    "rm",
    key,
    "production",
    "--yes",
  ]).catch(() => {
    // Ignore if the variable does not exist yet.
  });

  await runVercel(["env", "add", key, "production", "--yes"], `${value}\n`);
}

console.log("Vercel environment sync complete.");

function runVercel(args, stdinText = "") {
  const finalArgs = [...args];
  if (token) {
    finalArgs.push("--token", token);
  }

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("npx", ["-y", "vercel@latest", ...finalArgs], {
      stdio: ["pipe", "inherit", "inherit"],
      env: process.env,
    });

    if (stdinText) {
      child.stdin.write(stdinText);
    }
    child.stdin.end();

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

function parseEnv(content) {
  const result = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}
