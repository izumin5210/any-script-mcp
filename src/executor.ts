import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";
import type { ToolConfig } from "./config.js";

export async function executeCommand(
  config: ToolConfig,
  inputs: Record<string, unknown>,
): Promise<string> {
  // Write to temporary file
  const tmpFile = path.join(
    tmpdir(),
    `script-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await writeFile(tmpFile, config.run, { mode: 0o700 });

  try {
    // Prepare environment variables (with INPUTS__ prefix)
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(inputs)) {
      // Convert key name to uppercase (hyphens to underscores)
      const envKey = `INPUTS__${key.toUpperCase().replace(/-/g, "_")}`;
      env[envKey] = String(value);
    }

    // Also provide inputs as JSON to preserve type information
    env["INPUTS_JSON"] = JSON.stringify(inputs);

    // Replace all {0} placeholders with the script file path
    const command = config.shell.replaceAll("{0}", tmpFile);

    // Execute with execa
    const result = await execa(command, {
      env: { ...process.env, ...env },
      shell: true,
      timeout: config.timeout,
      maxBuffer: 10 * 1024 * 1024,
    });

    return result.stdout;
  } finally {
    // Delete temporary file
    await rm(tmpFile, { force: true });
  }
}
