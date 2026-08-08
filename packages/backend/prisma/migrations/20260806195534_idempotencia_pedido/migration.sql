-- AlterTable
ALTER TABLE "pedido" ADD COLUMN "idempotencia_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "pedido_idempotencia_key_key" ON "pedido"("idempotencia_key");

