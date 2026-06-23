import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = join(webRoot, ".next");

function findTurbopackRuntimeRefs(dir) {
  if (!existsSync(dir)) return false;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (findTurbopackRuntimeRefs(fullPath)) return true;
      continue;
    }

    if (!entry.name.endsWith(".js") && !entry.name.endsWith(".json")) continue;

    try {
      const text = readFileSync(fullPath, "utf8");
      if (text.includes("[turbopack]_runtime")) return true;
    } catch {
      /* ignore unreadable files */
    }
  }

  return false;
}

if (!existsSync(join(nextDir, "BUILD_ID"))) {
  console.error(
    "No production build found. Run `npm run build` in apps/web before `npm run start`."
  );
  process.exit(1);
}

if (findTurbopackRuntimeRefs(join(nextDir, "server"))) {
  console.error(
    "The .next output looks like a Turbopack dev cache, not a production build.\n" +
      "Stop `next dev`, then run `npm run build` and start again with `npm run start`."
  );
  process.exit(1);
}
