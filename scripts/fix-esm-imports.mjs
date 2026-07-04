import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.argv[2];

if (!rootDir) {
  console.error("Usage: node scripts/fix-esm-imports.mjs <dist-dir>");
  process.exit(1);
}

const distRoot = path.resolve(process.cwd(), rootDir);

if (!existsSync(distRoot)) {
  console.error(`Cannot find dist directory: ${distRoot}`);
  process.exit(1);
}

for (const filePath of findJsFiles(distRoot)) {
  const source = readFileSync(filePath, "utf8");
  const updated = rewriteSpecifiers(source, filePath);

  if (updated !== source) {
    writeFileSync(filePath, updated);
  }
}

function* findJsFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const entryPath = path.join(dir, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      yield* findJsFiles(entryPath);
      continue;
    }

    if (stats.isFile() && entryPath.endsWith(".js")) {
      yield entryPath;
    }
  }
}

function rewriteSpecifiers(source, filePath) {
  return source
    .replace(
      /(\bfrom\s+["'])(\.[^"']+)(["'])/g,
      (_match, prefix, specifier, suffix) =>
        `${prefix}${resolveSpecifier(specifier, filePath)}${suffix}`,
    )
    .replace(
      /(\bimport\s+["'])(\.[^"']+)(["'])/g,
      (_match, prefix, specifier, suffix) =>
        `${prefix}${resolveSpecifier(specifier, filePath)}${suffix}`,
    )
    .replace(
      /(\bimport\s*\(\s*["'])(\.[^"']+)(["']\s*\))/g,
      (_match, prefix, specifier, suffix) =>
        `${prefix}${resolveSpecifier(specifier, filePath)}${suffix}`,
    );
}

function resolveSpecifier(specifier, filePath) {
  if (hasRuntimeExtension(specifier)) return specifier;

  const fileDir = path.dirname(filePath);
  const absoluteTarget = path.resolve(fileDir, specifier);

  if (existsSync(`${absoluteTarget}.js`)) {
    return `${specifier}.js`;
  }

  if (existsSync(path.join(absoluteTarget, "index.js"))) {
    return `${specifier}/index.js`;
  }

  return specifier;
}

function hasRuntimeExtension(specifier) {
  return [".cjs", ".js", ".json", ".mjs", ".node"].includes(
    path.extname(specifier),
  );
}
