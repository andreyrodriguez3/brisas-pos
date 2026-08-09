# Brisas POS

Sistema de punto de venta para el **Restaurante Mirador Brisas del Monte** (Costa Rica).

Tres pantallas conectadas en tiempo real por el WiFi del propio restaurante:

| Pantalla | Dispositivo | Qué hace |
|---|---|---|
| **Mesera** | Celular propio (PWA) | Abre cuentas por nombre y manda pedidos a cocina |
| **Cocina** | Tablet fija (PWA en kiosco) | Cola de comandas: nuevo → en preparación → listo |
| **Caja** | Computadora de escritorio | Cobra, divide facturas, cierra el día |

**La computadora de caja es el servidor.** Todo corre en la red local: sin internet, sin nube, sin costo mensual. Si se cae el ISP, el restaurante sigue trabajando.

> **Lo que este sistema NO hace:** no procesa cobros con datáfono ni SINPE, y no emite factura electrónica ante Hacienda. Calcula el monto; el cobro y la factura siguen exactamente como hoy, en paralelo.

---

## Requisitos

- **Node.js 20 o superior**
- Sin Docker: corre nativo en la PC de caja (Windows 10, Windows 11 o Linux)

---

## Instalación

```bash
git clone <repo> brisas-pos
cd brisas-pos
npm install

cp .env.example packages/backend/.env      # Windows: copy .env.example packages\backend\.env
npm run secreto:escribir                   # genera el JWT_SECRET de esta instalación
```

El `.env` va **en `packages/backend/`**, que es donde lo busca el servidor tanto en desarrollo como arrancado desde la raíz con `npm run start:prod`.

`npm run secreto:escribir` reemplaza `JWT_SECRET` por 64 caracteres aleatorios. No lo escribas a mano: quien tenga ese valor puede fabricarse un token de administradora desde cualquier celular del WiFi, sin saber ningún PIN. Con `NODE_ENV=production` el servidor **se niega a arrancar** si quedó el valor de ejemplo o si el secreto es más corto de 32 caracteres.

> Cambiar el secreto cierra todas las sesiones abiertas: hay que volver a marcar el PIN. La tablet de cocina pide su token sola al recargar.

Preparar la base de datos:

```bash
npm run build -w @brisas/shared   # el seed importa de shared
npm run db:migrate                # crea el esquema
npm run db:seed                   # carga el menú desde menu-seed.json
```

El seed es **idempotente**: se puede correr las veces que haga falta. Deja 84 productos, 109 variantes, las claves de configuración y cuatro usuarias de prueba con PIN `1234` (María · Cocina · Caja · Dueña).

---

## Desarrollo

```bash
npm run dev
```

Levanta el backend en `:3000` y el frontend en `:5173`, con proxy de `/api` y `/socket.io`. Vite escucha en toda la red, así que se puede probar desde el celular apuntando a `http://<IP-de-tu-máquina>:5173`.

```bash
npm test          # tests de shared y backend
npm run build     # shared → backend → frontend
npm run lint
npm run typecheck
npm run db:studio # explorador visual de la base
```

Ver `CLAUDE.md` para la arquitectura, las convenciones y las reglas de negocio con trampa.

---

## Despliegue en la PC de caja

> 📘 El procedimiento completo, paso a paso y con NSSM, está en **[`scripts/instalacion-windows.md`](scripts/instalacion-windows.md)**. Lo de acá abajo es el resumen.
>
> 📗 Manuales de usuario, uno por rol: [`docs/manual-mesera.md`](docs/manual-mesera.md) · [`docs/manual-cocina.md`](docs/manual-cocina.md) · [`docs/manual-caja.md`](docs/manual-caja.md) · [`docs/manual-administracion.md`](docs/manual-administracion.md)

### 1. Compilar

```bash
npm ci
npm run build
npm run db:deploy -w @brisas/backend    # migraciones sin prompts
npm run db:seed
```

Después del build, el backend **también sirve el frontend**: todos los dispositivos entran a una sola dirección, `http://<IP-DE-CAJA>:3000`. No hay que instalar nada en los celulares.

Poné la base fuera del escritorio, en una ruta protegida:

```ini
# packages/backend/.env
DATABASE_URL="file:C:/BrisasPOS/data/brisas.sqlite"
HOST=0.0.0.0
PORT=3000
JWT_SECRET="<lo que generó npm run secreto:escribir>"
NODE_ENV=production
```

> ⚠️ `HOST` **tiene** que ser `0.0.0.0`. Con `127.0.0.1` la PC se ve a sí misma y ningún celular ni la tablet pueden conectarse.
>
> ⚠️ Con `NODE_ENV=production` el servidor no arranca si `JWT_SECRET` quedó en el valor de ejemplo. Es a propósito: un `.env` copiado tal cual es el error más fácil de cometer el día de la instalación, y el único que no se nota — todo funcionaría perfecto.

### 2. IP fija

Se asigna desde la configuración de red **de la propia PC**, sin tocar el router — el router no es nuestro y puede que no tengamos la clave.

Windows → Configuración → Red e Internet → Propiedades del adaptador → Configuración IP → Editar → Manual:

| Campo | Valor de ejemplo |
|---|---|
| Dirección IP | `192.168.1.50` |
| Máscara | `255.255.255.0` |
| Puerta de enlace | la IP del router (`192.168.1.1` normalmente) |
| DNS | `1.1.1.1` |

Elegí una IP **fuera del rango DHCP** del router para que no se la asigne a otro equipo.

**Anotá la IP en un papel y pegalo a la PC.** El día que algo falle, es el primer dato que alguien va a necesitar.

### 3. Firewall

Abrir el puerto 3000 para la red privada:

```powershell
New-NetFirewallRule -DisplayName "Brisas POS" -Direction Inbound `
  -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

Comprobación: desde el celular, en el WiFi del restaurante, abrir `http://192.168.1.50:3000/api/health`. Tiene que responder `{"ok":true,...}`.

### 4. Arranque automático

**Linux/macOS — PM2:**

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # y ejecutar el comando que imprime
```

**Windows — NSSM** (PM2 no registra servicios de forma confiable en Windows):

1. Descargar NSSM de <https://nssm.cc/download> y descomprimir en `C:\nssm`.
2. En PowerShell **como administrador**:

```powershell
C:\nssm\win64\nssm.exe install BrisasPOS
```

En la ventana que abre:

| Pestaña | Campo | Valor |
|---|---|---|
| Application | Path | `C:\Program Files\nodejs\node.exe` |
| Application | Startup directory | `C:\BrisasPOS` |
| Application | Arguments | `packages\backend\dist\main.js` |
| Details | Display name | `Brisas POS` |
| I/O | Output / Error | `C:\BrisasPOS\logs\brisas.log` |
| Exit actions | Restart delay | `3000` |

Luego:

```powershell
nssm start BrisasPOS
nssm status BrisasPOS
```

**Probalo de verdad:** apagá la PC, encendela, y sin abrir ninguna terminal comprobá que `http://192.168.1.50:3000` responde. Si no vuelve solo, no está listo.

### 5. Respaldos

```bash
scripts/backup.sh          # Linux/macOS
scripts\backup.ps1         # Windows
```

Copian el `.sqlite` (con sus archivos `-wal` y `-shm`) con marca de tiempo, retienen 30 días y escriben a una carpeta local **y** a una llave USB permanentemente conectada.

Programalo diario. En Windows:

```powershell
schtasks /create /tn "Respaldo Brisas POS" /tr `
  "powershell -ExecutionPolicy Bypass -File C:\BrisasPOS\scripts\backup.ps1" `
  /sc daily /st 23:30 /ru SYSTEM
```

**La restauración tiene su propio script**, que verifica el respaldo antes de tocar la base en uso, guarda la actual por las dudas y comprueba el health check al terminar:

```powershell
scripts\restaurar.ps1 -Listar         # qué respaldos hay
scripts\restaurar.ps1 -MasReciente    # restaurar el último
```

> **Probala durante la instalación**, con el restaurante cerrado. Un respaldo que nunca se restauró no es un respaldo — y esta prueba ya encontró un caso en que el `.sqlite` se restauraba sin su `-wal` y se perdían en silencio las últimas ventas.

### 5.1 Vigilante

`scripts\vigilante.ps1` consulta `/api/health/ping` y reinicia el servicio si no responde tres veces seguidas. Existe porque NSSM reinicia el proceso cuando **muere**, pero no cuando queda vivo y colgado. Programalo cada 5 minutos.

### 6. Tablet de cocina en modo kiosco

Ver `scripts/setup-red.md` para el paso a paso completo (Android y navegador de escritorio), más la comprobación de cobertura WiFi en cocina y salón.

Resumen: la tablet abre `http://192.168.1.50:3000/cocina`, se instala como PWA y se fija con una app de kiosco para que nadie pueda salir de la pantalla. **No pide login nunca.**

### 7. UPS

Es hardware del cliente y no está cotizado, pero hay que insistir: **sin UPS, un corte de luz a las 12:30 p.m. congela el restaurante.** Una UPS de 600 VA para la PC y el router alcanza.

---

## Solución de problemas

| Síntoma | Qué revisar |
|---|---|
| Los celulares no ven el sistema | `HOST=0.0.0.0` en `.env`; regla de firewall; que el celular esté en el WiFi del restaurante y no en datos móviles |
| "Sin conexión" en cocina pero la PC funciona | Cobertura WiFi en la cocina — es el punto más lejos del router |
| El sistema no vuelve tras un reinicio | `nssm status BrisasPOS` (Windows) o `pm2 list` (Linux) |
| La IP cambió sola | La IP fija no quedó aplicada, o está dentro del rango DHCP del router |
| Un producto no aparece para pedir | Está `activo = false`, marcado como agotado del día, o no tiene precio cargado |
| Va lento con varias mesas a la vez | Debería aguantar 15 cuentas simultáneas con respuestas de ~200 ms. Si no, revisá que no haya **dos instancias** corriendo: SQLite es un archivo único y solo puede haber un proceso |
| El disco se llenó | Rotación de logs sin configurar, o respaldos sin retención |

Logs: `logs/brisas-*.log` (PM2) o la ruta configurada en NSSM.
Estado del servidor: `http://<IP>:3000/api/health` · sonda liviana: `/api/health/ping`.

---

## Notas de seguridad

Es una red local en un restaurante, no un banco — pero conviene tener presente:

- **El PIN va hasheado con argon2**, con bloqueo temporal tras 5 intentos fallidos.
- **El rol se valida en el backend, en todos los endpoints.** Hay una prueba que recorre las 49 rutas contra los 5 roles (245 combinaciones) y verifica que cada una acepte solo a quien debe.
- **`POST /auth/cocina` es público a propósito**: la tablet arranca sola en modo kiosco y no puede pedir un PIN. Eso significa que cualquiera en el WiFi puede obtener un token de cocina, así que ese token está acotado a lo mínimo: leer la cola y mover el estado de una comanda. **No** puede abrir cuentas, editarlas, traspasarlas, crear pedidos, cobrar ni ver reportes.
- **La bitácora no tiene endpoint de borrado ni de edición.** No existe y no debe existir.
- **El `JWT_SECRET` se genera con `npm run secreto:escribir`** y en producción el servidor no arranca con el valor de ejemplo.
- La base vive en una ruta protegida, fuera del escritorio y **fuera de OneDrive** — una carpeta sincronizada corrompe SQLite.

---

## Documentos del proyecto

- `plan-de-trabajo.md` — alcance, reglas de negocio, cronograma y términos comerciales
- `prompt-claude-code.md` — prompt de scaffold y los prompts de seguimiento
- `CLAUDE.md` — arquitectura, invariantes y convenciones para trabajar en el código
- `scripts/instalacion-windows.md` — instalación completa en la PC de caja
- `scripts/setup-red.md` — red, IP fija, cobertura WiFi y tablet en modo kiosco
- `docs/manual-*.md` — manuales de usuario, uno por rol
- `menu-seed.json` — menú transcrito de las fotos de Google Maps (provisional en precios)
