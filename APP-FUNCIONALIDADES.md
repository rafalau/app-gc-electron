# APP GC Electron

## O que este app faz

O **APP GC Electron** e um aplicativo desktop para **operacao de leiloes com geracao de conteudo para GC/overlay**, integracao com **vMix**, suporte a **preview/monitor SRT** e sincronizacao entre uma maquina principal (**HOST**) e maquinas clientes (**REMOTO**).

O objetivo central do sistema e permitir que a equipe do leilao:

- cadastre eventos e seus animais;
- importe lotes de diferentes fontes;
- opere o leilao em tempo real;
- gere um JSON consumivel pelo vMix;
- sincronize a operacao com outra maquina na mesma rede;
- acompanhe video SRT dentro do proprio app.

## Estrutura geral do produto

O projeto e um monorepo Node com workspace principal em `apps/electron`, usando:

- **Electron** no desktop;
- **Vue 3 + TypeScript** no renderer;
- **Prisma + SQLite** para persistencia local;
- **electron-store** para configuracoes e estado de operacao;
- **HTTP local + SSE** para sincronizacao entre HOST e REMOTO;
- integracoes com **vMix**, **SRT**, **TBS** e **Remate360**.

## Modos de funcionamento

### 1. Modo HOST

No modo HOST o app:

- roda como maquina principal da operacao;
- abre um servidor HTTP local na porta `18452`;
- disponibiliza JSON da operacao para consumo externo;
- publica eventos em tempo real via SSE;
- permite importacao de planilhas locais;
- centraliza configuracoes de vMix e SRT;
- sincroniza telas e estado para clientes remotos.

O app detecta os IPs locais disponiveis e mostra URLs que podem ser usadas por outras maquinas e por sistemas externos.

### 2. Modo REMOTO

No modo REMOTO o app:

- pede o IP do HOST na tela de conexao;
- consome dados do servidor do HOST;
- replica leiloes, animais e estado da operacao;
- acompanha a operacao em tempo real;
- pode alterar o estado operacional, que e enviado ao HOST;
- bloqueia importacao local de Excel, que deve acontecer no HOST.

## Principais telas e fluxos

### Tela de conexao remota

Usada quando o app esta em modo REMOTO. Nela o operador informa o IP da maquina principal para que o aplicativo use esse mesmo endereco como base para:

- API do app;
- integracao com vMix;
- endpoint SRT.

### Tela inicial

Lista os leiloes/eventos cadastrados e permite:

- buscar eventos;
- criar novo evento;
- editar evento existente;
- excluir evento;
- abrir a tela de animais do evento;
- abrir a tela de operacao do evento.

Quando o app esta em:

- **HOST**: mostra o IP principal da maquina e permite copiar;
- **REMOTO**: mostra o host conectado e oferece opcao de desconectar.

### Tela do leilao

Cada leilao possui:

- titulo do evento;
- data;
- condicoes gerais de pagamento;
- opcao de usar dolar;
- cotacao do dolar;
- multiplicador do lote.

Nesta tela o usuario pode:

- listar e buscar animais;
- criar, editar e excluir animais;
- configurar o layout das informacoes do animal;
- abrir a edicao rapida;
- abrir o modo conferencia;
- abrir o modo operacao;
- apagar todos os animais do leilao;
- importar animais de diferentes origens.

### Tela de operacao

E o centro da operacao ao vivo. Nela o app permite:

- selecionar o animal/lote atual;
- visualizar dados principais do lote;
- digitar e confirmar lance;
- calcular total com multiplicador;
- calcular lance e total em dolar quando habilitado;
- editar rapidamente o animal em operacao;
- editar parametros do leilao sem sair da tela;
- gerar e sincronizar o JSON de operacao;
- abrir e configurar integracao com vMix;
- acionar o overlay no vMix;
- exibir/ocultar player SRT embutido;
- manter sincronizacao em tempo real com clientes remotos.

O estado da operacao salvo e composto por:

- animal selecionado;
- layout do animal;
- lance atual;
- valor em centavos;
- valor em dolar;
- total em reais;
- total em dolar.

### Edicao rapida

Abre uma janela separada para edicao em lote dos animais do leilao. Essa tela permite:

- editar varios animais em grade;
- salvar tudo de uma vez;
- detectar conflitos quando houve alteracao externa;
- sincronizar via SSE;
- cair para polling automatico quando SSE nao estiver disponivel.

Essa funcionalidade e importante para ajustes rapidos durante preparacao ou operacao.

### Tela de configuracoes

Hoje existe como ponto de entrada visual para configuracoes do sistema, especialmente para conexao, vMix, SRT e inputs GC. A maior parte das configuracoes efetivas fica integrada diretamente aos fluxos de operacao e ao store local.

## Gestao de leiloes

O sistema trabalha com a entidade **Leilao**, que guarda:

- titulo do evento;
- data;
- condicoes de pagamento;
- uso de dolar;
- cotacao;
- multiplicador;
- relacionamento com os animais;
- estado atual da operacao.

Isso permite que cada evento tenha configuracoes proprias e uma operacao isolada.

## Gestao de animais

Cada animal possui campos como:

- lote;
- nome;
- categoria;
- informacoes;
- genealogia;
- raca;
- sexo;
- pelagem;
- nascimento;
- idade;
- peso;
- proprietario/vendedor;
- condicoes de pagamento especificas;
- observacoes;
- condicoes de cobertura.

O app suporta dois formatos de exibicao dos dados:

- **AGREGADAS**: informacoes em bloco unico;
- **SEPARADAS**: raca, sexo, pelagem e nascimento em campos distintos.

Tambem existe configuracao para incluir a raca no texto de importacao quando o layout agregado for utilizado.

## Importacao de dados

O app importa animais de tres fontes principais:

### 1. Excel

Importacao manual de planilhas `.xls` e `.xlsx` pelo desktop. Disponivel apenas no HOST.

### 2. TBS

Consulta leiloes ativos no servico TBS e importa os animais do evento selecionado.

### 3. Remate360

Consulta eventos disponiveis no Remate360 e importa os dados para o leilao atual.

Depois de importar, o sistema:

- atualiza o banco local;
- recalcula as listagens;
- publica eventos de sincronizacao para telas abertas e clientes remotos;
- exibe resumo da importacao no front.

## Modo conferencia

Dentro da tela do leilao existe um modo de conferencia dos animais para revisao rapida do cadastro antes da operacao. Ele ajuda a validar o material importado ou editado.

## JSON para GC / overlay

Durante a operacao, o app gera um JSON acessivel por HTTP no formato:

- `http://IP_DO_HOST:18452/operacao/<leilaoId>.json`

Esse JSON inclui dados como:

- condicoes;
- lote;
- nome;
- informacoes;
- raca;
- sexo;
- pelagem;
- nascimento;
- genealogia;
- vendedor;
- pacotes de cobertura;
- lance;
- lance em dolar;
- total em reais;
- total em dolar.

Esse endpoint foi pensado para integracao com GC/overlay e consumo externo, especialmente pelo vMix.

## Integracao com vMix

O app possui suporte a vMix com configuracao de:

- ativacao da integracao;
- IP do vMix;
- porta da API;
- selecao de input.

Com isso ele consegue:

- consultar a API XML do vMix;
- listar os inputs disponiveis;
- salvar o input escolhido;
- acionar o overlay no input configurado.

Porta padrao usada pelo vMix no projeto:

- `8088`

## Integracao com SRT

O sistema possui duas frentes para SRT:

### 1. Preview interno

Usa `ffmpeg` para capturar o stream SRT e expor frames MJPEG via HTTP local. Esse preview e consumido pela interface para mostrar o retorno de video.

### 2. Player nativo embutido

O projeto tambem possui um player SRT nativo, com binarios e bibliotecas empacotadas, permitindo:

- preparar janela do player;
- definir bounds;
- controlar visibilidade;
- iniciar reproducao;
- parar reproducao;
- encerrar o player.

### 3. Monitor externo

O app tambem consegue abrir um monitor SRT externo via `vlc`, usando o endpoint configurado.

## Sincronizacao em tempo real

O app usa um servidor HTTP local no HOST e **Server-Sent Events (SSE)** para sincronizar:

- estado da operacao;
- alteracoes de leiloes;
- alteracoes de animais;
- layout de exibicao por leilao.

Quando um REMOTO altera algo operacional, a mudanca e enviada ao HOST. Quando o HOST altera dados, os eventos sao publicados para clientes conectados.

Existe ainda fallback para polling em janelas especificas, como a edicao rapida.

## Persistencia local

O projeto usa duas camadas principais de persistencia:

### 1. SQLite + Prisma

Banco local para armazenar:

- leiloes;
- animais;
- estado operacional por leilao.

As migrations sao aplicadas na inicializacao do app.

### 2. electron-store

Store local para guardar configuracoes de execucao, como:

- modo HOST/REMOTO;
- IP e porta da conexao;
- configuracao do vMix;
- configuracao de SRT;
- layout de animais por leilao;
- ultimo estado operacional por leilao.

## Empacotamento e variantes

O projeto tem configuracoes para build em diferentes variantes do Electron, incluindo arquivos de builder para:

- build padrao;
- build HOST;
- build REMOTO.

Isso indica que o app pode ser distribuido em versoes separadas conforme o papel operacional da maquina.

## Comandos principais do projeto

Na raiz do repositorio:

```bash
npm run dev
npm run dev:host
npm run dev:remoto
npm run build
npm run build:win:all
```

Comandos Prisma relevantes:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:migrate:deploy
```

## Resumo funcional

Em termos práticos, este app faz tudo isso:

- cadastra e gerencia eventos de leilao;
- cadastra, organiza e edita animais;
- importa animais por Excel, TBS e Remate360;
- permite edicao individual e edicao rapida em lote;
- sincroniza dados entre HOST e REMOTO;
- opera o leilao em tempo real com controle de lote e lance;
- calcula totais e conversao em dolar;
- gera JSON para GC/overlay;
- integra com vMix para acionar overlay;
- integra com SRT para preview e monitoramento;
- persiste configuracoes e estado localmente;
- suporta distribuicao separada para maquina principal e cliente remoto.

## Observacao

Este documento descreve o comportamento implementado atualmente no codigo do projeto em `04/04/2026`, com base nas telas, servicos, store local, schema Prisma e IPCs do app Electron.
