import { execFileSync } from "node:child_process";
import process from "node:process";
import path from "node:path";

const isWindowsPath = (value) => /^[a-zA-Z]:[\\/]/.test(value || "");

if (process.platform === "linux") {
  for (const key of ["PUPPETEER_EXECUTABLE_PATH", "CHROME_BIN", "GOOGLE_CHROME_BIN"]) {
    if (isWindowsPath(process.env[key])) delete process.env[key];
  }
  if (isWindowsPath(process.env.PUPPETEER_CACHE_DIR)) {
    delete process.env.PUPPETEER_CACHE_DIR;
  }
  process.env.PUPPETEER_CACHE_DIR ||= "/opt/render/.cache/puppeteer";
}

const command = path.resolve(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "puppeteer.cmd" : "puppeteer");
execFileSync(command, ["browsers", "install", "chrome"], { stdio: "inherit", shell: process.platform === "win32" });