-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_producto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoria_id" INTEGER NOT NULL,
    "nombre_es" TEXT NOT NULL,
    "nombre_en" TEXT,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "agotado" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "es_envase" BOOLEAN NOT NULL DEFAULT false,
    "va_a_cocina" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "producto_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_producto" ("activo", "agotado", "categoria_id", "descripcion", "es_envase", "id", "nombre_en", "nombre_es", "orden") SELECT "activo", "agotado", "categoria_id", "descripcion", "es_envase", "id", "nombre_en", "nombre_es", "orden" FROM "producto";
DROP TABLE "producto";
ALTER TABLE "new_producto" RENAME TO "producto";
CREATE INDEX "producto_activo_orden_idx" ON "producto"("activo", "orden");
CREATE UNIQUE INDEX "producto_categoria_id_nombre_es_key" ON "producto"("categoria_id", "nombre_es");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
