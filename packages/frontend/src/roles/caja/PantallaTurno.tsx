import { Rol, formatearColones, type MeseraEnTurno } from '@brisas/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { endpoints } from '../../shared/api/endpoints';
import { Cargando, MensajeError } from '../../shared/ui/Cargando';
import { Insignia } from '../../shared/ui/Insignia';
import { mensajeDeError } from '../admin/api';
import { ModalCierre } from './ModalCierre';
import { CLAVES_CAJA } from './api';

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });

/**
 * Turno del día.
 *
 * Caja abre el turno marcando **qué meseras entran y a qué hora**, y puede dar
 * de alta o de baja a mitad de turno: alguien entra a las 3 o se va a las 5, y
 * eso cambia el reparto por horas.
 *
 * El turno también se abre solo cuando una mesera abre la primera cuenta del
 * día — sin eso no podría trabajar. Esta pantalla le agrega las horas.
 */
export function PantallaTurno() {
  const cliente = useQueryClient();
  const [cerrando, setCerrando] = useState(false);
  const [aAgregar, setAAgregar] = useState<number | ''>('');
  const [horaEntrada, setHoraEntrada] = useState('');

  const turno = useQuery({ queryKey: CLAVES_CAJA.turno, queryFn: endpoints.turnos.actual });
  const usuarias = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => endpoints.usuarios.listar(),
  });

  const refrescar = () => {
    void cliente.invalidateQueries({ queryKey: CLAVES_CAJA.turno });
    void cliente.invalidateQueries({ queryKey: CLAVES_CAJA.cuentas });
  };

  const abrir = useMutation({
    mutationFn: () => endpoints.turnos.abrir({ meseras: [] }),
    onSuccess: refrescar,
  });

  const agregar = useMutation({
    mutationFn: (turnoId: number) =>
      endpoints.turnos.agregarMesera(turnoId, {
        usuario_id: Number(aAgregar),
        // Si la caja no escribe hora, la pone el servidor.
        hora_entrada: horaEntrada ? new Date(horaEntrada).toISOString() : null,
      }),
    onSuccess: () => {
      setAAgregar('');
      setHoraEntrada('');
      refrescar();
    },
  });

  const salida = useMutation({
    mutationFn: (turnoMeseraId: number) => endpoints.turnos.marcarSalida(turnoMeseraId),
    onSuccess: refrescar,
  });

  if (turno.isLoading) return <Cargando />;
  if (turno.isError) return <MensajeError texto={mensajeDeError(turno.error)} />;
  if (!turno.data) return null;

  const t = turno.data;

  if (!t.turno) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg font-semibold">No hay ningún turno abierto</p>
        <p className="max-w-md text-slate-500">
          Se abre solo cuando una mesera abra la primera cuenta, pero conviene abrirlo acá para
          marcar las horas de entrada desde el principio.
        </p>
        <button className="boton-primario" disabled={abrir.isPending} onClick={() => abrir.mutate()}>
          Abrir el turno de hoy
        </button>
        {abrir.isError && <MensajeError texto={mensajeDeError(abrir.error)} />}
      </div>
    );
  }

  const candidatas = (usuarias.data ?? []).filter(
    (u) =>
      u.rol !== Rol.COCINA &&
      !t.meseras.some((m) => m.usuario_id === u.id && m.hora_salida === null),
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Turno del {t.turno.fecha}</h1>
          <p className="text-slate-600">Abierto a las {hora(t.turno.abierto_en)}</p>
        </div>
        <button
          className="boton-primario"
          onClick={() => setCerrando(true)}
          disabled={t.turno === null}
        >
          Cerrar el día
        </button>
      </header>

      {/* ── Lo que va vendido, en las tres bolsas ─────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Bolsa titulo="Salón" detalle="atribuible a las meseras" monto={t.totalizadores.salon} />
        <Bolsa
          titulo="Para llevar"
          detalle="cuenta aparte de la dueña"
          monto={t.totalizadores.para_llevar}
        />
        <Bolsa
          titulo="Envases"
          detalle="recuperación de empaque"
          monto={t.totalizadores.envases}
        />
      </section>
      <p className="-mt-2 text-sm text-slate-500">
        Son tres bolsas independientes: ninguna línea de comida cambia de bolsa. Solo cuenta lo ya
        cobrado.
      </p>

      {/* ── Quién trabaja ─────────────────────────────────────────────────── */}
      <section className="tarjeta">
        <h2 className="mb-3 font-semibold">Meseras del turno</h2>

        {t.meseras.length === 0 ? (
          <p className="text-slate-500">
            Todavía no hay ninguna. Sin meseras marcadas, el cierre no puede repartir nada.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {t.meseras.map((m) => (
              <FilaMesera
                key={m.id}
                mesera={m}
                onSalida={() => salida.mutate(m.id)}
                deshabilitado={salida.isPending}
              />
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-2 border-t pt-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Agregar mesera</span>
            <select
              value={aAgregar}
              onChange={(e) => setAAgregar(e.target.value === '' ? '' : Number(e.target.value))}
              className="min-h-boton-normal rounded-lg border border-slate-300 px-3"
            >
              <option value="">Elegí…</option>
              {candidatas.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Entró a las (opcional)</span>
            <input
              type="datetime-local"
              value={horaEntrada}
              onChange={(e) => setHoraEntrada(e.target.value)}
              className="min-h-boton-normal rounded-lg border border-slate-300 px-3"
            />
          </label>

          <button
            className="boton-secundario"
            disabled={aAgregar === '' || agregar.isPending}
            onClick={() => t.turno && agregar.mutate(t.turno.id)}
          >
            Agregar
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Si no escribís la hora, se usa la del servidor. La hora escrita a mano queda registrada
          en la bitácora a tu nombre.
        </p>

        {agregar.isError && <p className="mt-2 text-sm text-red-700">{mensajeDeError(agregar.error)}</p>}
      </section>

      {/* ── Lo que impide cerrar ──────────────────────────────────────────── */}
      {t.cuentas_sin_resolver.length > 0 && (
        <section className="tarjeta border-amber-300 bg-amber-50">
          <h2 className="font-semibold text-amber-900">
            {t.cuentas_sin_resolver.length} cuenta(s) sin cobrar ni anular
          </h2>
          <p className="mb-2 text-sm text-amber-900">
            Cerrar así dejaría comida vendida fuera del cierre y la caja no cuadraría.
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {t.cuentas_sin_resolver.map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <span>{c.nombre_cliente}</span>
                <span className="font-semibold tabular-nums">{formatearColones(c.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {t.turno && (
        <ModalCierre
          turnoId={t.turno.id}
          abierto={cerrando}
          puedeCerrar={t.puede_cerrar}
          sinResolver={t.cuentas_sin_resolver.length}
          onCerrar={() => setCerrando(false)}
          onListo={refrescar}
        />
      )}
    </div>
  );
}

function Bolsa({ titulo, detalle, monto }: { titulo: string; detalle: string; monto: number }) {
  return (
    <div className="tarjeta">
      <p className="text-sm font-medium text-slate-600">{titulo}</p>
      <p className="text-2xl font-bold tabular-nums">{formatearColones(monto)}</p>
      <p className="text-xs text-slate-400">{detalle}</p>
    </div>
  );
}

function FilaMesera({
  mesera,
  onSalida,
  deshabilitado,
}: {
  mesera: MeseraEnTurno;
  onSalida: () => void;
  deshabilitado: boolean;
}) {
  return (
    <li
      className="flex flex-wrap items-center gap-3 rounded-lg border-l-8 bg-slate-50 p-3"
      style={{ borderLeftColor: mesera.color_hex }}
    >
      {/* El color va SIEMPRE con el nombre en texto. */}
      <span className="font-semibold">{mesera.nombre}</span>

      <span className="text-sm text-slate-600">
        {hora(mesera.hora_entrada)} → {mesera.hora_salida ? hora(mesera.hora_salida) : 'sigue'}
      </span>

      <span className="text-sm tabular-nums text-slate-600">
        {mesera.horas_trabajadas.toFixed(2)} h
      </span>

      <span className="text-sm">
        vendió{' '}
        <span className="font-semibold tabular-nums">
          {formatearColones(mesera.ventas_atribuidas)}
        </span>
      </span>

      {mesera.hora_salida ? (
        <Insignia tono="neutro">Salió</Insignia>
      ) : (
        <button className="boton-secundario ml-auto text-sm" disabled={deshabilitado} onClick={onSalida}>
          Marcar salida
        </button>
      )}
    </li>
  );
}
