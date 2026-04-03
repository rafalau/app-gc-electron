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
