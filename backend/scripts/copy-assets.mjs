import { copyFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(
  new URL("../assets/5c-networks-logo.png", import.meta.url),
);
const target = fileURLToPath(
  new URL("../dist/assets/5c-networks-logo.png", import.meta.url),
);

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
