import { execSync, spawn } from "node:child_process";
import { existsSync, renameSync, rmSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = 3000;
const isWindows = process.platform === "win32";

function killPort(targetPort) {
  try {
    if (isWindows) {
      const output = execSync(`netstat -ano | findstr :${targetPort}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });

      const pids = new Set();
      for (const line of output.split("\n")) {
        if (!line.includes("LISTENING")) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts.at(-1);
        if (pid && pid !== "0") pids.add(pid);
      }

      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F /T`, { stdio: "ignore" });
          console.log(`Stopped process ${pid} on port ${targetPort}`);
        } catch {
          /* process may already be gone */
        }
      }
      return;
    }

    execSync(`lsof -ti:${targetPort} | xargs kill -9 2>/dev/null || true`, {
      shell: true,
      stdio: "ignore",
    });
  } catch {
    /* nothing listening on this port */
  }
}

async function removePath(targetPath) {
  if (!existsSync(targetPath)) return;

  if (isWindows) {
    const trashPath = `${targetPath}.delete-${Date.now()}`;
    try {
      renameSync(targetPath, trashPath);
      targetPath = trashPath;
    } catch {
      /* fall back to direct removal */
    }
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      rmSync(targetPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
      if (!existsSync(targetPath)) return;
    } catch {
      /* Windows may still be releasing handles */
    }
    await delay(400);
  }

  if (existsSync(targetPath)) {
    console.warn(`Warning: could not fully remove ${targetPath.replace(webRoot, ".")}`);
  }
}

killPort(port);
await delay(isWindows ? 800 : 200);

const cachePaths = [
  join(webRoot, ".next"),
  join(webRoot, "node_modules", ".cache"),
  join(webRoot, "tsconfig.tsbuildinfo"),
];

for (const cachePath of cachePaths) {
  await removePath(cachePath);
  if (!existsSync(cachePath)) {
    console.log(`Removed ${cachePath.replace(webRoot, ".")}`);
  }
}

await delay(isWindows ? 800 : 200);

console.log(`Starting next dev on port ${port}...`);

const child = spawn("npx", ["next", "dev", "--port", String(port)], {
  cwd: webRoot,
  stdio: "inherit",
  shell: isWindows,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
