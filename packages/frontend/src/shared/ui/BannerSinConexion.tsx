interface Props {
  conectado: boolean;
  /** La escala `cocina` lo pinta enorme: la tablet se ve desde lejos. */
  escala?: 'normal' | 'cocina';
}

/**
 * Aviso de conexión perdida.
 *
 * Va SIEMPRE acompañado de los datos que ya estaban en pantalla. Ninguna
 * pantalla se queda en blanco por perder la señal: en cocina eso significaría
 * perder la cola de comandas en plena hora pico.
 */
export function BannerSinConexion({ conectado, escala = 'normal' }: Props) {
  if (conectado) return null;

  const esCocina = escala === 'cocina';

  return (
    <div
      role="alert"
      className={
        esCocina
          ? 'flex min-h-tactil w-full items-center justify-center gap-3 bg-red-600 text-cocina-titulo font-bold uppercase tracking-wide text-white'
          : 'flex w-full items-center justify-center gap-2 bg-red-600 px-3 py-2 text-sm font-semibold text-white'
      }
    >
      <span aria-hidden>●</span>
      <span>Sin conexión</span>
      {!esCocina && <span className="font-normal opacity-90">— reintentando sola</span>}
    </div>
  );
}
