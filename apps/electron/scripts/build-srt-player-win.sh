#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT_DIR/native/srt_player_win.cpp"
OUT_DIR="$ROOT_DIR/resources/bin"
OUT="$OUT_DIR/srt-player-win.exe"

mkdir -p "$OUT_DIR"

x86_64-w64-mingw32-g++ \
  -std=c++17 \
  -O2 \
  "$SRC" \
  -o "$OUT" \
  -lgdi32 \
  -luser32

echo "Built $OUT"
