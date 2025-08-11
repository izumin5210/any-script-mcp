import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";
import type { ToolConfig } from "./config.js";

export async function executeCommand(
  config: ToolConfig,
  inputs: Record<string, unknown>,
): Promise<string> {
  // Add script header
  const fullScript = `#!/usr/bin/env bash
set -euo pipefail
${config.run}`;

  // Write to temporary file
  const tmpFile = path.join(
    tmpdir(),
    `script-${Date.now()}-${Math.random().toString(36).slice(2)}.sh`,
  );
  await writeFile(tmpFile, fullScript, { mode: 0o700 });

  try {
    // Prepare environment variables (with INPUTS__ prefix)
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(inputs)) {
      // Convert key name to uppercase (hyphens to underscores)
      const envKey = `INPUTS__${key.toUpperCase().replace(/-/g, "_")}`;
      env[envKey] = String(value);
    }

    // Execute with execa
    const result = await execa(tmpFile, {
      env: { ...process.env, ...env },
      shell: false,
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    return result.stdout;
  } finally {
    // Delete temporary file
    await rm(tmpFile, { force: true });
  }
}
