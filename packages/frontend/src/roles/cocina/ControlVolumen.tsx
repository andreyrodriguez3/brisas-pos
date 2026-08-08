import { NIVELES_VOLUMEN, gananciaDe, sonarCampana, useVolumen } from './sonido';

/**
 * Volumen de la campana.
 *
 * La cocina es ruidosa y el nivel correcto depende de la hora y de cuánta gente
 * haya, así que se ajusta desde la misma pantalla — sin entrar a ninguna
 * configuración. Cada toque suena, para que se elija oyendo y no adivinando.
 *
 * Palabras en español, no un ícono de bocina con un deslizador que nadie va a
 * poder mover con las manos ocupadas.
 */
export function ControlVolumen() {
  const nivel = useVolumen((s) => s.nivel);
  const poner = useVolumen((s) => s.poner);

  return (
    <div className="flex items-center gap-2">
      <span className="text-cocina-xs text-slate-500">Campana</span>
      {NIVELES_VOLUMEN.map((n) => (
        <button
          key={n.clave}
          type="button"
          onClick={() => {
            poner(n.clave);
            sonarCampana(gananciaDe(n.clave));
          }}
          className={`min-h-tactil rounded-lg px-4 text-cocina-xs font-bold ${
            n.clave === nivel ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'
          }`}
        >
          {n.etiqueta}
        </button>
      ))}
    </div>
  );
}
