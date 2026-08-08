import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * La campana de cocina.
 *
 * Se genera con WebAudio en vez de reproducir un archivo: no hay que cargar
 * ningún recurso, suena igual con o sin conexión, y el volumen se controla de
 * verdad en vez de depender del volumen del sistema — que en una tablet montada
 * en la pared nadie va a andar ajustando.
 *
 * El tono es suave a propósito. La cocina ya es ruidosa; un pitido agresivo
 * termina con alguien silenciando la tablet, y una tablet muda es peor que no
 * tener campana.
 */

export const NIVELES_VOLUMEN = [
  { clave: 'APAGADO', etiqueta: 'APAGADO', ganancia: 0 },
  { clave: 'BAJO', etiqueta: 'BAJO', ganancia: 0.2 },
  { clave: 'MEDIO', etiqueta: 'MEDIO', ganancia: 0.5 },
  { clave: 'ALTO', etiqueta: 'ALTO', ganancia: 1 },
] as const;

export type ClaveVolumen = (typeof NIVELES_VOLUMEN)[number]['clave'];

interface EstadoVolumen {
  nivel: ClaveVolumen;
  poner: (nivel: ClaveVolumen) => void;
}

/** Se recuerda entre reinicios: la tablet arranca sola y nadie la reconfigura. */
export const useVolumen = create<EstadoVolumen>()(
  persist(
    (set) => ({
      nivel: 'MEDIO',
      poner: (nivel) => set({ nivel }),
    }),
    { name: 'brisas-volumen-cocina' },
  ),
);

let contexto: AudioContext | null = null;

function obtenerContexto(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Constructor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructor) return null;
  contexto ??= new Constructor();
  return contexto;
}

/**
 * Los navegadores no dejan sonar nada hasta que la usuaria toca la pantalla.
 * La tablet vive encendida todo el día, así que basta con desbloquear el audio
 * en el primer toque, sea el que sea, y no volver a pensar en el tema.
 */
export function desbloquearAudio(): void {
  const ctx = obtenerContexto();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

/**
 * Campana de dos tonos con caída suave, tipo timbre de mostrador.
 * No hace nada si el volumen está en APAGADO.
 */
export function sonarCampana(ganancia: number): void {
  if (ganancia <= 0) return;

  const ctx = obtenerContexto();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const ahora = ctx.currentTime;
  // Do agudo y su quinta: suena a campana y no a alarma.
  for (const [indice, frecuencia] of [880, 1318.5].entries()) {
    const oscilador = ctx.createOscillator();
    const volumen = ctx.createGain();

    oscilador.type = 'sine';
    oscilador.frequency.value = frecuencia;

    const inicio = ahora + indice * 0.12;
    const pico = ganancia * (indice === 0 ? 0.5 : 0.3);

    volumen.gain.setValueAtTime(0.0001, inicio);
    volumen.gain.exponentialRampToValueAtTime(pico, inicio + 0.02);
    volumen.gain.exponentialRampToValueAtTime(0.0001, inicio + 1.1);

    oscilador.connect(volumen).connect(ctx.destination);
    oscilador.start(inicio);
    oscilador.stop(inicio + 1.2);
  }
}

/** La ganancia del nivel guardado, lista para `sonarCampana`. */
export function gananciaDe(nivel: ClaveVolumen): number {
  return NIVELES_VOLUMEN.find((n) => n.clave === nivel)?.ganancia ?? 0;
}
