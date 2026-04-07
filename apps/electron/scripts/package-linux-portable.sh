#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"

if [[ "$MODE" != "HOST" && "$MODE" != "REMOTO" ]]; then
  echo "Uso: $0 HOST|REMOTO" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_ROOT/../.." && pwd)"
DIST_DIR="$APP_ROOT/dist"
RUNTIME_SOURCE="$REPO_ROOT/node_modules/electron/dist"
APP_NODE_MODULES_SOURCE="$APP_ROOT/node_modules"
ROOT_NODE_MODULES_SOURCE="$REPO_ROOT/node_modules"
if [[ "$MODE" == "HOST" ]]; then
  PACKAGE_DIR="$DIST_DIR/app-gc-linux-host"
  TAR_NAME="app-gc-linux-host.tar.gz"
  PRODUCT_NAME="APP GC Vmix Host"
  EXEC_NAME="run-app-gc-host.sh"
  DESKTOP_NAME="app-gc-vmix-host.desktop"
  COMMENT="Operacao principal do APP GC Vmix"
  ICON_SOURCE="$APP_ROOT/resources/icon-host.png"
else
  PACKAGE_DIR="$DIST_DIR/app-gc-linux-remoto"
  TAR_NAME="app-gc-linux-remoto.tar.gz"
  PRODUCT_NAME="APP GC Vmix Remoto"
  EXEC_NAME="run-app-gc-remoto.sh"
  DESKTOP_NAME="app-gc-vmix-remoto.desktop"
  COMMENT="Cliente remoto do APP GC Vmix"
  ICON_SOURCE="$APP_ROOT/resources/icon-remoto.png"
fi

rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR/app" "$PACKAGE_DIR/app/node_modules" "$PACKAGE_DIR/runtime"

cp -a "$RUNTIME_SOURCE/." "$PACKAGE_DIR/runtime/"
cp -a "$APP_ROOT/out" "$PACKAGE_DIR/app/"
cp -a "$APP_ROOT/package.json" "$PACKAGE_DIR/app/"
cp -a "$APP_ROOT/prisma" "$PACKAGE_DIR/app/"
cp -a "$APP_ROOT/resources" "$PACKAGE_DIR/app/"
cp -a "$APP_NODE_MODULES_SOURCE/." "$PACKAGE_DIR/app/node_modules/"
cp -a "$ROOT_NODE_MODULES_SOURCE/." "$PACKAGE_DIR/app/node_modules/"
cp -a "$ICON_SOURCE" "$PACKAGE_DIR/icon.png"

cat > "$PACKAGE_DIR/$EXEC_NAME" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/app"
RUNTIME_DIR="$SCRIPT_DIR/runtime"
export APP_GC_PORTABLE=1
cd "$SCRIPT_DIR"
exec "$RUNTIME_DIR/electron" "$APP_DIR"
EOF

cat > "$PACKAGE_DIR/$DESKTOP_NAME" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=$PRODUCT_NAME
Comment=$COMMENT
Exec=__PACKAGE_DIR__/$EXEC_NAME
Icon=__PACKAGE_DIR__/icon.png
Terminal=false
Categories=Utility;
StartupWMClass=$PRODUCT_NAME
EOF

cat > "$PACKAGE_DIR/install-desktop-entry.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "\$HOME/.local/share/applications"
sed "s|__PACKAGE_DIR__|\$SCRIPT_DIR|g" "\$SCRIPT_DIR/$DESKTOP_NAME" > "\$HOME/.local/share/applications/$DESKTOP_NAME"
chmod +x "\$HOME/.local/share/applications/$DESKTOP_NAME"
echo "Atalho instalado em \$HOME/.local/share/applications/$DESKTOP_NAME"
EOF

chmod +x "$PACKAGE_DIR/$EXEC_NAME" "$PACKAGE_DIR/install-desktop-entry.sh"

tar -czf "$DIST_DIR/$TAR_NAME" -C "$DIST_DIR" "$(basename "$PACKAGE_DIR")"
