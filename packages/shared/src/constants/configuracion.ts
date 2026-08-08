import { ReglaReparto } from '../types/enums';

/**
 * Claves de la tabla `configuracion`.
 * Se ajustan sin tocar código; el seed las crea con estos valores.
 */
export const CLAVES_CONFIG = {
  PRECIOS_INCLUYEN_IMPUESTOS: 'PRECIOS_INCLUYEN_IMPUESTOS',
  REGLA_REPARTO: 'REGLA_REPARTO',
  PRECIO_ENVASE: 'PRECIO_ENVASE',
  MIN_ALERTA_COCINA: 'MIN_ALERTA_COCINA',
  MIN_URGENTE_COCINA: 'MIN_URGENTE_COCINA',
} as const;
export type ClaveConfig = (typeof CLAVES_CONFIG)[keyof typeof CLAVES_CONFIG];

export interface DefinicionConfig {
  clave: ClaveConfig;
  valor: string;
  descripcion: string;
}

export const CONFIG_POR_DEFECTO: readonly DefinicionConfig[] = [
  {
    clave: CLAVES_CONFIG.PRECIOS_INCLUYEN_IMPUESTOS,
    valor: 'true',
    descripcion:
      'Los precios del menú ya traen el IVA 13% y el 10% de servicio. El sistema NO calcula impuestos: el total de una cuenta es la suma simple de sus líneas. La clave existe por si algún día cambia.',
  },
  {
    clave: CLAVES_CONFIG.REGLA_REPARTO,
    valor: ReglaReparto.ATRIBUCION,
    descripcion:
      'Regla de reparto activa: ATRIBUCION | HORAS | PARTES_IGUALES. El cierre siempre calcula y muestra las tres; esta dice cuál manda.',
  },
  {
    clave: CLAVES_CONFIG.PRECIO_ENVASE,
    valor: '200',
    descripcion: 'Colones por envase plástico. Precio único, sin importar el tamaño.',
  },
  {
    clave: CLAVES_CONFIG.MIN_ALERTA_COCINA,
    valor: '10',
    descripcion: 'Minutos de espera para que la comanda pase a naranja en cocina.',
  },
  {
    clave: CLAVES_CONFIG.MIN_URGENTE_COCINA,
    valor: '20',
    descripcion: 'Minutos de espera para que la comanda pase a rojo en cocina.',
  },
] as const;

/** Precio de respaldo del envase si `configuracion` no responde. */
export const PRECIO_ENVASE_DEFAULT = 200;

/** Nombre del PIN de las usuarias de prueba que crea el seed. Solo desarrollo. */
export const PIN_DEMO = '1234';
