#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$APP_ROOT/dist"
USB_DIR="$DIST_DIR/usb-zorin-local-opt"

if [[ ! -f "$DIST_DIR/app-gc-linux-host.tar.gz" || ! -f "$DIST_DIR/app-gc-linux-remoto.tar.gz" ]]; then
  echo "Pacotes portateis host/remoto nao encontrados em $DIST_DIR" >&2
  exit 1
fi

rm -rf "$USB_DIR"
mkdir -p "$USB_DIR"

cp -a "$DIST_DIR/app-gc-linux-host.tar.gz" "$USB_DIR/"
cp -a "$DIST_DIR/app-gc-linux-remoto.tar.gz" "$USB_DIR/"

cat > "$USB_DIR/install-app-gc-linux.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST_ROOT="${HOME}/.local/opt"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

usage() {
  cat <<'TXT'
Uso:
  bash install-app-gc-linux.sh [host|remoto|all]

Sem argumento, instala ambos.
TXT
}

MODE="${1:-all}"

case "$MODE" in
  host|remoto|all)
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac

install_package() {
  local package_name="$1"
  local tar_name="${package_name}.tar.gz"
  local tar_path="${SCRIPT_DIR}/${tar_name}"
  local target_path="${DEST_ROOT}/${package_name}"
  local desktop_name=""

  case "$package_name" in
    app-gc-linux-host)
      desktop_name="app-gc-vmix-host.desktop"
      ;;
    app-gc-linux-remoto)
      desktop_name="app-gc-vmix-remoto.desktop"
      ;;
  esac

  if [[ ! -f "$tar_path" ]]; then
    echo "Arquivo nao encontrado: $tar_path" >&2
    exit 1
  fi

  echo "Instalando ${package_name} em ${target_path}"
  if [[ -n "$desktop_name" ]]; then
    rm -f "${HOME}/.local/share/applications/${desktop_name}"
  fi
  rm -rf "$target_path"
  mkdir -p "$DEST_ROOT"
  tar -xzf "$tar_path" -C "$TMP_DIR"
  cp -a "${TMP_DIR}/${package_name}" "$target_path"
  bash "${target_path}/install-desktop-entry.sh"
}

if [[ "$MODE" == "host" || "$MODE" == "all" ]]; then
  install_package "app-gc-linux-host"
fi

if [[ "$MODE" == "remoto" || "$MODE" == "all" ]]; then
  install_package "app-gc-linux-remoto"
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${HOME}/.local/share/applications" >/dev/null 2>&1 || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q "${HOME}/.local/share/icons" >/dev/null 2>&1 || true
fi

cat <<TXT

Instalacao concluida.

Pastas instaladas:
  ${DEST_ROOT}/app-gc-linux-host
  ${DEST_ROOT}/app-gc-linux-remoto

Atalhos criados em:
  ${HOME}/.local/share/applications
TXT
EOF

cat > "$USB_DIR/COMO-INSTALAR.txt" <<'EOF'
Pacote para instalar APP GC no Linux/Zorin em ~/.local/opt

Arquivos desta pasta:
- app-gc-linux-host.tar.gz
- app-gc-linux-remoto.tar.gz
- install-app-gc-linux.sh

Como usar na outra maquina:

1. Copie esta pasta inteira para o pen drive.
2. Na maquina Linux/Zorin, abra a pasta copiada do pen drive.
3. Rode no terminal:

   bash install-app-gc-linux.sh

Isso instala os dois aplicativos em:
- ~/.local/opt/app-gc-linux-host
- ~/.local/opt/app-gc-linux-remoto

E cria os atalhos do menu em:
- ~/.local/share/applications/app-gc-vmix-host.desktop
- ~/.local/share/applications/app-gc-vmix-remoto.desktop

Instalacao de apenas um aplicativo:

- Somente HOST:
  bash install-app-gc-linux.sh host

- Somente REMOTO:
  bash install-app-gc-linux.sh remoto

Depois da instalacao:

- Abra pelo menu do sistema procurando por:
  APP GC Vmix Host
  APP GC Vmix Remoto

- Ou rode direto:
  ~/.local/opt/app-gc-linux-host/run-app-gc-host.sh
  ~/.local/opt/app-gc-linux-remoto/run-app-gc-remoto.sh

Observacoes:

- Nao precisa de sudo.
- Se ja existir instalacao anterior nessas pastas, o script remove e reinstala.
- O script usa os arquivos .tar.gz desta mesma pasta, entao mantenha tudo junto.
EOF

chmod +x "$USB_DIR/install-app-gc-linux.sh"
tar -czf "$DIST_DIR/usb-zorin-local-opt.tar.gz" -C "$DIST_DIR" "$(basename "$USB_DIR")"
