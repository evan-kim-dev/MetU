const fs = require("node:fs");
const path = require("node:path");

const target = path.join(process.cwd(), ".next");

function removeDir(dir) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) removeDir(entryPath);
    else fs.unlinkSync(entryPath);
  }

  fs.rmdirSync(dir);
}

try {
  removeDir(target);
  const webpackCache = path.join(process.cwd(), "node_modules", ".cache");
  removeDir(webpackCache);
  console.log("Removed .next and webpack cache");
} catch (error) {
  console.error("Failed to remove .next:", error.message);
  process.exit(1);
}
