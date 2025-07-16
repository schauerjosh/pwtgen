#!/bin/bash
# Build, link, and set executable permissions for pwtgen CLI
npm run build && npm link && chmod +x dist/cli.js
