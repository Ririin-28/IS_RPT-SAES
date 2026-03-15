#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const rootDir = process.cwd();
const nextDir = path.join(rootDir, ".next");
const traceFile = path.join(nextDir, "trace");
const isCiMode = process.argv.includes("--ci") || process.env.CI === "true";

const isLockError = (error) => {
  if (!error || typeof error !== "object") return false;
  return ["EPERM", "EBUSY", "EACCES"].includes(error.code);
};

const isWindowsLockMessage = (message) => {
  if (!message) return false;
  const text = String(message).toLowerCase();
  return (
    text.includes("access to the path is denied") ||
    text.includes("being used by another process") ||
    text.includes("cannot remove item")
  );
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function removeWithRetries(targetPath, attempts = 8) {
  let lastError = null;

  for (let i = 0; i < attempts; i += 1) {
    try {
      await fs.rm(targetPath, {
        recursive: true,
        force: true,
        maxRetries: 8,
        retryDelay: 200,
      });
      if (!(await exists(targetPath))) {
        return true;
      }
    } catch (error) {
      lastError = error;
      if (!isLockError(error)) {
        throw error;
      }
    }

    await sleep(250 * (i + 1));
  }

  if (lastError) {
    throw lastError;
  }

  return !(await exists(targetPath));
}

function runPowerShell(command, timeoutMs = 15000) {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
    {
      cwd: rootDir,
      encoding: "utf8",
      timeout: timeoutMs,
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    const stdout = (result.stdout || "").trim();
    throw new Error(stderr || stdout || `PowerShell command failed with exit code ${result.status}`);
  }
}

function stopStrayNextNodeProcesses() {
  const killCommand = [
    "$patterns = @('next dev', 'next build', 'next\\dist\\bin\\next');",
    "$candidates = Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" |",
    "  Where-Object { $cmd = $_.CommandLine; $cmd -and ($patterns | Where-Object { $cmd -match $_ }) };",
    "foreach ($p in $candidates) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }",
  ].join(" ");

  runPowerShell(killCommand, 12000);
}

function removeNextDirViaPowerShell() {
  const command = "if (Test-Path -LiteralPath '.next') { Remove-Item -LiteralPath '.next' -Recurse -Force -ErrorAction Stop }";
  runPowerShell(command, 25000);
}

function repairNextPermissionsWindows() {
  const command = [
    "if (Test-Path -LiteralPath '.next') {",
    "  cmd /c \"attrib -R .next\\* /S /D\" | Out-Null;",
    "  cmd /c \"icacls .next /grant %USERNAME%:(OI)(CI)F /T /C\" | Out-Null;",
    "}",
  ].join(" ");

  runPowerShell(command, 25000);
}

async function main() {
  if (!(await exists(nextDir))) {
    console.log("[prepare-next-build] No .next directory found. Skipping cleanup.");
    return;
  }

  console.log("[prepare-next-build] Cleaning .next before build...");

  if (process.platform === "win32") {
    try {
      if (isCiMode) {
        console.log("[prepare-next-build] CI mode: stopping stray Next.js node processes...");
        stopStrayNextNodeProcesses();
      }

      removeNextDirViaPowerShell();
    } catch (error) {
      if (isWindowsLockMessage(error && error.message ? error.message : error)) {
        console.warn("[prepare-next-build] Detected lock on .next files. Stopping stray Next.js node processes and retrying...");
        stopStrayNextNodeProcesses();
        repairNextPermissionsWindows();
        await sleep(600);
        removeNextDirViaPowerShell();
      } else {
        throw error;
      }
    }
  }

  await removeWithRetries(nextDir, 10);

  if (await exists(nextDir)) {
    const traceExists = await exists(traceFile);
    throw new Error(
      traceExists
        ? "Failed to remove .next (likely file lock on .next/trace). Stop running dev/build servers and retry."
        : "Failed to remove .next directory completely. A process may still be holding files."
    );
  }

  console.log("[prepare-next-build] .next cleanup complete.");
}

main().catch((error) => {
  console.error("[prepare-next-build] Cleanup failed:", error.message || error);
  process.exit(1);
});
