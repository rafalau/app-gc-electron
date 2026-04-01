#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT_DIR/native/srt_player_linux.cpp"
OUT_DIR="$ROOT_DIR/resources/bin"
OUT="$OUT_DIR/srt-player-linux"

mkdir -p "$OUT_DIR"

g++ \
  -std=c++17 \
  -O2 \
  "$SRC" \
  -o "$OUT" \
  $(pkg-config --cflags --libs x11)

echo "Built $OUT"
