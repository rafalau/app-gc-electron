# Build Windows

Este app Electron já está preparado para gerar pacote Windows com `electron-builder`.

## O que já existe

- script de build Windows no [`package.json`](/home/rafalau/Projetos/Apps/app-gc-electron/apps/electron/package.json)
- configuração do instalador NSIS em [`electron-builder.yml`](/home/rafalau/Projetos/Apps/app-gc-electron/apps/electron/electron-builder.yml)
- helper nativo do player SRT para Windows em [`srt-player-win.exe`](/home/rafalau/Projetos/Apps/app-gc-electron/apps/electron/resources/bin/srt-player-win.exe)
- runtime do `mpv` para Windows em [`resources/runtime/mpv/win32`](/home/rafalau/Projetos/Apps/app-gc-electron/apps/electron/resources/runtime/mpv/win32)

## Pré-requisitos no Windows

1. Instalar `Node.js` LTS.
2. Instalar dependências do monorepo com `npm install` na raiz do projeto.
3. Confirmar que estes arquivos existem:
   - `apps/electron/resources/bin/srt-player-win.exe`
   - `apps/electron/resources/runtime/mpv/win32/mpv.exe`

## Gerar build local

Na raiz do projeto:

```bash
npm -w apps/electron run build:win
```

Esse comando faz:

1. `typecheck`
2. build do Electron/Vite
3. `electron-builder --win`

## Onde sai o resultado

Normalmente o `electron-builder` gera os arquivos em:

```text
apps/electron/dist/
```

Os nomes podem variar, mas o esperado é algo como:

- `electron-app-1.0.0-setup.exe`
- pasta/artefatos auxiliares do Windows

## Teste recomendado

Depois de gerar:

1. abrir o instalador `.exe`
2. instalar normalmente
3. abrir o app instalado
4. validar a tela de operação
5. validar o player SRT embutido no Windows
6. validar áudio, mute/unmute e modais

## Instalador e menu iniciar

Sim, é possível deixar isso bem acabado.

O projeto já está usando `NSIS`, então mais para frente dá para configurar:

- instalador com nome final do produto
- ícone do app
- atalho na área de trabalho
- entrada no menu Iniciar
- nome em `Arquivos de Programas`
- desinstalador

Hoje o [`electron-builder.yml`](/home/rafalau/Projetos/Apps/app-gc-electron/apps/electron/electron-builder.yml) já tem base para isso:

- `nsis`
- `shortcutName`
- `uninstallDisplayName`
- `createDesktopShortcut: always`

Quando o app estiver fechado, o próximo acabamento natural é:

1. definir `productName` final
2. trocar `appId`
3. adicionar `icon.ico`
4. ajustar nome do executável
5. revisar nome do instalador
6. validar instalação limpa em Windows

## Observação importante

O helper Windows e o runtime já estão presentes no projeto, mas a validação real ainda precisa ser feita em uma máquina Windows. Ou seja: a estrutura está pronta para empacotar, mas o teste final no Windows ainda faz parte da entrega.

## Troubleshooting rápido

Se o `npm` mostrar apenas `Lifecycle script failed`, separe o build em etapas para ver a falha real:

```bash
npm -w apps/electron run typecheck
```

```bash
npm -w apps/electron run build:host
```

```bash
npm -w apps/electron run install-app-deps
```

```bash
cross-env APP_MODE=HOST npm -w apps/electron exec electron-builder --win --config electron-builder.host.yml
```

Neste projeto, a causa mais comum no Windows é o rebuild de dependência nativa usado pelo Prisma (`better-sqlite3`). Se `install-app-deps` falhar, verifique:

1. se `npm install` foi executado no próprio Windows
2. se `npm run prisma:generate` foi executado na raiz
3. se a máquina tem Visual Studio Build Tools com C++ e Python
