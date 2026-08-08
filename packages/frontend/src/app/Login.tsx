import { COLOR_SIN_MESERA, Rol, type Usuario } from '@brisas/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorApi } from '../shared/api/cliente';
import { endpoints } from '../shared/api/endpoints';
import { useSesion } from '../shared/estado/sesion';
import { Cargando, MensajeError } from '../shared/ui/Cargando';
import { TecladoNumerico } from '../shared/ui/TecladoNumerico';
import { rutaInicialPorRol } from './rutas';

type UsuarioLogin = Pick<Usuario, 'id' | 'nombre' | 'rol' | 'color_hex'>;

/**
 * Pantalla de entrada: se toca el nombre y se marca el PIN de 4 dígitos.
 *
 * Sin campo de texto y sin teclado del sistema. La cocina no pasa por acá:
 * su tablet entra directo por /cocina.
 */
export function Login() {
  const [usuario, setUsuario] = useState<UsuarioLogin | null>(null);
  const [pin, setPin] = useState('');
  const abrirSesion = useSesion((s) => s.abrir);
  const navegar = useNavigate();

  const usuarios = useQuery({
    queryKey: ['auth', 'usuarios'],
    queryFn: endpoints.auth.usuarios,
  });

  const login = useMutation({
    mutationFn: endpoints.auth.login,
    onSuccess: (sesion) => {
      abrirSesion(sesion);
      navegar(rutaInicialPorRol(sesion.usuario.rol), { replace: true });
    },
    onError: () => setPin(''),
  });

  function agregarDigito(digito: string) {
    if (pin.length >= 4 || login.isPending || !usuario) return;
    const nuevo = pin + digito;
    setPin(nuevo);
    // Al cuarto dígito entra sola: nadie tiene que buscar el botón de confirmar.
    if (nuevo.length === 4) {
      login.mutate({ usuario_id: usuario.id, pin: nuevo });
    }
  }

  if (usuarios.isLoading) return <Cargando texto="Buscando el servidor…" />;

  if (usuarios.isError) {
    return (
      <PantallaCentrada>
        <MensajeError
          texto={
            usuarios.error instanceof ErrorApi && usuarios.error.esDeConexion
              ? 'No se encuentra el servidor. Revisá que la computadora de caja esté encendida y que el celular esté en el WiFi del restaurante.'
              : 'No se pudo cargar la lista de usuarias.'
          }
        />
        <button className="boton-secundario" onClick={() => usuarios.refetch()}>
          Reintentar
        </button>
      </PantallaCentrada>
    );
  }

  // ── Paso 1: elegir quién sos ─────────────────────────────────────────────

  if (!usuario) {
    return (
      <PantallaCentrada>
        <Encabezado titulo="¿Quién sos?" />
        <ul className="flex w-full flex-col gap-3">
          {usuarios.data?.map((u) => (
            <li key={u.id}>
              <button
                onClick={() => setUsuario(u)}
                className="tarjeta-mesera flex w-full items-center gap-4 text-left
                           transition active:scale-[0.99]"
                style={{ borderLeftColor: u.color_hex || COLOR_SIN_MESERA }}
              >
                <span className="flex-1">
                  {/* El color va siempre con el nombre en texto legible. */}
                  <span className="block text-lg font-semibold">{u.nombre}</span>
                  <span className="block text-sm text-slate-500">{etiquetaRol(u.rol)}</span>
                </span>
                <span aria-hidden className="text-slate-300">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PantallaCentrada>
    );
  }

  // ── Paso 2: marcar el PIN ────────────────────────────────────────────────

  return (
    <PantallaCentrada>
      <Encabezado titulo={usuario.nombre} subtitulo="Marcá tu PIN" color={usuario.color_hex} />

      <div className="flex gap-3" aria-label={`PIN de ${pin.length} de 4 dígitos`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-5 w-5 rounded-full transition ${
              i < pin.length ? 'bg-marca' : 'bg-slate-300'
            }`}
          />
        ))}
      </div>

      {login.isError && (
        <p role="alert" className="text-center font-medium text-red-700">
          {login.error instanceof Error ? login.error.message : 'No se pudo entrar'}
        </p>
      )}

      <TecladoNumerico
        deshabilitado={login.isPending}
        onDigito={agregarDigito}
        onBorrar={() => setPin((p) => p.slice(0, -1))}
        onLimpiar={() => setPin('')}
      />

      <button
        className="boton-secundario w-full"
        onClick={() => {
          setUsuario(null);
          setPin('');
          login.reset();
        }}
      >
        Cambiar de usuaria
      </button>
    </PantallaCentrada>
  );
}

function PantallaCentrada({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-6 p-6">
      {children}
    </main>
  );
}

function Encabezado({
  titulo,
  subtitulo,
  color,
}: {
  titulo: string;
  subtitulo?: string;
  color?: string;
}) {
  return (
    <header className="text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-marca">Brisas POS</p>
      <h1 className="mt-1 text-2xl font-bold" style={color ? { color } : undefined}>
        {titulo}
      </h1>
      {subtitulo && <p className="text-slate-500">{subtitulo}</p>}
    </header>
  );
}

function etiquetaRol(rol: Rol): string {
  switch (rol) {
    case Rol.MESERA:
      return 'Mesera';
    case Rol.CAJA:
      return 'Caja';
    case Rol.ADMIN:
      return 'Administración';
    case Rol.COCINA:
      return 'Cocina';
  }
}
