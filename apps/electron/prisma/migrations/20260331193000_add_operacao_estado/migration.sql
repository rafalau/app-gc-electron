CREATE TABLE "OperacaoEstado" (
    "leilao_id" TEXT NOT NULL PRIMARY KEY,
    "animal_id" TEXT,
    "layout_modo" TEXT NOT NULL DEFAULT 'AGREGADAS',
    "lance_atual" TEXT NOT NULL DEFAULT '0,00',
    "lance_atual_centavos" INTEGER NOT NULL DEFAULT 0,
    "lance_dolar" TEXT NOT NULL DEFAULT '0,00',
    "total_real" TEXT NOT NULL DEFAULT '0,00',
    "total_dolar" TEXT NOT NULL DEFAULT '0,00',
    "atualizado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperacaoEstado_leilao_id_fkey" FOREIGN KEY ("leilao_id") REFERENCES "Leilao" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
