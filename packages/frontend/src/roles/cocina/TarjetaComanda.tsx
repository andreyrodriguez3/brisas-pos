import {
  COLORES_URGENCIA,
  COLOR_SIN_MESERA,
  CanalCuenta,
  minutosDeEspera,
  minutosParaRetiro,
  urgenciaDeComanda,
  type ComandaCocina,
  type UmbralesCocina,
} from '@brisas/shared';
import { AVANCE } from './useCola';

interface Props {
  comanda: ComandaCocina;
  ahora: number;
  umbrales: UmbralesCocina;
  /** Acaba de entrar: parpadea unos segundos. */
  parpadea: boolean;
  /** El cambio anterior todavía va en camino: no acepta otro toque. */
  enVuelo: boolean;
  onTocar: (comanda: ComandaCocina) => void;
}

/**
 * El semáforo de estado vive en una franja + una etiqueta, no en toda la
 * tarjeta teñida de color — eso se leía como un bloque plano y competía con
 * el nombre del cliente, que es el dato que más importa a simple vista.
 */
const BORDE: Record<string, string> = {
  ENVIADO: 'border-l-estado-nuevo',
  EN_PREPARACION: 'border-l-estado-preparacion',
  LISTO: 'border-l-estado-listo',
};

const ETIQUETA_ESTADO: Record<string, { texto: string; clase: string }> = {
  ENVIADO: { texto: 'NUEVO', clase: 'bg-estado-nuevo-tenue text-amber-900' },
  EN_PREPARACION: { texto: 'EN PREPARACIÓN', clase: 'bg-estado-preparacion-tenue text-blue-900' },
  LISTO: { texto: 'LISTO', clase: 'bg-estado-listo-tenue text-green-900' },
};

/**
 * Una comanda.
 *
 * **La tarjeta entera es el botón.** Un toque avanza de estado y ya: no hay
 * diálogo de confirmación, no hay menú, no hay nada que buscar. Si el toque
 * estuvo mal, el botón DESHACER de abajo lo devuelve durante 30 segundos.
 *
 * Todo lo que se lee acá está en la escala `cocina`: el nombre del cliente a
 * 32 px, los platillos a 24 px, nada por debajo de 20 px. Son requisitos de
 * accesibilidad, no preferencias — las usuarias son señoras con poca
 * experiencia digital, con las manos ocupadas y con prisa.
 */
export function TarjetaComanda({ comanda, ahora, umbrales, parpadea, enVuelo, onTocar }: Props) {
  const paso = AVANCE[comanda.estado];
  const urgencia = urgenciaDeComanda(comanda, ahora, umbrales);
  const esParaLlevar = comanda.canal === CanalCuenta.PARA_LLEVAR;
  const colorMesera = comanda.mesera_color ?? COLOR_SIN_MESERA;

  return (
    <button
      type="button"
      disabled={enVuelo || !paso}
      onClick={() => onTocar(comanda)}
      // `text-left`: es un botón, pero por dentro es una comanda que se lee.
      className={`mb-sep-cocina w-full overflow-hidden rounded-xl border border-slate-200/70
        border-l-8 bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-12px_rgba(15,23,42,0.16)]
        transition active:scale-[0.99] disabled:opacity-60 ${BORDE[comanda.estado] ?? ''}
        ${parpadea ? 'animate-entrada-nueva' : ''}`}
    >
      {/* Banda naranja: esto se suma a una cuenta que ya estaba comiendo. */}
      {comanda.es_agregado && (
        <div className="estado-agregado px-4 py-2 text-cocina-xs font-bold uppercase tracking-wide">
          Agregado · {comanda.nombre_cliente}
        </div>
      )}

      <header className="flex items-start gap-3 px-4 py-3">
        {/* El color de la mesera NUNCA es la única señal: abajo va su nombre. */}
        <span
          aria-hidden
          className="mt-1 h-12 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: colorMesera }}
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-cocina-titulo font-bold uppercase leading-tight">
            {comanda.nombre_cliente}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {/* text-cocina-xs, no un tamaño de chip más chico: nada baja de
                20px en esta pantalla, ni siquiera una etiqueta. */}
            <span
              className={`shrink-0 rounded px-1.5 text-cocina-xs font-bold uppercase tracking-wide ${
                ETIQUETA_ESTADO[comanda.estado]?.clase ?? ''
              }`}
            >
              {ETIQUETA_ESTADO[comanda.estado]?.texto}
            </span>
            <p className="text-cocina-xs text-slate-600">
              {esParaLlevar ? 'PARA LLEVAR' : `Mesera: ${comanda.mesera_nombre ?? '—'}`}
              {comanda.referencia && ` · ${comanda.referencia}`}
            </p>
          </div>
        </div>

        <Temporizador
          comanda={comanda}
          ahora={ahora}
          color={COLORES_URGENCIA[urgencia]}
          destacado={urgencia !== 'normal'}
        />
      </header>

      <ul className="border-t-2 border-black/10 px-4 py-3">
        {comanda.lineas.map((linea) => (
          <li key={linea.id} className="py-1.5">
            <p className="text-cocina-base font-semibold leading-snug">
              <span className="tabular-nums">{linea.cantidad} ×</span> {linea.producto_nombre}
              {linea.variante_etiqueta && (
                <span className="font-normal"> ({linea.variante_etiqueta})</span>
              )}
            </p>

            {linea.opciones.length > 0 && (
              <p className="pl-8 text-cocina-xs text-slate-700">→ {linea.opciones.join(' · ')}</p>
            )}

            {/* "SIN CEBOLLA": el dato que más se pasa por alto y el que más
                platos devuelve. Mayúsculas y destacado, sin excepción. */}
            {linea.nota && (
              <p className="mt-1 ml-8 inline-block">
                <span className="nota-cliente text-cocina-xs">{linea.nota}</span>
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* Palabras en español, no íconos sueltos. 80 px de alto: imposible errarle. */}
      {paso && (
        <span className="boton-cocina bg-slate-800">{enVuelo ? 'GUARDANDO…' : paso.palabra}</span>
      )}
    </button>
  );
}

/**
 * El reloj de la tarjeta.
 *
 * Dos preguntas distintas según el canal, y por eso el texto también cambia:
 * en el salón importa cuánto lleva esperando el cliente; en un pedido para
 * llevar, cuánto falta para que venga a recogerlo.
 */
function Temporizador({
  comanda,
  ahora,
  color,
  destacado,
}: {
  comanda: ComandaCocina;
  ahora: number;
  color: string;
  destacado: boolean;
}) {
  const faltan = minutosParaRetiro(comanda, ahora);

  const texto =
    faltan === null
      ? `${minutosDeEspera(comanda, ahora)} MIN`
      : faltan >= 0
        ? `EN ${faltan} MIN`
        : `HACE ${-faltan} MIN`;

  return (
    <span
      className="shrink-0 rounded-lg px-3 py-1 text-cocina-xs font-bold tabular-nums"
      style={{
        color: destacado ? '#FFFFFF' : color,
        backgroundColor: destacado ? color : 'transparent',
      }}
    >
      {texto}
    </span>
  );
}
