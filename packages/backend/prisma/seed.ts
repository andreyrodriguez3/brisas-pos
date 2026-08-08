/**
 * Seed de Brisas POS.
 *
 * IDEMPOTENTE: se puede correr las veces que haga falta. Usa `upsert` contra
 * claves naturales (código de categoría, nombre de producto dentro de su
 * categoría, etiqueta de variante dentro de su producto), así que reejecutarlo
 * actualiza en vez de duplicar.
 *
 * Lee `menu-seed.json` de la raíz del repo — la transcripción de las 7 fotos del
 * menú publicadas en Google Maps. No inventa productos ni precios.
 *
 *   npm run db:seed
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
// Los enums viven en shared: el conector SQLite de Prisma no soporta `enum`.
import { CONFIG_POR_DEFECTO, PALETA_MESERAS, PIN_DEMO, Rol } from '@brisas/shared';

const prisma = new PrismaClient();

// ── Forma del menu-seed.json ────────────────────────────────────────────────

interface OpcionSeed {
  nombre: string;
  precio_extra: number;
}

interface GrupoOpcionSeed {
  codigo: string;
  nombre: string;
  obligatorio: boolean;
  min: number;
  max: number;
  opciones: OpcionSeed[];
}

interface VarianteSeed {
  etiqueta: string;
  /** null = sin precio cargado. El producto entra desactivado. */
  precio: number | null;
}

interface ProductoSeed {
  nombre_es: string;
  nombre_en?: string;
  descripcion?: string;
  variantes: VarianteSeed[];
  grupos_opcion?: string[];
  activo?: boolean;
  es_envase?: boolean;
  nota?: string;
}

interface CategoriaSeed {
  codigo: string;
  nombre: string;
  orden: number;
  productos: ProductoSeed[];
}

interface MenuSeed {
  grupos_opcion_compartidos: GrupoOpcionSeed[];
  grupos_opcion_adicionales?: GrupoOpcionSeed[];
  categorias: CategoriaSeed[];
}

function leerMenuSeed(): MenuSeed {
  // prisma/ → backend/ → packages/ → raíz del repo
  const ruta = resolve(__dirname, '../../../menu-seed.json');
  return JSON.parse(readFileSync(ruta, 'utf8')) as MenuSeed;
}

// ── Configuración ───────────────────────────────────────────────────────────

async function sembrarConfiguracion() {
  for (const { clave, valor, descripcion } of CONFIG_POR_DEFECTO) {
    await prisma.configuracion.upsert({
      where: { clave },
      // La descripción se refresca; el VALOR no se pisa, porque la dueña pudo
      // haberlo ajustado desde el panel y el seed no debe deshacer eso.
      update: { descripcion },
      create: { clave, valor, descripcion },
    });
  }
  console.log(`  configuracion: ${CONFIG_POR_DEFECTO.length} claves`);
}

// ── Usuarias de prueba ──────────────────────────────────────────────────────

const USUARIAS_DEMO: Array<{ nombre: string; rol: Rol; color: string }> = [
  { nombre: 'María', rol: Rol.MESERA, color: PALETA_MESERAS[0].hex },
  { nombre: 'Cocina', rol: Rol.COCINA, color: PALETA_MESERAS[4].hex },
  { nombre: 'Caja', rol: Rol.CAJA, color: PALETA_MESERAS[7].hex },
  { nombre: 'Dueña', rol: Rol.ADMIN, color: PALETA_MESERAS[8].hex },
];

async function sembrarUsuarias() {
  const pinHash = await hash(PIN_DEMO);

  for (const { nombre, rol, color } of USUARIAS_DEMO) {
    await prisma.usuario.upsert({
      where: { nombre },
      // Si la usuaria ya existe no se le pisa el PIN: en la PC del restaurante
      // ya lo cambiaron y el seed no debe devolverlo a 1234.
      update: { rol, color_hex: color, activo: true },
      create: { nombre, rol, color_hex: color, pin_hash: pinHash, activo: true },
    });
  }
  console.log(`  usuarios: ${USUARIAS_DEMO.length} de prueba (PIN ${PIN_DEMO})`);
}

// ── Menú ────────────────────────────────────────────────────────────────────

async function sembrarGruposOpcion(menu: MenuSeed): Promise<Map<string, number>> {
  const grupos = [...menu.grupos_opcion_compartidos, ...(menu.grupos_opcion_adicionales ?? [])];
  const porCodigo = new Map<string, number>();

  for (const g of grupos) {
    const grupo = await prisma.grupoOpcion.upsert({
      where: { codigo: g.codigo },
      update: { nombre: g.nombre, obligatorio: g.obligatorio, min_sel: g.min, max_sel: g.max },
      create: {
        codigo: g.codigo,
        nombre: g.nombre,
        obligatorio: g.obligatorio,
        min_sel: g.min,
        max_sel: g.max,
      },
    });
    porCodigo.set(g.codigo, grupo.id);

    for (const o of g.opciones) {
      await prisma.opcion.upsert({
        where: { grupo_opcion_id_nombre: { grupo_opcion_id: grupo.id, nombre: o.nombre } },
        update: { precio_extra: o.precio_extra ?? 0, activo: true },
        create: { grupo_opcion_id: grupo.id, nombre: o.nombre, precio_extra: o.precio_extra ?? 0 },
      });
    }
  }

  console.log(`  grupos de opción: ${grupos.length}`);
  return porCodigo;
}

async function sembrarMenu(menu: MenuSeed, gruposPorCodigo: Map<string, number>) {
  let nProductos = 0;
  let nVariantes = 0;
  let nSinPrecio = 0;

  for (const cat of menu.categorias) {
    const categoria = await prisma.categoria.upsert({
      where: { codigo: cat.codigo },
      update: { nombre: cat.nombre, orden: cat.orden, activo: true },
      create: { codigo: cat.codigo, nombre: cat.nombre, orden: cat.orden },
    });

    for (const [i, p] of cat.productos.entries()) {
      // Un producto sin ningún precio cargado NO se puede vender.
      // Son las 11 bebidas de "Refrescos, cervezas y vinos" que salieron sin
      // precio en las fotos del menú.
      const tienePrecio = p.variantes.some((v) => v.precio !== null && v.precio !== undefined);
      const activo = p.activo !== false && tienePrecio;
      if (!tienePrecio) nSinPrecio++;

      const producto = await prisma.producto.upsert({
        where: {
          categoria_id_nombre_es: { categoria_id: categoria.id, nombre_es: p.nombre_es },
        },
        update: {
          nombre_en: p.nombre_en ?? null,
          descripcion: p.descripcion ?? null,
          orden: i,
          es_envase: p.es_envase ?? false,
          activo,
        },
        create: {
          categoria_id: categoria.id,
          nombre_es: p.nombre_es,
          nombre_en: p.nombre_en ?? null,
          descripcion: p.descripcion ?? null,
          orden: i,
          es_envase: p.es_envase ?? false,
          activo,
        },
      });
      nProductos++;

      for (const [j, v] of p.variantes.entries()) {
        await prisma.variante.upsert({
          where: {
            producto_id_etiqueta: { producto_id: producto.id, etiqueta: v.etiqueta },
          },
          update: { precio_colones: v.precio ?? null, orden: j, activo: v.precio !== null },
          create: {
            producto_id: producto.id,
            etiqueta: v.etiqueta,
            precio_colones: v.precio ?? null,
            orden: j,
            activo: v.precio !== null,
          },
        });
        nVariantes++;
      }

      for (const codigo of p.grupos_opcion ?? []) {
        const grupoId = gruposPorCodigo.get(codigo);
        if (!grupoId) {
          console.warn(`  ⚠ ${p.nombre_es} referencia el grupo "${codigo}", que no existe`);
          continue;
        }
        await prisma.productoGrupo.upsert({
          where: {
            producto_id_grupo_opcion_id: { producto_id: producto.id, grupo_opcion_id: grupoId },
          },
          update: {},
          create: { producto_id: producto.id, grupo_opcion_id: grupoId },
        });
      }
    }
  }

  console.log(`  categorías: ${menu.categorias.length}`);
  console.log(`  productos: ${nProductos} (${nSinPrecio} sin precio → desactivados)`);
  console.log(`  variantes: ${nVariantes}`);
  return { nProductos, nVariantes, nSinPrecio };
}

// ── Verificaciones ──────────────────────────────────────────────────────────

async function verificar() {
  const envases = await prisma.producto.findMany({
    where: { es_envase: true },
    include: { variantes: true },
  });

  if (envases.length === 0) {
    throw new Error('El seed no cargó ningún producto con es_envase = true. Revisá menu-seed.json.');
  }

  const precioEnvase = envases[0].variantes[0]?.precio_colones;
  if (precioEnvase !== 200) {
    throw new Error(`El envase debería costar ₡200 y quedó en ₡${precioEnvase}.`);
  }

  const vendibles = await prisma.producto.count({ where: { activo: true } });
  console.log(`  ✓ envase a ₡200 cargado; ${vendibles} productos vendibles hoy`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Sembrando Brisas POS…');
  const menu = leerMenuSeed();

  await sembrarConfiguracion();
  await sembrarUsuarias();
  const grupos = await sembrarGruposOpcion(menu);
  await sembrarMenu(menu, grupos);
  await verificar();

  console.log('Listo.');
}

main()
  .catch((e) => {
    console.error('El seed falló:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
