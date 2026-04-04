# APP GC Electron

Aplicativo desktop para operacao de leiloes com integracao com vMix, suporte a SRT, geracao de JSON para GC/overlay e sincronizacao entre maquina HOST e maquinas REMOTO.

## O que o app faz

O sistema foi construido para apoiar a operacao de leiloes em ambiente real. Ele permite:

- cadastrar e gerenciar leiloes;
- cadastrar, editar e excluir animais;
- importar animais por Excel, TBS e Remate360;
- operar lote e lance em tempo real;
- calcular total por multiplicador e valores em dolar;
- gerar JSON de operacao para uso no GC/overlay;
- integrar com vMix para listar inputs e acionar overlay;
- usar preview/monitor SRT durante a operacao;
- sincronizar operacao e cadastros entre HOST e REMOTO.

## Modos de execucao

### HOST

Modo principal da operacao. No HOST o app:

- usa o banco local como fonte principal;
- sobe um servidor HTTP local na porta `18452`;
- publica endpoints de sincronizacao;
- gera o JSON da operacao;
- centraliza configuracao de vMix e SRT;
- permite importacao local de planilhas.

### REMOTO

Modo cliente. No REMOTO o app:

- se conecta ao IP do HOST;
- consome dados do HOST por HTTP;
- acompanha alteracoes em tempo real por SSE;
- replica a tela de operacao;
- envia alteracoes operacionais de volta ao HOST.

## Arquitetura

O projeto segue uma arquitetura de desktop app com separacao clara entre processo principal, bridge de seguranca e interface:

### 1. Main process

Responsavel por:

- ciclo de vida do Electron;
- registro de IPCs;
- acesso ao banco via Prisma;
- store local com `electron-store`;
- servidor HTTP local para sincronizacao;
- endpoints SSE para realtime;
- integracoes com vMix e SRT;
- abertura de janelas auxiliares.

Codigo principal em:

- `apps/electron/src/main`

### 2. Preload

Responsavel por expor APIs seguras do Electron para a interface via `contextBridge`.

Codigo em:

- `apps/electron/src/preload`

### 3. Renderer

Interface em Vue 3, com rotas e telas para:

- inicio;
- conexao remota;
- configuracoes;
- tela do leilao;
- tela de operacao;
- edicao rapida.

Codigo principal em:

- `apps/electron/src/renderer`

### 4. Persistencia

O projeto usa duas camadas:

- `Prisma + SQLite` para leiloes, animais e estado operacional;
- `electron-store` para modo de execucao, IP/porta, configuracao de vMix, SRT e layout por leilao.

Schema Prisma em:

- `apps/electron/prisma/schema.prisma`

### 5. Sincronizacao

No modo HOST, o app expoe:

- endpoints REST locais para leiloes, animais e operacao;
- endpoint JSON da operacao;
- eventos SSE para sincronizacao em tempo real.

Isso permite que a versao REMOTO acompanhe a operacao sem depender de backend externo.

## Stack e versoes

### Workspace raiz

- Node workspace: `app-gc-electron@1.0.0`
- Prisma: `^7.6.0`
- `@prisma/client`: `^7.6.0`
- `@prisma/adapter-better-sqlite3`: `^7.6.0`
- `xlsx`: `^0.18.5`
- `uuid`: `^13.0.0`

### App Electron

- Electron: `41.1.0`
- Electron Builder: `^26.8.1`
- Electron Vite: `^5.0.0`
- Vue: `^3.5.31`
- Vue Router: `^5.0.4`
- Vite: `^7.3.1`
- TypeScript: `^6.0.2`
- Tailwind CSS: `^4.2.2`
- electron-store: `^11.0.2`
- Font Awesome Free: `^7.2.0`

## Estrutura do repositorio

```text
app-gc-electron/
  apps/
    electron/
      src/
        main/
        preload/
        renderer/
      prisma/
      resources/
      electron-builder.yml
      electron-builder.host.yml
      electron-builder.remoto.yml
  package.json
  package-lock.json
  prisma.config.ts
```

## Requisitos

### Gerais

- Node.js LTS
- npm

### Para desenvolvimento e build local

- instalar dependencias na raiz;
- gerar o client Prisma;
- manter `node_modules` consistente com o sistema operacional onde o build sera gerado.

### Para build Windows

- Windows
- Node.js LTS
- build tools nativos quando necessarios para dependencias nativas

Se `install-app-deps` falhar, a causa mais comum neste projeto e rebuild de dependencia nativa do SQLite/Prisma no ambiente Windows.

### Para build Linux

- Linux
- Node.js LTS
- toolchain de compilacao padrao do sistema, quando necessario para dependencias nativas

## Instalacao

Na raiz do projeto:

```bash
npm install
```

Depois gere o client Prisma:

```bash
npm run prisma:generate
```

## Desenvolvimento

Na raiz do projeto:

```bash
npm run dev
```

Por padrao, `npm run dev` inicia em modo `HOST`.

Executar diretamente em modo HOST:

```bash
npm run dev:host
```

Executar diretamente em modo REMOTO:

```bash
npm run dev:remoto
```

## Banco de dados e migrations

Gerar client Prisma:

```bash
npm run prisma:generate
```

Rodar migration de desenvolvimento:

```bash
npm run prisma:migrate
```

Aplicar migrations em modo deploy:

```bash
npm run prisma:migrate:deploy
```

## Compilar para Windows

### Build padrao

Na raiz:

```bash
npm -w apps/electron run build:win
```

### Build HOST

```bash
npm -w apps/electron run build:win:host
```

### Build REMOTO

```bash
npm -w apps/electron run build:win:remoto
```

### Build dos dois instaladores

```bash
npm run build:win:all
```

### O que esses builds fazem

Os scripts de Windows executam, conforme a variante:

- preparacao do player SRT para Windows;
- typecheck;
- build com Electron Vite;
- `electron-builder --win`;
- uso dos arquivos de builder corretos para `HOST` e `REMOTO`.

### Saida esperada

Os artefatos sao gerados em:

```text
apps/electron/dist/
```

Arquivos esperados:

- instalador Windows da variante HOST;
- instalador Windows da variante REMOTO;
- artefatos auxiliares do `electron-builder`.

## Compilar para Linux

### Build padrao

Na raiz:

```bash
npm -w apps/electron run build:linux
```

### Build HOST

```bash
npm -w apps/electron run build:linux:host
```

### Build REMOTO

```bash
npm -w apps/electron run build:linux:remoto
```

### O que esses builds fazem

Os scripts de Linux executam:

- typecheck;
- build com Electron Vite;
- `electron-builder --linux`;
- uso dos arquivos de builder corretos para `HOST` e `REMOTO` quando aplicavel.

### Saida esperada

Os artefatos sao gerados em:

```text
apps/electron/dist/
```

## Endpoints e integracoes relevantes

### JSON da operacao

No HOST, cada leilao pode expor:

```text
http://IP_DO_HOST:18452/operacao/<leilaoId>.json
```

Esse JSON contem campos usados pelo GC/overlay, como:

- lote;
- nome;
- informacoes;
- raca;
- sexo;
- pelagem;
- nascimento;
- genealogia;
- vendedor;
- condicoes;
- lance;
- totais em real e dolar.

### vMix

O app consegue:

- consultar a API do vMix;
- listar inputs;
- salvar o input escolhido;
- acionar overlay no input configurado.

Porta padrao usada no projeto:

- `8088`

### SRT

O projeto suporta:

- preview interno via `ffmpeg`;
- player SRT embutido;
- monitor externo via `vlc`.

## Arquivos importantes

- `package.json`
- `apps/electron/package.json`
- `apps/electron/electron-builder.yml`
- `apps/electron/electron-builder.host.yml`
- `apps/electron/electron-builder.remoto.yml`
- `apps/electron/WINDOWS-BUILD.md`
- `apps/electron/WINDOWS-BUILD-HOST-REMOTO.md`
- `APP-FUNCIONALIDADES.md`

## Observacoes

- O README principal foi escrito para ser a apresentacao do repositorio no GitHub.
- O arquivo `APP-FUNCIONALIDADES.md` pode ser usado como documentacao complementar mais funcional do produto.
