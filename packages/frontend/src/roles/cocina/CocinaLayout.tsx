import { EstadoPedido, type ComandaCocina } from '@brisas/shared';
import { useEffect } from 'react';
import { endpoints } from '../../shared/api/endpoints';
import { useSesion } from '../../shared/estado/sesion';
import { BannerSinConexion } from '../../shared/ui/BannerSinConexion';
import { BarraDeshacer } from './BarraDeshacer';
import { ControlVolumen } from './ControlVolumen';
import { TarjetaComanda } from './TarjetaComanda';
import { desbloquearAudio } from './sonido';
import { useCola } from './useCola';

/** Las tres columnas. Fijas: sin menús, sin pestañas, sin scroll horizontal. */
const COLUMNAS = [
  { estado: EstadoPedido.ENVIADO, titulo: 'NUEVOS', clase: 'bg-estado-nuevo' },
  { estado: EstadoPedido.EN_PREPARACION, titulo: 'EN PREPARACIÓN', clase: 'bg-estado-preparacion' },
  { estado: EstadoPedido.LISTO, titulo: 'LISTOS', clase: 'bg-estado-listo' },
] as const;

/**
 * Pantalla de cocina (tablet fija en modo kiosco).
 *
 * Restricciones de UX que NO son negociables — las usuarias son señoras con poca
 * experiencia digital compartiendo una sola tablet, con las manos ocupadas, en
 * un ambiente caliente y con prisa. Si esta pantalla falla, falla el proyecto:
 *
 *   · Sin login. La tablet pide su token sola al arrancar.
 *   · Tres columnas fijas. Sin menús, sin pestañas, sin scroll horizontal.
 *   · La tarjeta entera es el botón; un toque avanza de estado.
 *   · Nada de diálogos de confirmación: un botón grande DESHACER de 30 segundos.
 *   · Escala `cocina`: cliente 32 px, platillos 24 px, nada bajo 20 px.
 *   · Palabras en español en los botones ("EMPEZAR", "LISTO"), no íconos sueltos.
 *   · Orden automático: lo que toca primero, arriba. Nadie busca nada.
 *   · Sin conexión: banner rojo grande y **lo ya recibido se queda en pantalla**.
 */
export function CocinaLayout() {
  const { token, abrir } = useSesion();
  const cola = useCola();

  // La tablet arranca directo en la app y nunca pide contraseña.
  useEffect(() => {
    if (token) return;
    endpoints.auth.cocina().then(abrir).catch(console.error);
  }, [token, abrir]);

  // El navegador no deja sonar nada hasta el primer toque de la usuaria. La
  // tablet vive encendida todo el día: basta con desbloquearlo una vez.
  useEffect(() => {
    const alTocar = () => desbloquearAudio();
    window.addEventListener('pointerdown', alTocar, { once: true });
    return () => window.removeEventListener('pointerdown', alTocar);
  }, []);

  const porEstado = (estado: EstadoPedido): ComandaCocina[] =>
    cola.comandas.filter((c) => c.estado === estado);

  return (
    <div className="escala-cocina flex h-dvh flex-col bg-slate-100">
      {/* Rojo, enorme, arriba de todo — y las comandas siguen abajo. */}
      <BannerSinConexion conectado={cola.conectado} escala="cocina" />

      {cola.error && (
        <p
          role="alert"
          className="bg-red-700 px-6 py-3 text-center text-cocina-xs font-bold text-white"
        >
          {cola.error}
        </p>
      )}

      <header className="flex items-center justify-between gap-4 px-6 py-3">
        <h1 className="text-cocina-titulo font-bold">COCINA</h1>
        <ControlVolumen />
      </header>

      <div className="grid flex-1 grid-cols-3 gap-sep-cocina overflow-hidden px-4">
        {COLUMNAS.map((columna) => {
          const comandas = porEstado(columna.estado);
          return (
            <section key={columna.estado} className="flex min-h-0 flex-col">
              <h2
                className={`${columna.clase} flex items-baseline justify-center gap-3 rounded-t-xl px-4 py-3 text-cocina-lg font-bold tracking-wide text-white`}
              >
                {columna.titulo}
                <span className="text-cocina-xs tabular-nums opacity-90">{comandas.length}</span>
              </h2>

              <div className="flex-1 overflow-y-auto rounded-b-xl bg-white/60 p-3">
                {cola.cargando ? (
                  <p className="p-4 text-center text-cocina-xs text-slate-400">Cargando…</p>
                ) : comandas.length === 0 ? (
                  <p className="p-4 text-center text-cocina-xs text-slate-400">Sin comandas</p>
                ) : (
                  comandas.map((comanda) => (
                    <TarjetaComanda
                      key={comanda.pedido_id}
                      comanda={comanda}
                      ahora={cola.ahora}
                      umbrales={cola.umbrales}
                      parpadea={cola.recienLlegadas.has(comanda.pedido_id)}
                      enVuelo={cola.enVuelo.has(comanda.pedido_id)}
                      onTocar={cola.avanzar}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Ocupa lugar siempre, aunque esté vacío: si la barra apareciera y
          desapareciera, las columnas darían un salto justo cuando la cocinera
          va a tocar la siguiente tarjeta. */}
      <div className="min-h-boton-cocina px-4 py-3">
        <BarraDeshacer accion={cola.deshacer} onDeshacer={cola.ejecutarDeshacer} />
      </div>
    </div>
  );
}
