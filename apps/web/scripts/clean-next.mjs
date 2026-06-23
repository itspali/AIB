import { existsSync, renameSync, rmSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";

async function removePath(targetPath) {
  if (!existsSync(targetPath)) return;

  let pathToRemove = targetPath;
  if (isWindows) {
    const trashPath = `${targetPath}.delete-${Date.now()}`;
    try {
      renameSync(targetPath, trashPath);
      pathToRemove = trashPath;
    } catch {
      /* fall back to direct removal */
    }
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      rmSync(pathToRemove, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
      if (!existsSync(pathToRemove)) return;
    } catch {
      /* Windows may still be releasing handles */
    }
    await delay(400);
  }

  if (existsSync(pathToRemove)) {
    console.warn(`Warning: could not fully remove ${pathToRemove.replace(webRoot, ".")}`);
  }
}

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
