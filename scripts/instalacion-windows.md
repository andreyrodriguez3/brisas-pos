# Instalación en la PC de caja (Windows)

Se hace **una sola vez**, con el restaurante cerrado. Al terminar, el sistema tiene que arrancar solo al encender la computadora, sin que nadie abra una terminal.

La red y los dispositivos van en `setup-red.md`. Esto es solo la PC servidor.

---

## 1. Preparar la carpeta

Poné el proyecto fuera del escritorio y fuera de OneDrive — una carpeta sincronizada corrompe la base de datos:

```
C:\BrisasPOS\
```

```powershell
cd C:\BrisasPOS
npm install
npm run build
```

## 2. Configuración

```powershell
copy .env.example packages\backend\.env
npm run secreto:escribir
```

Y editá `packages\backend\.env`:

```ini
DATABASE_URL="file:C:/BrisasPOS/data/brisas.sqlite"
HOST=0.0.0.0
PORT=3000
NODE_ENV=production
```

> ⚠️ `HOST` **tiene** que ser `0.0.0.0`. Con `127.0.0.1` la PC se ve a sí misma y ningún celular ni la tablet se pueden conectar. Es el error que deja el sistema funcionando en la demo y muerto el día de la instalación.
>
> ⚠️ Con `NODE_ENV=production` el servidor **no arranca** si `JWT_SECRET` quedó con el valor de ejemplo. Es a propósito.

```powershell
npm run db:migrate
npm run db:seed
```

## 3. Instalar como servicio con NSSM

PM2 no registra servicios de Windows de forma confiable. Se usa [NSSM](https://nssm.cc/download): descargalo, descomprimilo y copiá `win64\nssm.exe` a `C:\BrisasPOS\`.

Abrí PowerShell **como administrador**:

```powershell
cd C:\BrisasPOS
.\nssm.exe install BrisasPOS
```

Se abre una ventana. Llenala así:

| Pestaña | Campo | Valor |
|---|---|---|
| **Application** | Path | `C:\Program Files\nodejs\node.exe` |
| | Startup directory | `C:\BrisasPOS` |
| | Arguments | `packages\backend\dist\main.js` |
| **Details** | Display name | `Brisas POS` |
| | Description | `Sistema de pedidos del restaurante` |
| | Startup type | `Automatic` |
| **I/O** | Output (stdout) | `C:\BrisasPOS\logs\brisas-out.log` |
| | Error (stderr) | `C:\BrisasPOS\logs\brisas-error.log` |
| **File rotation** | Rotate files | ✅ |
| | Restrict rotation to files bigger than | `10485760` (10 MB) |
| **Exit actions** | Restart | `Restart application` |
| | Delay restart by | `3000` ms |

Sin la rotación de logs, el archivo crece hasta llenar el disco en unos meses y el sistema se cae sin motivo aparente.

Después:

```powershell
.\nssm.exe start BrisasPOS
.\nssm.exe status BrisasPOS      # tiene que decir SERVICE_RUNNING
```

Comprobá en el navegador: `http://localhost:3000/api/health` → `{"ok":true, ...}`

### Alternativa con PM2 (Linux, o Windows si preferís)

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup                      # solo Linux/macOS

pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

## 4. Firewall

```powershell
New-NetFirewallRule -DisplayName "Brisas POS" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

Solo perfil `Private`: la red del restaurante. No abras el puerto a `Public`.

## 5. Respaldo automático

Programalo en el **Programador de tareas** (Task Scheduler):

- **Nombre:** Respaldo Brisas POS
- **Desencadenador:** Diariamente, a las 11:00 p.m. (después del cierre)
- **Acción:** Iniciar un programa
  - Programa: `powershell.exe`
  - Argumentos: `-NoProfile -ExecutionPolicy Bypass -File C:\BrisasPOS\scripts\backup.ps1`
- **Configuración:** ✅ Ejecutar tanto si el usuario inició sesión como si no

Dejá una **llave USB conectada permanentemente** en `E:`. El script copia ahí además de la carpeta local. Si la letra es otra, pasala:
`-File ... -UnidadUsb F:`

> ⚠️ La base tiene nombres y teléfonos de clientes de pedidos para llevar, sin cifrar. Si esa llave se pierde o la roban, esos datos se van con ella. Cifrala con **BitLocker To Go** antes de dejarla conectada (clic derecho sobre la unidad en el Explorador → *Activar BitLocker*): una vez activado, Windows la desbloquea solo en esa PC y no vuelve a pedir nada en el día a día.

Sin la USB conectada el respaldo local se hace igual — la advertencia sale en el log, no frena nada.

Para respaldos en caliente más seguros, instalá `sqlite3.exe` y ponelo en el PATH. Sin él, el script copia los archivos, que también sirve.

### Probar la restauración — obligatorio

**Un respaldo que nunca se restauró no es un respaldo.** Hacelo ahora, con el restaurante cerrado:

```powershell
# 1. Generá un respaldo
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup.ps1

# 2. Mirá qué hay
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\restaurar.ps1 -Listar

# 3. Restaurá el más reciente
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\restaurar.ps1 -MasReciente
```

El script hace todo: verifica que el respaldo sea una base válida **antes** de tocar la que está en uso, detiene el servicio, guarda la base actual con otro nombre por las dudas, restaura, arranca y consulta el health check.

Anotá en un papel la fecha en que lo probaste y pegalo junto a la PC.

## 6. Vigilante

NSSM reinicia el proceso cuando **muere**, pero no cuando queda vivo y colgado — que es el caso que deja la caja mirando una pantalla que no responde. Programá el vigilante:

- **Desencadenador:** Al iniciar el equipo, y repetir cada 5 minutos indefinidamente
- **Acción:** `powershell.exe`
  - Argumentos: `-NoProfile -ExecutionPolicy Bypass -File C:\BrisasPOS\scripts\vigilante.ps1`

Consulta `/api/health/ping`, y si no responde tres veces seguidas reinicia el servicio. No reinicia más de 3 veces por hora: si el problema es de configuración, reiniciar en bucle solo lo esconde.

## 7. La prueba de fuego

Antes de dar por terminada la instalación, **apagá la computadora de un botonazo** (sin apagar por menú) y encendela de nuevo.

- [ ] El sistema volvió solo, sin abrir ninguna terminal
- [ ] `http://<IP-DE-CAJA>:3000/api/health` responde `{"ok":true}`
- [ ] La tablet de cocina volvió sola a la cola de comandas
- [ ] Un celular puede entrar y abrir una cuenta

Si algo de esto falla, la instalación no está terminada.

---

## Actualizar a una versión nueva

```powershell
.\nssm.exe stop BrisasPOS
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup.ps1   # respaldo ANTES
git pull
npm install
npm run build
npm run db:migrate
.\nssm.exe start BrisasPOS
```

Nunca actualices con el restaurante abierto.

---

## Si algo falla

| Síntoma | Qué mirar |
|---|---|
| El servicio no arranca | `logs\brisas-error.log`. Si dice `JWT_SECRET`, corré `npm run secreto:escribir` |
| Los celulares no ven el sistema | `HOST=0.0.0.0` en el `.env`; la regla de firewall; que el celular esté en el WiFi y no en datos |
| "Sin conexión" solo en cocina | Cobertura WiFi: la cocina es el punto más lejos del router |
| El sistema va lento en hora pico | Debería aguantar 15 cuentas a la vez con respuestas de ~200 ms. Si no, revisá que no haya dos instancias corriendo (`.\nssm.exe status` y el Administrador de tareas) |
| La IP cambió sola | La IP fija no quedó aplicada, o está dentro del rango DHCP del router. Ver `setup-red.md` |
| El disco se llenó | Rotación de logs sin configurar (paso 3), o respaldos sin retención |
