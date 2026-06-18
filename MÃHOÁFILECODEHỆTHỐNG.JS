/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║            MÃ HOÁ FILE CODE HỆ THỐNG — AI WORLD SYSTEM             ║
 * ║            AES-256-CBC Code Encryption / Decryption Utility         ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Cách dùng:
 *   node MÃHOÁFILECODEHỆTHỐNG.JS encrypt   <file>   <key>   # mã hoá 1 file
 *   node MÃHOÁFILECODEHỆTHỐNG.JS decrypt   <file>   <key>   # giải mã 1 file
 *   node MÃHOÁFILECODEHỆTHỐNG.JS encrypt-dir <dir>  <key>   # mã hoá cả thư mục
 *   node MÃHOÁFILECODEHỆTHỐNG.JS decrypt-dir <dir>  <key>   # giải mã cả thư mục
 *   node MÃHOÁFILECODEHỆTHỐNG.JS list      <dir>            # liệt kê file đã mã hoá
 *   node MÃHOÁFILECODEHỆTHỐNG.JS verify    <file>   <key>   # kiểm tra tính toàn vẹn
 *   node MÃHOÁFILECODEHỆTHỐNG.JS bundle    <dir>    <key>   # tạo archive mã hoá
 *   node MÃHOÁFILECODEHỆTHỐNG.JS unbundle  <bundle> <key>   # giải nén archive
 *   node MÃHOÁFILECODEHỆTHỐNG.JS hash      <file>           # tính hash file (kiểm tra)
 *   node MÃHOÁFILECODEHỆTHỐNG.JS info                       # thông tin hệ thống mã hoá
 *
 * ⚠️  LƯU Ý QUAN TRỌNG:
 *   - File gốc KHÔNG bị xoá sau khi mã hoá — file mã hoá có đuôi .mhe
 *   - Giữ bảo mật KEY — mất key = không thể giải mã
 *   - Sử dụng key đủ mạnh (≥ 32 ký tự ngẫu nhiên)
 *   - Để generate key an toàn: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

"use strict";

const crypto = require("crypto");
const fs     = require("fs");
const path   = require("path");

const MAGIC_HEADER  = "MHCHT_V1"; // Magic bytes để nhận dạng file đã mã hoá
const ENCRYPTED_EXT = ".mhe";     // Mã Hoá Extension
const HASH_ALGO     = "sha256";
const CIPHER_ALGO   = "aes-256-cbc";
const IV_LENGTH     = 16;
const KEY_SALT      = "AI_WORLD_SYSTEM_2026_SALT";

/* ─────────────────────────────────────────────────────────────
   KEY DERIVATION (PBKDF2 — phòng chống brute-force key)
───────────────────────────────────────────────────────────── */
function deriveKey(passphrase) {
  return crypto.pbkdf2Sync(passphrase, KEY_SALT, 100_000, 32, "sha512");
}

/* ─────────────────────────────────────────────────────────────
   MÃ HOÁ FILE (AES-256-CBC + HMAC-SHA256 integrity check)
───────────────────────────────────────────────────────────── */
function encryptBuffer(buffer, passphrase) {
  const key  = deriveKey(passphrase);
  const iv   = crypto.randomBytes(IV_LENGTH);

  const cipher    = crypto.createCipheriv(CIPHER_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

  // HMAC để kiểm tra tính toàn vẹn khi giải mã
  const hmac = crypto.createHmac("sha256", key)
    .update(iv)
    .update(encrypted)
    .digest();

  // Format: [MAGIC_HEADER(8)] [IV(16)] [HMAC(32)] [ENCRYPTED_DATA]
  const header = Buffer.from(MAGIC_HEADER, "utf8"); // 8 bytes
  return Buffer.concat([header, iv, hmac, encrypted]);
}

function decryptBuffer(buffer, passphrase) {
  const header = buffer.slice(0, 8).toString("utf8");
  if (header !== MAGIC_HEADER) {
    throw new Error("File này không phải file mã hoá MHCHT hoặc đã bị hỏng.");
  }

  const key      = deriveKey(passphrase);
  const iv       = buffer.slice(8, 24);
  const hmacStored = buffer.slice(24, 56);
  const encrypted  = buffer.slice(56);

  // Kiểm tra HMAC trước khi giải mã
  const hmacComputed = crypto.createHmac("sha256", key)
    .update(iv)
    .update(encrypted)
    .digest();

  if (!crypto.timingSafeEqual(hmacStored, hmacComputed)) {
    throw new Error("HMAC không khớp — file đã bị chỉnh sửa hoặc key sai!");
  }

  const decipher = crypto.createDecipheriv(CIPHER_ALGO, key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/* ─────────────────────────────────────────────────────────────
   HASH FILE (kiểm tra tính toàn vẹn gốc)
───────────────────────────────────────────────────────────── */
function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  const hash    = crypto.createHash(HASH_ALGO).update(content).digest("hex");
  return { file: filePath, hash, size: content.length, algo: HASH_ALGO };
}

/* ─────────────────────────────────────────────────────────────
   MÃ HOÁ / GIẢI MÃ 1 FILE
───────────────────────────────────────────────────────────── */
function encryptFile(filePath, passphrase) {
  if (!fs.existsSync(filePath)) throw new Error(`File không tồn tại: ${filePath}`);

  const content   = fs.readFileSync(filePath);
  const encrypted = encryptBuffer(content, passphrase);
  const outPath   = filePath + ENCRYPTED_EXT;

  // Lưu hash gốc vào metadata file
  const originalHash = crypto.createHash(HASH_ALGO).update(content).digest("hex");
  const metaPath      = outPath + ".meta";
  fs.writeFileSync(metaPath, JSON.stringify({
    originalFile:   path.basename(filePath),
    originalHash,
    originalSize:   content.length,
    encryptedAt:    new Date().toISOString(),
    algo:           CIPHER_ALGO,
  }, null, 2));

  fs.writeFileSync(outPath, encrypted);
  console.log(`✅ Đã mã hoá: ${filePath} → ${outPath}`);
  console.log(`   Hash gốc : ${originalHash}`);
  console.log(`   Kích thước: ${content.length} → ${encrypted.length} bytes`);
  return { outPath, metaPath, originalHash };
}

function decryptFile(encryptedPath, passphrase) {
  if (!fs.existsSync(encryptedPath)) throw new Error(`File không tồn tại: ${encryptedPath}`);

  const encrypted = fs.readFileSync(encryptedPath);
  const decrypted = decryptBuffer(encrypted, passphrase);

  // Xác minh hash nếu có metadata
  const metaPath = encryptedPath + ".meta";
  if (fs.existsSync(metaPath)) {
    const meta         = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    const decryptedHash = crypto.createHash(HASH_ALGO).update(decrypted).digest("hex");
    if (meta.originalHash !== decryptedHash) {
      throw new Error(`Hash không khớp! File gốc đã bị thay đổi trước khi mã hoá?`);
    }
    console.log(`✅ Hash xác nhận: ${decryptedHash}`);
  }

  // Xác định đường dẫn file giải mã
  const outPath = encryptedPath.endsWith(ENCRYPTED_EXT)
    ? encryptedPath.slice(0, -ENCRYPTED_EXT.length)
    : encryptedPath + ".decrypted";

  fs.writeFileSync(outPath, decrypted);
  console.log(`✅ Đã giải mã: ${encryptedPath} → ${outPath}`);
  console.log(`   Kích thước: ${encrypted.length} → ${decrypted.length} bytes`);
  return outPath;
}

/* ─────────────────────────────────────────────────────────────
   MÃ HOÁ / GIẢI MÃ CẢ THƯ MỤC
───────────────────────────────────────────────────────────── */
const SKIP_EXTENSIONS  = new Set([".mhe", ".meta", ".map", ".lock", ".log"]);
const SKIP_DIRS        = new Set(["node_modules", ".git", "dist", "build", ".local", "coverage"]);
const INCLUDE_EXTS     = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".sql", ".env"]);

function walkDir(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walkDir(path.join(dir, entry.name), files);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (INCLUDE_EXTS.has(ext) && !SKIP_EXTENSIONS.has(ext)) {
        files.push(path.join(dir, entry.name));
      }
    }
  }
  return files;
}

function encryptDir(dirPath, passphrase) {
  const files = walkDir(dirPath);
  console.log(`\n📁 Tìm thấy ${files.length} file cần mã hoá trong: ${dirPath}`);
  let success = 0, errors = 0;
  for (const f of files) {
    try {
      encryptFile(f, passphrase);
      success++;
    } catch (e) {
      console.error(`❌ Lỗi: ${f} — ${e.message}`);
      errors++;
    }
  }
  console.log(`\n📊 Kết quả: ${success} thành công, ${errors} lỗi`);
}

function decryptDir(dirPath, passphrase) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true, recursive: true });
  const encrypted = [];
  function findEncrypted(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
      const full = path.join(d, e.name);
      if (e.isDirectory() && !SKIP_DIRS.has(e.name)) findEncrypted(full);
      else if (e.isFile() && e.name.endsWith(ENCRYPTED_EXT) && !e.name.endsWith(".meta")) encrypted.push(full);
    });
  }
  findEncrypted(dirPath);
  console.log(`\n📁 Tìm thấy ${encrypted.length} file mã hoá trong: ${dirPath}`);
  let success = 0, errors = 0;
  for (const f of encrypted) {
    try { decryptFile(f, passphrase); success++; }
    catch (e) { console.error(`❌ Lỗi: ${f} — ${e.message}`); errors++; }
  }
  console.log(`\n📊 Kết quả: ${success} thành công, ${errors} lỗi`);
}

/* ─────────────────────────────────────────────────────────────
   BUNDLE — tạo 1 file archive mã hoá duy nhất
───────────────────────────────────────────────────────────── */
function bundleDir(dirPath, passphrase) {
  const files = walkDir(dirPath);
  const bundle = {};
  for (const f of files) {
    const content     = fs.readFileSync(f, "utf8");
    const relPath     = path.relative(dirPath, f);
    bundle[relPath]   = { content, hash: crypto.createHash("sha256").update(content).digest("hex") };
  }
  const json      = JSON.stringify(bundle);
  const encrypted = encryptBuffer(Buffer.from(json, "utf8"), passphrase);
  const outPath   = path.join(path.dirname(dirPath), path.basename(dirPath) + ".bundle.mhe");
  fs.writeFileSync(outPath, encrypted);
  console.log(`✅ Bundle: ${files.length} file → ${outPath} (${(encrypted.length / 1024).toFixed(1)} KB)`);
  return outPath;
}

function unbundleDir(bundlePath, passphrase, outDir) {
  const encrypted = fs.readFileSync(bundlePath);
  const json      = decryptBuffer(encrypted, passphrase).toString("utf8");
  const bundle    = JSON.parse(json);
  const target    = outDir || bundlePath.replace(".bundle.mhe", "_decrypted");
  fs.mkdirSync(target, { recursive: true });
  for (const [relPath, data] of Object.entries(bundle)) {
    const fullPath = path.join(target, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, data.content, "utf8");
    const hash = crypto.createHash("sha256").update(data.content).digest("hex");
    if (hash !== data.hash) console.warn(`⚠️  Hash không khớp: ${relPath}`);
    else console.log(`✅ ${relPath}`);
  }
  console.log(`\n📦 Đã giải nén ${Object.keys(bundle).length} file vào: ${target}`);
}

/* ─────────────────────────────────────────────────────────────
   LIST / VERIFY
───────────────────────────────────────────────────────────── */
function listEncrypted(dirPath) {
  const found = [];
  function scan(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
      const full = path.join(d, e.name);
      if (e.isDirectory() && !SKIP_DIRS.has(e.name)) scan(full);
      else if (e.isFile() && e.name.endsWith(ENCRYPTED_EXT) && !e.name.endsWith(".meta")) found.push(full);
    });
  }
  scan(dirPath);
  console.log(`\n🔒 File đã mã hoá trong: ${dirPath}`);
  found.forEach((f, i) => {
    const stat = fs.statSync(f);
    const metaPath = f + ".meta";
    let meta = null;
    try { meta = JSON.parse(fs.readFileSync(metaPath, "utf8")); } catch {}
    console.log(`  ${i + 1}. ${f}`);
    if (meta) console.log(`     Gốc: ${meta.originalFile} | ${meta.originalSize} bytes | ${meta.encryptedAt}`);
    else console.log(`     Size: ${stat.size} bytes`);
  });
  console.log(`\nTổng: ${found.length} file mã hoá`);
}

function verifyFile(encryptedPath, passphrase) {
  console.log(`\n🔍 Kiểm tra: ${encryptedPath}`);
  try {
    const encrypted = fs.readFileSync(encryptedPath);
    const header    = encrypted.slice(0, 8).toString("utf8");
    if (header !== MAGIC_HEADER) { console.log("❌ Không phải file MHCHT"); return false; }

    const decrypted = decryptBuffer(encrypted, passphrase);
    const metaPath  = encryptedPath + ".meta";
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      const hash = crypto.createHash("sha256").update(decrypted).digest("hex");
      if (hash === meta.originalHash) {
        console.log(`✅ Toàn vẹn xác nhận — Hash: ${hash}`);
        return true;
      } else {
        console.log(`❌ Hash không khớp!\n   Mong đợi: ${meta.originalHash}\n   Thực tế:  ${hash}`);
        return false;
      }
    } else {
      console.log(`✅ Giải mã thành công (không có metadata để so sánh hash)`);
      return true;
    }
  } catch (e) {
    console.log(`❌ Lỗi: ${e.message}`);
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────
   INFO
───────────────────────────────────────────────────────────── */
function printInfo() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         MÃ HOÁ FILE CODE HỆ THỐNG — AI WORLD SYSTEM        ║
╠══════════════════════════════════════════════════════════════╣
║  Thuật toán:     AES-256-CBC                                 ║
║  Key Derivation: PBKDF2 (SHA-512, 100.000 iterations)        ║
║  Integrity:      HMAC-SHA256                                 ║
║  Extension:      .mhe (Mã Hoá Extension)                     ║
║  Node.js:        ${process.version.padEnd(43)}║
╠══════════════════════════════════════════════════════════════╣
║  Cách generate key an toàn:                                  ║
║  node -e "console.log(require('crypto').randomBytes(32)      ║
║               .toString('hex'))"                             ║
╚══════════════════════════════════════════════════════════════╝

Lệnh hỗ trợ:
  encrypt   <file>   <key>   Mã hoá 1 file
  decrypt   <file>   <key>   Giải mã 1 file
  encrypt-dir <dir>  <key>   Mã hoá toàn bộ thư mục
  decrypt-dir <dir>  <key>   Giải mã toàn bộ thư mục
  list      <dir>            Liệt kê file đã mã hoá
  verify    <file>   <key>   Kiểm tra tính toàn vẹn
  bundle    <dir>    <key>   Tạo archive mã hoá duy nhất
  unbundle  <file>   <key>   Giải nén archive
  hash      <file>           Tính SHA-256 hash file gốc
  info                       Hiển thị thông tin này
`);
}

/* ─────────────────────────────────────────────────────────────
   CLI ENTRY POINT
───────────────────────────────────────────────────────────── */
if (require.main === module) {
  const [,, cmd, target, key, extra] = process.argv;

  try {
    switch (cmd) {
      case "encrypt":     encryptFile(target, key);      break;
      case "decrypt":     decryptFile(target, key);      break;
      case "encrypt-dir": encryptDir(target, key);       break;
      case "decrypt-dir": decryptDir(target, key);       break;
      case "list":        listEncrypted(target || ".");  break;
      case "verify":      verifyFile(target, key);       break;
      case "bundle":      bundleDir(target, key);        break;
      case "unbundle":    unbundleDir(target, key, extra); break;
      case "hash":        console.log(hashFile(target)); break;
      case "info":
      case undefined:     printInfo();                   break;
      default:
        console.error(`Lệnh không hợp lệ: ${cmd}`);
        printInfo();
        process.exit(1);
    }
  } catch (e) {
    console.error(`\n❌ Lỗi: ${e.message}`);
    process.exit(1);
  }
}

module.exports = {
  encryptFile,
  decryptFile,
  encryptDir,
  decryptDir,
  bundleDir,
  unbundleDir,
  listEncrypted,
  verifyFile,
  hashFile,
  encryptBuffer,
  decryptBuffer,
  deriveKey,
};
