#!/bin/bash
set -euo pipefail

# Clear Turborepo cache to prevent stale JavaScript bundles
# This ensures production builds always use fresh code
echo "🧹 Clearing Turborepo cache..."

cd "$(dirname "$0")/../.." || exit 1

# Remove Turborepo cache
if [ -d ".turbo" ]; then
  rm -rf .turbo
  echo "✅ Removed .turbo cache directory"
fi

# Remove mobile app caches
if [ -d "apps/mobile/.expo" ]; then
  rm -rf apps/mobile/.expo
  echo "✅ Removed apps/mobile/.expo cache"
fi

if [ -d "apps/mobile/dist" ]; then
  rm -rf apps/mobile/dist
  echo "✅ Removed apps/mobile/dist cache"
fi

# Remove node_modules caches
if [ -d "node_modules/.cache" ]; then
  rm -rf node_modules/.cache
  echo "✅ Removed node_modules/.cache"
fi

if [ -d "apps/mobile/node_modules/.cache" ]; then
  rm -rf apps/mobile/node_modules/.cache
  echo "✅ Removed apps/mobile/node_modules/.cache"
fi

echo "✨ Cache cleared successfully. Starting fresh build..."


