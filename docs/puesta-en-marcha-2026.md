# Puesta en marcha en la PC real (septiembre de 2026)

Esta guía es para **una PC Windows 11 con dos monitores**, caja y cocina en la misma máquina, teléfonos de meseras conectados al **WiFi existente compartido con clientes**, una llave USB de respaldo y soporte remoto desde casa. Hacé primero el [protocolo de pruebas](pruebas-de-aceptacion.md) en una base de ensayo. Las direcciones y letras de unidad de ejemplo se reemplazan con los valores medidos en sitio.

## Lo que hay que decidir antes de atender clientes

1. **Seguridad del WiFi compartido.** Hoy `/api/auth/cocina` entrega una sesión de cocina sin PIN a cualquiera que alcance el servidor. Los demás roles piden PIN, pero el sitio usa HTTP, por lo que ese PIN y el token viajan sin cifrar. CORS limita ciertos navegadores, no autentica a alguien en la misma red. La contraseña del WiFi tampoco separa clientes de personal si todos la conocen. **No dar por segura la instalación solo por cambiar los PIN.** Para operar con ese WiFi hay que añadir HTTPS confiable para los dispositivos y control de acceso a cocina, o una red privada para personal. Como no habrá router propio ni acceso al existente, estas dos protecciones aún necesitan trabajo y una prueba en los teléfonos reales. Mientras tanto, usá solo datos de ensayo.
2. **Dirección estable sin router.** DHCP le asigna una IP a la PC y puede cambiarla. No sabemos el rango DHCP ni podemos reservar una dirección; fijar `192.168.1.50` a ciegas puede cortar el servicio o duplicar una IP. Primero probá resolución por nombre (`hostname`) desde *cada* dispositivo. Si no funciona estable, se necesitará reserva DHCP por quien administre el router, una red propia o una solución de nombre/dirección que se pruebe también sin internet. No pongas una IP manual por simple suposición.
3. **PWA y modo desconectado.** La web carga por HTTP desde una IP privada. Los navegadores solo permiten service workers (instalación PWA y cache del shell) en HTTPS confiable o `localhost`; la excepción de `localhost` sirve para la PC, no para los celulares. Hasta incorporar HTTPS, probá desde el navegador normal. La cola local de pedidos sí usa `localStorage`, pero la app no puede prometer abrir desde cero sin red en un celular.
4. **RDP y los dos monitores.** Windows 11 Home no acepta RDP entrante; Pro/Education/Enterprise sí. RDP puede pasar la sesión interactiva a la conexión remota y dejar la consola física en la pantalla de inicio: **no usarlo durante servicio de caja/cocina** sin una prueba específica. El backend instalado como servicio debe seguir funcionando, pero las pantallas pueden quedar ocultas. Para ayudar durante servicio, una herramienta de compartir la consola física requiere una prueba aparte.

Estas condiciones son criterios de salida, no detalles cosméticos. Registrar `aprobado`, `falló` o `pendiente` en las pruebas; no convertir un pendiente en aprobado.

## Fase A. Preparar la PC en casa

1. Anotá la edición y arquitectura de Windows, versión, nombre del equipo y versión de Node. En PowerShell:

   ```powershell
   Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion, OsArchitecture
   hostname
   node --version
   npm --version
   ```

   Usá Windows 11 actualizado. Instalá una versión **LTS con soporte vigente** de Node desde [nodejs.org](https://nodejs.org/en/download) y comprobá que `npm ci`, las migraciones y el build funcionen con esa versión en **esta PC**. Node 20 ya terminó soporte; Node 22 aún figura como LTS, aunque 24 es la versión LTS más reciente. No des por compatible una versión nueva solo por el `>=20` del `package.json`.

2. En Windows → Pantalla → **Extender estas pantallas**. Probá ambas salidas, resolución, escalado y que cada ventana quede en el monitor previsto. Si el cable USB más largo todavía no está, marcá esta prueba `pendiente`. El servidor puede prepararse con un monitor; la operación con dos no está validada hasta conectar ambos.
3. Conectá la PC a la corriente y configurá suspensión en **Nunca mientras esté enchufada**. Apagar pantallas es opcional; suspender la PC corta el sistema y el acceso remoto. Ajustá las horas activas de Windows Update fuera del servicio; no desactives las actualizaciones de seguridad. Si el BIOS permite encender tras corte eléctrico, probalo con la UPS conectada a PC **y equipo WiFi**.
4. Pasá al equipo **una copia exacta del árbol actual del proyecto**, incluyendo `package-lock.json`, `menu-seed.json` y las migraciones. Este árbol tiene cambios sin confirmar en Git: clonar un remoto podría instalar otra versión. Copiá el proyecto a `C:\BrisasPOS` desde un medio de transporte limpio, sin `node_modules`, `dist`, bases `.sqlite*`, `.env`, `logs` ni `respaldos`. Compará el número de archivos y, como mínimo, SHA-256 de `package-lock.json`, `menu-seed.json` y `scripts\backup.ps1` en origen/destino con `Get-FileHash`. Conservá otra copia de ese paquete de instalación fuera de la PC.
5. Instalá desde fuentes oficiales el [SQLite command-line shell para Windows](https://www.sqlite.org/download.html) (`sqlite3.exe`), [NSSM](https://nssm.cc/download) y, si vas a usar RDP, [Tailscale](https://tailscale.com/download/windows). Verificá en una terminal nueva `Get-Command sqlite3.exe` y `sqlite3.exe -version`. No basta con que SQLite esté dentro de Prisma: los scripts de respaldo/restauración necesitan el ejecutable.
6. En PowerShell de administrador creá las carpetas, luego en una terminal normal dentro del proyecto instalá y verificá:

   ```powershell
   New-Item -ItemType Directory -Force C:\BrisasPOS\data,C:\BrisasPOS\logs,C:\BrisasPOS\respaldos
   cd C:\BrisasPOS
   npm ci
   npm run db:generate
   npm test
   npm run build
   npm run lint
   npm run typecheck
   npm audit --audit-level=low
   ```

   `npm ci` usa el lockfile exacto; no sustituyas por `npm install` el día de instalar. Si `npm ci` o Prisma falla, detené la instalación y guardá el error completo. Los tests y el build locales no prueban la instalación en esta PC.

7. Copiá `.env.example` a `packages\backend\.env`, ejecutá `npm run secreto:escribir`, y ajustá estas líneas en el archivo (sin publicar el secreto):

   ```ini
   DATABASE_URL="file:C:/BrisasPOS/data/aceptacion.sqlite"
   HOST=0.0.0.0
   PORT=3000
   NODE_ENV=production
   ```

   `aceptacion.sqlite` es una base **solo de ensayo**. La base definitiva será `C:/BrisasPOS/data/brisas.sqlite`. Ejecutá `npm run db:deploy -w @brisas/backend` y luego `npm run db:seed`. El seed crea cuatro usuarias de demostración con PIN `1234`; usalas solo para probar y **no vuelvas a correr el seed tras cambiar usuarios, roles o precios en producción**, porque también actualiza datos del menú y reactiva esos cuatro usuarios.

8. Copiá `nssm.exe` (versión `win64`) a `C:\BrisasPOS\nssm.exe`. En PowerShell **como administrador**, corré `C:\BrisasPOS\nssm.exe install BrisasPOS`. En la ventana de NSSM configurá:

   | Pestaña/campo | Valor |
   |---|---|
   | Application → Path | Ruta obtenida con `Get-Command node.exe`, normalmente `C:\Program Files\nodejs\node.exe` |
   | Application → Startup directory | `C:\BrisasPOS` |
   | Application → Arguments | `packages\backend\dist\main.js` |
   | Details → Startup type | `Automatic` |
   | I/O → stdout/stderr | `C:\BrisasPOS\logs\brisas-out.log` y `C:\BrisasPOS\logs\brisas-error.log` |
   | File rotation | Habilitada, umbral 10 MB |
   | Exit actions | Reiniciar después de 3000 ms |

   Aceptá, iniciá con `Start-Service BrisasPOS` y comprobá `Get-Service BrisasPOS`, `Invoke-RestMethod http://127.0.0.1:3000/api/health` y los logs. El servicio debe arrancar sin inicio de sesión de Windows. No ejecutes a la vez `npm run dev` ni otra instancia de producción. Si un servicio recién instalado no arranca, inspeccioná `brisas-error.log` **antes** de volver a ejecutar migraciones o seed.
9. En el monitor de caja abrí `http://localhost:3000/caja`. Para cocina usá **otro perfil de Chrome/Edge** (o un navegador diferente) y `http://localhost:3000/cocina`. Dos pestañas del mismo perfil comparten `localStorage`: cocina podría sustituir la sesión de caja. Dejá una ventana por monitor; comprobá que cerrar/reabrir cocina no cierre la caja. Si nadie inicia sesión de Windows tras reiniciar, el servicio seguirá, pero esas ventanas no aparecerán solas: dejá una rutina de apertura de sesión para el personal y probala.

## Fase B. Red real en el restaurante, sin acceso al router

1. Conectá PC y teléfonos al WiFi real. En la PC:

   ```powershell
   Get-NetIPConfiguration
   Get-NetConnectionProfile
   hostname
   ```

   Anotá SSID, IP IPv4, máscara/prefijo, puerta de enlace y DNS, sin compartir la contraseña del WiFi en documentos. Probá por lo menos un Android, un iPhone si se usará, el punto de cocina y el extremo de terraza. Desactivá datos móviles en los teléfonos al probar. Si el WiFi aísla clientes entre sí, la PC responderá localmente pero los teléfonos no; sin poder cambiar el router, eso exige ayuda del administrador de la red o otra topología.
2. Desde cada dispositivo abrí `http://<IP-actual>:3000/api/health`. Luego probá `http://<NOMBRE-PC>:3000/api/health`. Solo usá el nombre como dirección habitual si **todos** los dispositivos lo resuelven antes/después de reiniciar router y PC. Si la IP cambia, repetí esta prueba y comprobá que los marcadores sigan sirviendo. Nunca asumas que `.50` está libre por ser un número bajo.
3. Windows Firewall: permití TCP 3000 únicamente en el perfil y la subred que efectivamente usás. Si la red está marcada Pública, no cambies todo el equipo a Privada sin revisar que el uso compartido de archivos/impresoras permanezca desactivado. Comprobá con `Get-NetFirewallRule` y desde un teléfono. **Esta regla permite también a los clientes del mismo WiFi alcanzar el puerto**; no resuelve el problema de seguridad del punto inicial. No abras 3000 ni 3389 en el router a internet.
4. Probá cobertura y respuesta en cocina, caja y terraza con varias cargas de página y pedidos de ensayo. Una señal con barras no demuestra que WebSocket funcione; la prueba es que la comanda aparezca, suene y cambie en vivo. Si solo se actualiza al recargar o 30–60 s después, hay un problema de tiempo real.
5. Antes de pasar de datos de ensayo a clientes, completá la protección de la red compartida indicada arriba. Una opción sin administrar el router es un acceso cifrado por dispositivo y HTTPS confiable (por ejemplo, Tailscale Serve), pero requiere instalar/configurar cada teléfono y la PC, adaptar la validación de orígenes actual que solo acepta IP privadas/localhost, controlar el acceso público de cocina y probar la continuidad durante una caída de internet. Además, [Tailscale Personal es para uso no comercial](https://tailscale.com/pricing). **No actives Serve/Funnel ni cambies la URL de los teléfonos sin esas pruebas.** Un túnel remoto solo en la PC sirve para soporte, no protege las sesiones HTTP de los teléfonos en el WiFi compartido.

## Fase C. USB y respaldos

1. Etiquetá la llave `BRISAS_BACKUP`, asignale una letra persistente, por ejemplo `E:`, desde Administración de discos, y comprobá `Get-Volume -DriveLetter E`. Los scripts comprueban la **etiqueta**, así que otra unidad con letra E no recibirá datos. Usá una llave fiable y capacidad suficiente para 30 días; el respaldo local va a `C:\BrisasPOS\respaldos`.
2. Cifrá la llave con BitLocker To Go si esta edición de Windows lo permite; guardá la clave de recuperación fuera de la PC y fuera de la propia llave. Comprobá que el **mismo usuario que ejecutará la tarea** pueda abrir `E:\` tras reiniciar sin intervención. Windows Home puede carecer de la administración de BitLocker; verificá antes de prometer cifrado automático. Si no hay cifrado disponible, la llave con nombres y teléfonos de clientes no debe quedarse expuesta sin una solución equivalente.
3. Con la base de ensayo funcionando y `sqlite3.exe` en PATH, ejecutá:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\BrisasPOS\scripts\backup.ps1 -UnidadUsb E: -ExigirUsb
   Get-ChildItem C:\BrisasPOS\respaldos -Filter 'brisas_*.sqlite' | Sort-Object LastWriteTime -Descending | Select-Object -First 1 Name,Length
   Get-ChildItem E:\BrisasPOS\respaldos -Filter 'brisas_*.sqlite' | Sort-Object LastWriteTime -Descending | Select-Object -First 1 Name,Length
   ```

   La fuente se lee de `packages\backend\.env`, exactamente la base que usa el servicio. El script usa `.backup`, valida `integrity_check` y SHA-256 de la copia USB. Si falta la USB, conserva el respaldo local y sale con código 2 cuando usás `-ExigirUsb`; **eso no es un respaldo USB correcto**. Si `sqlite3.exe` no está, falla explícitamente.
4. Abrí **Programador de tareas → Crear tarea**. En General: nombre `Respaldo Brisas POS`, cuenta Windows con permisos a base y USB, `Ejecutar tanto si el usuario inició sesión como si no` y `Ejecutar con los privilegios más altos`. En Desencadenadores: diario a una hora posterior al cierre (ejemplo 23:00). En Acciones: programa `powershell.exe`; argumentos `-NoProfile -ExecutionPolicy Bypass -File C:\BrisasPOS\scripts\backup.ps1 -UnidadUsb E: -ExigirUsb`; directorio de inicio `C:\BrisasPOS`. En Condiciones: no permitir que “solo si está conectada a CA” ni el estado inactivo impidan la ejecución; permitir despertar si fuera necesario, aunque la PC idealmente nunca duerme. En Configuración: reintentar si falla y mostrar el historial. Guardá y ejecutá la tarea desde el Programador; revisá **Último resultado = 0**, fecha/archivos local y USB. Repetí tras reiniciar con la sesión de Windows cerrada: el desbloqueo automático de BitLocker y la letra pueden comportarse distinto a una prueba manual. Cuando falle, revisá Historial de la tarea; no consideres suficiente que el respaldo manual funcione.
5. Para probar restauración con **solo datos de ensayo**, registrá una cuenta de prueba y su total, hacé respaldo, y usá `restaurar.ps1 -Listar` y `restaurar.ps1 -MasReciente`. El script exige el servicio instalado, detiene el servicio, verifica integridad y conserva la base previa junto a sus `-wal/-shm`. Tras arrancar, verificá `health`, la cuenta y el total. **Nunca hagas esta prueba sobre ventas reales.** Guardá una copia de la llave fuera del restaurante periódicamente: una USB siempre conectada no protege de robo, daño físico o ransomware en la PC.

## Fase D. Pasar de ensayo a producción

1. Cerrá el servicio y archivá la base de ensayo como tal. Mové también sus archivos `brisas_*.sqlite` de `C:\BrisasPOS\respaldos` y `E:\BrisasPOS\respaldos` a carpetas `ensayo` separadas, comprobando primero que el servicio esté detenido y que esos archivos son realmente del ensayo. El nombre del respaldo no distingue bases, y `-MasReciente` podría elegir uno equivocado si se mezclan. Cambiá **solo** `DATABASE_URL` a `file:C:/BrisasPOS/data/brisas.sqlite`; ejecutá `npm run db:deploy -w @brisas/backend` y `npm run db:seed` una sola vez en esa base nueva; luego iniciá el servicio. No uses `db:reset` en producción.
2. Con la dueña, corregí precios reales, productos sin precio, variantes supuestas, envases, regla de reparto y usuarias. Cambiá inmediatamente los PIN de demostración, creá PIN distintos y desactivá las identidades de ejemplo que no se utilizarán. Conservá al menos una administradora activa. Comprobá login por rol y que un PIN viejo ya no entra. Una sesión ya emitida para el mismo usuario y rol puede seguir viva hasta expirar: cerrá sesión en cada dispositivo o rotá `JWT_SECRET` **después** de configurar todos los usuarios para expulsar sesiones de prueba.
3. Hacé un respaldo nuevo de la base **de producción**, comprobaló local y en USB, y dejá un registro de fecha, tamaño y última tarea exitosa. No reutilices un archivo de respaldo de la base de ensayo para recuperar producción.
4. Registrá en un papel protegido: nombre de PC, URL que pasó las pruebas, IP actual y cómo verla, ruta de la base, letra/etiqueta USB, nombre del servicio, cuenta de tarea, clave de recuperación guardada fuera de la PC y contacto de soporte. No escribas PIN ni `JWT_SECRET` en ese papel.

## Fase E. RDP desde casa

El servidor seguirá dentro del restaurante: RDP es para administrar la **PC**, no una forma de servir la app a las meseras. Requiere internet en ambos extremos, PC encendida y sesión remota permitida. En la PC comprobá `Get-ComputerInfo | Select WindowsProductName`.

- **Windows 11 Pro/Education/Enterprise:** instalá Tailscale en PC y equipo de casa, con una cuenta controlada por vos para soporte y MFA. Activá [Run Unattended](https://tailscale.com/docs/how-to/run-unattended) en la PC y verificá que vuelve después de reiniciar, antes de moverla. En Windows → Sistema → Escritorio remoto, habilitá RDP con NLA, contraseña Windows larga y única, y una cuenta de soporte separada de la de caja. Restringí en Firewall la regla RDP al dispositivo/IP de Tailscale de casa y probá `mstsc` hacia la dirección Tailscale de la PC primero en casa con otra conexión (por ejemplo, datos móviles), luego desde el restaurante. No crees redirección de puerto 3389 en el router. Revisá [caducidad de la clave del dispositivo](https://tailscale.com/docs/features/access-control/key-expiry) y plan comercial antes de depender del acceso.
- **Windows 11 Home:** no puede alojar RDP nativo. [Chrome Remote Desktop](https://support.google.com/chrome/answer/1649523) ofrece acceso desatendido en Windows sin abrir puertos, sujeto a cuenta Google, PIN fuerte e internet; probá si afecta las dos pantallas. Para asistencia con alguien presente está [Asistencia rápida](https://learn.microsoft.com/es-es/windows/client-management/client-tools/quick-assist), que exige aceptación en la PC.

RDP en Windows cliente puede bloquear/desplazar la consola física. Programá mantenimiento **fuera del horario de servicio** y hacé una prueba con una persona mirando ambos monitores antes de adoptarlo. Tras una caída de internet en el restaurante no podrás entrar desde casa aunque la app local aún funcione.

## Actualizaciones y verificación diaria

Antes de actualizar, confirmá que **el respaldo local y USB de la base de producción** terminó y pasó integridad. Detené el servicio, guardá paquete de versión y base anterior, instalá la nueva versión exacta, `npm ci`, `npm run build`, `npm run db:deploy -w @brisas/backend`, iniciá y repetí salud, login, comanda en vivo y cobro de ensayo. No corras `db:seed` como rutina de actualización: puede sobrescribir cambios de menú y reactivar usuarios de demostración. No actualices durante el servicio.

Cada mañana comprobá servicio, fecha del último respaldo USB, espacio libre en PC/USB, enlace de ambos monitores y una comanda de prueba. Una vez al mes restaurá una **copia** en una instalación aislada; no sustituyas la base de ventas para practicar.

Fuentes técnicas: [service workers requieren contexto seguro](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API); [ediciones compatibles con RDP](https://learn.microsoft.com/en-us/windows-server/remote/remote-desktop-services/remotepc/remote-desktop-allow-access); [Tailscale normalmente no requiere puertos de router](https://tailscale.com/docs/reference/faq/firewall-ports); [conexiones Tailscale sin coordinación/internet](https://tailscale.com/docs/reference/coordination-server-down); [BitLocker To Go](https://learn.microsoft.com/en-us/windows/security/operating-system-security/data-protection/bitlocker/faq).
