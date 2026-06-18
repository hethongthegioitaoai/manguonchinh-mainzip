import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { context as esbuildContext, build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(artifactDir, "dist");
const isWatch = process.argv.includes("--watch");

const external = [
  "*.node", "sharp", "better-sqlite3", "sqlite3", "canvas", "bcrypt", "argon2",
  "fsevents", "re2", "farmhash", "xxhash-addon", "bufferutil", "utf-8-validate",
  "ssh2", "cpu-features", "dtrace-provider", "isolated-vm", "lightningcss",
  "pg-native", "oracledb", "mongodb-client-encryption", "nodemailer", "handlebars",
  "knex", "typeorm", "protobufjs", "onnxruntime-node", "@tensorflow/*",
  "@prisma/client", "@mikro-orm/*", "@grpc/*", "@swc/*", "@aws-sdk/*", "@azure/*",
  "@opentelemetry/*", "@google-cloud/*", "@google/*", "googleapis", "firebase-admin",
  "@parcel/watcher", "@sentry/profiling-node", "@tree-sitter/*", "aws-sdk",
  "classic-level", "dd-trace", "ffi-napi", "grpc", "hiredis", "kerberos",
  "leveldown", "miniflare", "mysql2", "newrelic", "odbc", "piscina", "realm",
  "ref-napi", "rocksdb", "sass-embedded", "sequelize", "serialport", "snappy",
  "tinypool", "usb", "workerd", "wrangler", "zeromq", "zeromq-prebuilt",
  "playwright", "puppeteer", "puppeteer-core", "electron",
];

const banner = {
  js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
  `,
};

const plugins = [esbuildPluginPino({ transports: ["pino-pretty"] })];

if (isWatch) {
  let serverProc = null;

  function startServer() {
    if (serverProc) {
      serverProc.kill("SIGTERM");
      serverProc = null;
    }
    serverProc = spawn(
      "node",
      ["--enable-source-maps", path.join(distDir, "index.mjs")],
      { stdio: "inherit", env: process.env }
    );
    serverProc.on("exit", (code) => {
      if (code !== null && code !== 0) {
        console.error(`[watch] Server exited with code ${code}`);
      }
    });
  }

  const ctx = await esbuildContext({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    external,
    sourcemap: "linked",
    plugins,
    banner,
  });

  await ctx.rebuild();
  console.log("[watch] Initial build done — starting server");
  startServer();

  await ctx.watch();
  console.log("[watch] Watching for changes...");

  process.on("SIGINT", async () => {
    if (serverProc) serverProc.kill("SIGTERM");
    await ctx.dispose();
    process.exit(0);
  });

  // Poll for rebuilt output and restart server on change
  let lastMtime = Date.now();
  const outFile = path.join(distDir, "index.mjs");
  const { stat } = await import("node:fs/promises");
  setInterval(async () => {
    try {
      const s = await stat(outFile);
      if (s.mtimeMs > lastMtime) {
        lastMtime = s.mtimeMs;
        console.log("[watch] Rebuild detected — restarting server");
        startServer();
      }
    } catch {
      // file not yet created
    }
  }, 500);

} else {
  await rm(distDir, { recursive: true, force: true });
  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    external,
    sourcemap: "linked",
    plugins,
    banner,
  });
}
