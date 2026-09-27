#!/usr/bin/env bash
# Regenerates /docs from the dynamo library checkout (default: ../dynamo).
# Usage: ./build-docs.sh [path-to-dynamo]
set -euo pipefail
LIB="${1:-../dynamo}"
( cd "$LIB" && mix docs --formatter html >/dev/null )
rm -rf docs
cp -R "$LIB/doc" docs
rm -f docs/*.epub
echo "docs updated from $(git -C "$LIB" rev-parse --short HEAD) ($(git -C "$LIB" rev-parse --abbrev-ref HEAD))"
