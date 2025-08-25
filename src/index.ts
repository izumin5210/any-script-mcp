#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { type ConfigError, loadConfig } from "./config.js";
import { createServer } from "./server.js";

function printConfigErrorDetails(error: ConfigError): void {
  switch (error.type) {
    case "LOAD_ERROR":
      console.error(`Failed to load config from: ${error.path}`);
      console.error(`Error: ${error.message}`);
      break;

    case "VALIDATION_ERROR":
      console.error(`Invalid configuration in: ${error.path}`);
      console.error("Validation errors:");
      error.issues.forEach((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "root";
        console.error(`- ${path}: ${issue.message}`);
      });
      break;

    case "MULTIPLE_ERRORS":
      console.error("Failed to load configuration from multiple files:");
      error.errors.forEach(({ error: fileError }) => {
        console.error("");
        printConfigErrorDetails(fileError);
      });
      break;
  }
}

function printConfigError(error: ConfigError): void {
  console.error("Configuration Error:\n");
  printConfigErrorDetails(error);
  console.error(
    "\nSee documentation at: https://github.com/izumin5210/any-script-mcp",
  );
}

async function main() {
  // Load configuration file
  const result = await loadConfig();

  if (!result.ok) {
    printConfigError(result.error);
    process.exit(1);
  }

  const server = await createServer(result.value);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
