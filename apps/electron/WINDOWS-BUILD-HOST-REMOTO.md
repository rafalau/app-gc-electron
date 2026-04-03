# Build Windows Host + Remoto

Este projeto já pode gerar os dois instaladores Windows:

- `App GC Host`
- `App GC Remoto`

## Pré-requisitos

No Windows, na raiz do projeto:

1. Instalar `Node.js` LTS.
2. Abrir terminal na raiz do repositório.
3. Confirmar que estes arquivos existem:
   - `apps/electron/resources/bin/srt-player-win.exe`
   - `apps/electron/resources/runtime/mpv/win32/mpv.exe`

## Comandos

Instalar dependências:

```bash
npm install
```

Gerar client Prisma:

```bash
npm run prisma:generate
```

Gerar os dois instaladores Windows:

```bash
npm run build:win:all
```

## O que esse comando faz

Ele executa em sequência:

1. build Windows do `HOST`
2. build Windows do `REMOTO`

## Saída esperada

Os arquivos devem sair em:

```text
apps/electron/dist/
```

Os nomes esperados são:

- `app-gc-host-<versao>-setup.exe`
- `app-gc-remoto-<versao>-setup.exe`

## Comandos individuais

Se quiser gerar separado:

```bash
npm -w apps/electron run build:win:host
```

```bash
npm -w apps/electron run build:win:remoto
```

## Quando o npm mostra só "Lifecycle script failed"

Se o terminal mostrar apenas algo como:

- `Lifecycle script build:host failed`
- `Lifecycle script build:win:host failed`
- `Lifecycle script build:win:all failed`

isso normalmente quer dizer que o `npm` só propagou a falha de um comando interno.
Para descobrir a causa real, rode no Windows cada etapa separadamente:

```bash
npm -w apps/electron run typecheck
```

```bash
cross-env APP_MODE=HOST npm -w apps/electron exec electron-vite build
```

```bash
npm -w apps/electron run install-app-deps
```

```bash
cross-env APP_MODE=HOST npm -w apps/electron exec electron-builder --win --config electron-builder.host.yml
```

Depois repita para `REMOTO`:

```bash
cross-env APP_MODE=REMOTO npm -w apps/electron exec electron-vite build
```

```bash
cross-env APP_MODE=REMOTO npm -w apps/electron exec electron-builder --win --config electron-builder.remoto.yml
```

## Causa mais comum neste projeto

Este app usa Prisma com `@prisma/adapter-better-sqlite3`, então o passo mais sensível no Windows costuma ser:

```bash
npm -w apps/electron run install-app-deps
```

Se ele falhar, normalmente o problema é um destes:

1. `npm install` não foi refeito no Windows.
2. `npm run prisma:generate` não foi executado na raiz.
3. faltam ferramentas nativas do Windows para rebuild de dependência:
   - Visual Studio Build Tools com C++ desktop tools
   - Python
4. `node_modules` foi copiado de outro ambiente e ficou inconsistente.

## Sequência de recuperação recomendada

Na raiz do projeto, no Windows:

```bash
rmdir /s /q node_modules
```

```bash
npm install
```

```bash
npm run prisma:generate
```

```bash
npm -w apps/electron run build:win:host
```

Se ainda falhar, o log útil é o erro completo do primeiro comando que quebrar entre `install-app-deps` e `electron-builder --win`.
