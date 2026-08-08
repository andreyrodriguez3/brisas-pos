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

/** Fondo de la tarjeta según su columna. */
const FONDO: Record<string, string> = {
  ENVIADO: 'border-estado-nuevo bg-estado-nuevo-tenue',
  EN_PREPARACION: 'border-estado-preparacion bg-estado-preparacion-tenue',
  LISTO: 'border-estado-listo bg-estado-listo-tenue',
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
      className={`mb-sep-cocina w-full overflow-hidden rounded-xl border-4 text-left shadow-sm
        transition active:scale-[0.99] disabled:opacity-60 ${FONDO[comanda.estado] ?? ''}
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
          <p className="text-cocina-xs text-slate-600">
            {esParaLlevar ? 'PARA LLEVAR' : `Mesera: ${comanda.mesera_nombre ?? '—'}`}
            {comanda.referencia && ` · ${comanda.referencia}`}
          </p>
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
