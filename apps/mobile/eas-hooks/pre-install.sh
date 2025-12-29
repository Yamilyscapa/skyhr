#!/bin/bash
set -euo pipefail

# Modify root package.json to only include mobile workspace
# This prevents bun from trying to install other workspace dependencies
cd "$(dirname "$0")/../.." || exit 1

if [ -f "package.json" ]; then
  # Backup original package.json
  cp package.json package.json.backup
  
  # Create a modified package.json with only mobile workspace
  cat > package.json <<'EOF'
{
  "name": "my-turborepo",
  "private": true,
  "packageManager": "bun@1.2.13",
  "workspaces": [
    "apps/mobile"
  ],
  "version": "1.0.0"
}
EOF
fi

