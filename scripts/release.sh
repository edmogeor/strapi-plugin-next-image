#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.2.0"
  exit 1
fi

# Strip leading "v" if provided
VERSION="${VERSION#v}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Validate semver (loose check)
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
  echo "Error: '$VERSION' is not a valid semver version."
  exit 1
fi

echo "Bumping to v$VERSION..."
echo ""

# Update version in both packages
for pkg in "$ROOT"/packages/*/package.json; do
  name=$(grep -o '"name": *"[^"]*"' "$pkg" | head -1 | sed 's/"name": *"//' | sed 's/"//')
  sed -i "s/\"version\": *\"[^\"]*\"/\"version\": \"$VERSION\"/" "$pkg"
  echo "  Updated $name -> $VERSION"
done

echo ""
echo "Files changed:"
git -C "$ROOT" diff --name-only
echo ""

read -rp "Commit, tag v$VERSION, and push? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

git -C "$ROOT" add -A
git -C "$ROOT" commit -m "chore: release v$VERSION"
git -C "$ROOT" tag "v$VERSION"
git -C "$ROOT" push
git -C "$ROOT" push --tags

echo ""
echo "Released v$VERSION"
