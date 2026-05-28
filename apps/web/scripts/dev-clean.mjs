import { execSync, spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = 3000;

function killPort(targetPort) {
  try {
    if (process.platform === "win32") {
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
          execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
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

killPort(port);

const cachePaths = [
  join(webRoot, ".next"),
  join(webRoot, "node_modules", ".cache"),
];

for (const cachePath of cachePaths) {
  if (existsSync(cachePath)) {
    rmSync(cachePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    console.log(`Removed ${cachePath.replace(webRoot, ".")}`);
  }
}

console.log(`Starting next dev on port ${port}...`);

const child = spawn("npm run dev", {
  cwd: webRoot,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
