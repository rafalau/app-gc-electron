-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leilao_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "lote" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT '',
    "raca" TEXT NOT NULL DEFAULT '',
    "sexo" TEXT NOT NULL DEFAULT '',
    "idade" TEXT NOT NULL DEFAULT '',
    "peso" TEXT NOT NULL DEFAULT '',
    "proprietario" TEXT NOT NULL DEFAULT '',
    "observacoes" TEXT NOT NULL DEFAULT '',
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "Animal_leilao_id_fkey" FOREIGN KEY ("leilao_id") REFERENCES "Leilao" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Animal_leilao_id_ordem_idx" ON "Animal"("leilao_id", "ordem");
