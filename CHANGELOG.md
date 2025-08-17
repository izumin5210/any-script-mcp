# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-08-17

### Added
- Support for multiple configuration file paths via `ANY_SCRIPT_MCP_CONFIG` environment variable, using platform-specific path delimiters (`:` for Unix/macOS, `;` for Windows) ([#5](https://github.com/izumin5210/any-script-mcp/pull/5))
- Configurable timeout for tool execution with default value of 5 minutes (300000ms) ([#6](https://github.com/izumin5210/any-script-mcp/pull/6))

## [0.0.1] - 2025-08-11

### Added
- Initial release
- MCP server implementation for exposing arbitrary CLI tools and shell scripts as MCP Tools via YAML configuration
- Dynamic Zod input schema generation for validation
- Environment variable based parameter passing with `INPUTS__` prefix
- Command execution with `execa` featuring error handling and proper bash script creation
- XDG Base Directory support for configuration file location