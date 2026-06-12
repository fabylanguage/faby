#!/bin/sh
# Faby installer — downloads the standalone faby binary (no Node required).
#   curl -fsSL https://faby.codes/install.sh | sh
set -e

BASE="https://faby.codes/releases"
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS-$ARCH" in
  Darwin-arm64)          BIN="faby-macos-arm64" ;;
  Linux-x86_64|Linux-amd64) BIN="faby-linux-x64" ;;
  *)
    echo "No prebuilt Faby binary for $OS-$ARCH yet."
    echo "Install via npm instead:  npm i -g @fabycode/cli"
    exit 1 ;;
esac

DEST_DIR="${FABY_INSTALL:-/usr/local/bin}"
DEST="$DEST_DIR/faby"
TMP="$(mktemp)"

echo "Faby — downloading $BIN ..."
curl -fsSL "$BASE/$BIN" -o "$TMP"
chmod +x "$TMP"

if mkdir -p "$DEST_DIR" 2>/dev/null && mv "$TMP" "$DEST" 2>/dev/null; then
  :
else
  echo "Elevated permissions needed to write $DEST"
  sudo mkdir -p "$DEST_DIR"
  sudo mv "$TMP" "$DEST"
fi

echo "✓ Installed: $("$DEST" version)"
echo ""
echo "  Try it:"
echo "    faby init hello && faby run hello/main.fy"
echo ""
echo "  Docs: https://faby.codes/docs   CLI: https://faby.codes/cli"
