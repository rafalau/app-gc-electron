-- CreateTable
CREATE TABLE "Leilao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo_evento" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "condicoes_de_pagamento" TEXT NOT NULL DEFAULT '',
    "usa_dolar" BOOLEAN NOT NULL DEFAULT false,
    "cotacao" REAL,
    "multiplicador" REAL NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);
