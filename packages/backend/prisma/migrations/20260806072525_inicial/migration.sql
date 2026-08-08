-- CreateTable
CREATE TABLE "usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "color_hex" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" DATETIME
);

-- CreateTable
CREATE TABLE "turno" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha" TEXT NOT NULL,
    "abierto_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abierto_por_id" INTEGER NOT NULL,
    "cerrado_en" DATETIME,
    "cerrado_por_id" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    CONSTRAINT "turno_abierto_por_id_fkey" FOREIGN KEY ("abierto_por_id") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "turno_cerrado_por_id_fkey" FOREIGN KEY ("cerrado_por_id") REFERENCES "usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "turno_mesera" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "turno_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "hora_entrada" DATETIME NOT NULL,
    "hora_salida" DATETIME,
    CONSTRAINT "turno_mesera_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "turno_mesera_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "categoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "producto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoria_id" INTEGER NOT NULL,
    "nombre_es" TEXT NOT NULL,
    "nombre_en" TEXT,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "agotado" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "es_envase" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "producto_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "variante" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "producto_id" INTEGER NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "precio_colones" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "variante_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "grupo_opcion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "obligatorio" BOOLEAN NOT NULL DEFAULT false,
    "min_sel" INTEGER NOT NULL DEFAULT 0,
    "max_sel" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "opcion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "grupo_opcion_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio_extra" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "opcion_grupo_opcion_id_fkey" FOREIGN KEY ("grupo_opcion_id") REFERENCES "grupo_opcion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "producto_grupo" (
    "producto_id" INTEGER NOT NULL,
    "grupo_opcion_id" INTEGER NOT NULL,

    PRIMARY KEY ("producto_id", "grupo_opcion_id"),
    CONSTRAINT "producto_grupo_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "producto_grupo_grupo_opcion_id_fkey" FOREIGN KEY ("grupo_opcion_id") REFERENCES "grupo_opcion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cuenta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "turno_id" INTEGER NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'SALON',
    "nombre_cliente" TEXT NOT NULL,
    "referencia" TEXT,
    "telefono" TEXT,
    "hora_retiro" DATETIME,
    "mesera_responsable_id" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "abierta_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerrada_en" DATETIME,
    "abierta_por_id" INTEGER NOT NULL,
    CONSTRAINT "cuenta_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cuenta_mesera_responsable_id_fkey" FOREIGN KEY ("mesera_responsable_id") REFERENCES "usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cuenta_abierta_por_id_fkey" FOREIGN KEY ("abierta_por_id") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "comensal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cuenta_id" INTEGER NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "comensal_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuenta" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pedido" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cuenta_id" INTEGER NOT NULL,
    "dia" TEXT NOT NULL,
    "consecutivo_dia" INTEGER NOT NULL,
    "creado_por_id" INTEGER NOT NULL,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'ENVIADO',
    "es_agregado" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "pedido_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuenta" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pedido_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pedido_linea" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pedido_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "variante_id" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unit_snapshot" INTEGER NOT NULL,
    "nota" TEXT,
    "para_llevar" BOOLEAN NOT NULL DEFAULT false,
    "anulada" BOOLEAN NOT NULL DEFAULT false,
    "estado_linea" TEXT NOT NULL DEFAULT 'ENVIADO',
    CONSTRAINT "pedido_linea_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pedido_linea_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedido_linea_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "variante" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "linea_opcion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "linea_id" INTEGER NOT NULL,
    "opcion_id" INTEGER NOT NULL,
    "nombre_snapshot" TEXT NOT NULL,
    "precio_extra_snapshot" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "linea_opcion_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "pedido_linea" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "linea_opcion_opcion_id_fkey" FOREIGN KEY ("opcion_id") REFERENCES "opcion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "linea_comensal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "linea_id" INTEGER NOT NULL,
    "comensal_id" INTEGER NOT NULL,
    "fraccion" REAL NOT NULL DEFAULT 1,
    CONSTRAINT "linea_comensal_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "pedido_linea" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "linea_comensal_comensal_id_fkey" FOREIGN KEY ("comensal_id") REFERENCES "comensal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cuenta_id" INTEGER,
    "pedido_id" INTEGER,
    "linea_id" INTEGER,
    "usuario_id" INTEGER NOT NULL,
    "accion" TEXT NOT NULL,
    "antes_json" TEXT,
    "despues_json" TEXT,
    "motivo" TEXT,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auditoria_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuenta" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "auditoria_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "auditoria_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "pedido_linea" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "descuento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cuenta_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "autorizado_por_id" INTEGER NOT NULL,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "descuento_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuenta" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "descuento_autorizado_por_id_fkey" FOREIGN KEY ("autorizado_por_id") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "division" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cuenta_id" INTEGER NOT NULL,
    "modo" TEXT NOT NULL,
    "n_partes" INTEGER,
    CONSTRAINT "division_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuenta" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pago" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cuenta_id" INTEGER NOT NULL,
    "division_id" INTEGER,
    "parte_num" INTEGER,
    "monto" INTEGER NOT NULL,
    "forma_pago" TEXT NOT NULL,
    "registrado_por_id" INTEGER NOT NULL,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pago_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuenta" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pago_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "division" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pago_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cierre_dia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "turno_id" INTEGER NOT NULL,
    "total_salon" INTEGER NOT NULL,
    "total_para_llevar" INTEGER NOT NULL,
    "total_envases" INTEGER NOT NULL,
    "total_descuentos" INTEGER NOT NULL,
    "regla_aplicada" TEXT NOT NULL,
    "n_meseras" INTEGER NOT NULL,
    "desglose_json" TEXT NOT NULL,
    "generado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cierre_dia_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cierre_mesera" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cierre_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "horas_trabajadas" REAL NOT NULL,
    "ventas_atribuidas" INTEGER NOT NULL,
    "monto_atribucion" INTEGER NOT NULL,
    "monto_horas" INTEGER NOT NULL,
    "monto_partes_iguales" INTEGER NOT NULL,
    CONSTRAINT "cierre_mesera_cierre_id_fkey" FOREIGN KEY ("cierre_id") REFERENCES "cierre_dia" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cierre_mesera_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "configuracion" (
    "clave" TEXT NOT NULL PRIMARY KEY,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_nombre_key" ON "usuario"("nombre");

-- CreateIndex
CREATE INDEX "usuario_activo_rol_idx" ON "usuario"("activo", "rol");

-- CreateIndex
CREATE INDEX "turno_fecha_estado_idx" ON "turno"("fecha", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "turno_mesera_turno_id_usuario_id_key" ON "turno_mesera"("turno_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_codigo_key" ON "categoria"("codigo");

-- CreateIndex
CREATE INDEX "producto_activo_orden_idx" ON "producto"("activo", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "producto_categoria_id_nombre_es_key" ON "producto"("categoria_id", "nombre_es");

-- CreateIndex
CREATE UNIQUE INDEX "variante_producto_id_etiqueta_key" ON "variante"("producto_id", "etiqueta");

-- CreateIndex
CREATE UNIQUE INDEX "grupo_opcion_codigo_key" ON "grupo_opcion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "opcion_grupo_opcion_id_nombre_key" ON "opcion"("grupo_opcion_id", "nombre");

-- CreateIndex
CREATE INDEX "cuenta_turno_id_estado_idx" ON "cuenta"("turno_id", "estado");

-- CreateIndex
CREATE INDEX "cuenta_estado_canal_idx" ON "cuenta"("estado", "canal");

-- CreateIndex
CREATE INDEX "pedido_estado_creado_en_idx" ON "pedido"("estado", "creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "pedido_dia_consecutivo_dia_key" ON "pedido"("dia", "consecutivo_dia");

-- CreateIndex
CREATE INDEX "pedido_linea_pedido_id_idx" ON "pedido_linea"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "linea_comensal_linea_id_comensal_id_key" ON "linea_comensal"("linea_id", "comensal_id");

-- CreateIndex
CREATE INDEX "auditoria_cuenta_id_creado_en_idx" ON "auditoria"("cuenta_id", "creado_en");

-- CreateIndex
CREATE INDEX "auditoria_usuario_id_creado_en_idx" ON "auditoria"("usuario_id", "creado_en");

-- CreateIndex
CREATE INDEX "auditoria_accion_creado_en_idx" ON "auditoria"("accion", "creado_en");

-- CreateIndex
CREATE INDEX "pago_cuenta_id_idx" ON "pago"("cuenta_id");

-- CreateIndex
CREATE UNIQUE INDEX "cierre_dia_turno_id_key" ON "cierre_dia"("turno_id");

-- CreateIndex
CREATE UNIQUE INDEX "cierre_mesera_cierre_id_usuario_id_key" ON "cierre_mesera"("cierre_id", "usuario_id");
