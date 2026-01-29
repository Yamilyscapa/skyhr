#!/bin/bash
set -euo pipefail

# Modify root package.json to only include mobile workspace
# This prevents bun from trying to install other workspace dependencies
# EAS Build uses npm/yarn, so we remove the Bun packageManager specification
echo "🔧 Running pre-install hook to configure monorepo for EAS Build..."

cd "$(dirname "$0")/../.." || {
  echo "❌ Failed to change to project root directory"
  exit 1
}

if [ ! -f "package.json" ]; then
  echo "⚠️  package.json not found, skipping modification"
  exit 0
fi

# Backup original package.json
if [ -f "package.json.backup" ]; then
  echo "⚠️  Backup already exists, skipping backup creation"
else
  cp package.json package.json.backup
  echo "✅ Backed up original package.json"
fi

# Remove bun.lock and bun.lockb to prevent EAS from detecting Bun
if [ -f "bun.lock" ]; then
  echo "⚠️  Removing bun.lock to prevent EAS from using Bun"
  rm -f bun.lock
  echo "✅ Removed bun.lock"
fi

if [ -f "bun.lockb" ]; then
  echo "⚠️  Removing bun.lockb to prevent EAS from using Bun"
  rm -f bun.lockb
  echo "✅ Removed bun.lockb"
fi

# Remove package-lock.json if it exists (it may reference all workspaces)
# npm will regenerate it with only mobile workspace dependencies
if [ -f "package-lock.json" ]; then
  echo "⚠️  Removing package-lock.json to regenerate for mobile workspace only"
  rm -f package-lock.json
  echo "✅ Removed package-lock.json"
fi

# Create a modified package.json with only mobile workspace
# Note: Removed packageManager field to let EAS use npm/yarn
cat > package.json <<'EOF'
{
  "name": "my-turborepo",
  "private": true,
  "workspaces": [
    "apps/mobile"
  ],
  "version": "1.0.0"
}
EOF

echo "✅ Modified package.json to only include apps/mobile workspace"
echo "✅ Removed Bun packageManager specification (EAS will use npm/yarn)"
echo "✨ Pre-install hook completed successfully"

