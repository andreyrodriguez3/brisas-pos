# Preparación de la red y los dispositivos

Guía de instalación en sitio. Se hace **una sola vez**, con el restaurante cerrado, y se prueba antes de que llegue el primer cliente.

---

## 0. Antes de ir — medir la cobertura WiFi

Es lo primero, y es lo que más veces obliga a cambiar el plan. Con el celular parado en cada punto:

| Punto | Señal mínima aceptable |
|---|---|
| Cocina (donde va la tablet) | 2 barras y `ping` estable al router |
| Barra / caja | 3 barras |
| Salón interior | 2 barras |
| Terraza, mesa más lejana | 2 barras |

```bash
ping -t 192.168.1.1        # Windows
ping 192.168.1.1           # Linux/macOS
```

Buscá pérdidas de paquete y picos de latencia arriba de 100 ms. Si algún punto no llega, la solución es un repetidor o un punto de acceso adicional — costo bajo, **pero hay que detectarlo antes, no el día de la instalación**.

Anotá también: marca y modelo del router, y si hay acceso administrativo.

---

## 0.1 Red de invitados, si el router la ofrece

El sistema corre sin cifrar (HTTP, no HTTPS): no hay forma práctica de tener un
certificado confiable en una red sin dominio ni internet, y montar uno
autofirmado le mostraría a cada celular nuevo una advertencia de "conexión no
segura" que hay que aceptar a mano — justo la fricción que este sistema evita
en todo lo demás.

La mitigación real es de red, no de código: **si el router del restaurante
ofrece una red de invitados** (la mayoría de los routers comerciales y muchos
domésticos la traen), activala y dejá ahí a los clientes que quieran wifi para
navegar. Así nadie sentado en una mesa comparte el mismo segmento que los
celulares de las meseras, la tablet de cocina o la PC de caja.

Si el router no tiene esa opción, no es bloqueante — es una sola red
compartida, como ya es hoy la mayoría de los locales chicos. El punto que
importa (que nadie pueda escuchar el tráfico en tiempo real sin haber entrado
con su PIN) ya está resuelto del lado del sistema.

> 📄 **Nota aparte:** la duración de la sesión de mesera (hoy 30 días) y de
> caja (hoy 12 horas) se ajusta con las variables `JWT_EXPIRES_MESERA` y
> `JWT_EXPIRES_CAJA` en `.env`, sin tocar código, si algún día se quiere
> acortar.

---

## 1. IP fija en la PC de caja

Se asigna desde la propia PC, **sin tocar el router**: el router no es nuestro y puede que no tengamos la clave.

**Windows 11** → Configuración → Red e Internet → (Wi-Fi o Ethernet) → Propiedades del hardware → Configuración IP → Editar → **Manual** → activar IPv4

**Windows 10** → Configuración → Red e Internet → (Wi-Fi o Ethernet) → tocar la red conectada → Configuración de IP → Editar → **Manual** → activar IPv4

(En cualquiera de las dos versiones, la alternativa que nunca cambia de lugar es Panel de control clásico → Centro de redes y recursos compartidos → cambiar configuración del adaptador → clic derecho en la red → Propiedades → Protocolo de Internet versión 4 (TCP/IPv4) → Propiedades.)

Los campos son los mismos:

| Campo | Ejemplo |
|---|---|
| Dirección IP | `192.168.1.50` |
| Máscara de subred | `255.255.255.0` |
| Puerta de enlace | `192.168.1.1` (la del router) |
| DNS preferido | `1.1.1.1` |

Elegí una IP **fuera del rango DHCP** del router (normalmente el DHCP reparte de `.100` en adelante, así que `.50` es seguro).

Comprobá:

```powershell
ipconfig | Select-String "IPv4"
```

> 📄 **Escribí la IP en un papel y pegalo a la PC.** El día que algo falle, es el primer dato que alguien va a necesitar y nadie va a recordar dónde estaba.

---

## 2. Firewall

```powershell
# PowerShell como administrador
New-NetFirewallRule -DisplayName "Brisas POS" -Direction Inbound `
  -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

Solo perfil `Private`. Si Windows tiene la red del restaurante marcada como pública, cambiala a privada primero (Configuración → Red → Propiedades → Red privada).

**Prueba real:** desde un celular conectado al WiFi del restaurante, abrir

```
http://192.168.1.50:3000/api/health
```

Tiene que responder `{"ok":true,...}`. Si no responde, revisá en este orden: el servicio corre → `HOST=0.0.0.0` en `.env` → la regla de firewall → el celular está en el WiFi y no en datos móviles.

---

## 3. Tablet de cocina en modo kiosco

La tablet va **montada en la pared o en un soporte fijo, conectada al cargador de forma permanente**. Nunca pide login.

### 3.1 Ajustes del sistema (Android)

1. **Pantalla → Tiempo de espera: nunca** (o el máximo disponible).
2. **Brillo al máximo**, brillo automático **desactivado** — la cocina cambia mucho de luz y el ajuste automático la deja ilegible.
3. **Rotación bloqueada** en horizontal.
4. **Notificaciones desactivadas** para todas las apps: nada debe taparle la cola de comandas.
5. **Actualizaciones automáticas del sistema: desactivadas.** Una actualización a las 12:30 p.m. es un problema.
6. Conectar al WiFi del restaurante y marcar la red como **automática**.

### 3.2 Instalar la app

1. Abrir Chrome en `http://192.168.1.50:3000/cocina`.
2. Menú (⋮) → **Instalar aplicación** / *Agregar a pantalla de inicio*.
3. Abrirla desde el ícono: tiene que salir a pantalla completa, sin barra de direcciones.

### 3.3 Fijar en modo kiosco

**Opción simple — Anclaje de pantalla (Android nativo):**

Ajustes → Seguridad → Avanzado → **Anclaje de pantalla / Fijar aplicación** → activar, y activar también "Pedir PIN antes de dejar de fijar". Abrir Brisas, botón de recientes, ícono de la app → **Fijar**.

**Opción robusta — app de kiosco** (recomendada para el uso diario): *Fully Kiosk Browser* o similar, apuntando a la misma URL, con reinicio automático al arrancar la tablet.

### 3.4 Comprobación

- Reiniciar la tablet → tiene que volver sola a la pantalla de cocina, sin que nadie toque nada.
- Apagar el WiFi 10 segundos → banner rojo **SIN CONEXIÓN** y las comandas ya recibidas **siguen en pantalla**.
- Volver a encender → el banner desaparece solo, sin recargar.

---

## 4. Celulares de las meseras

1. Abrir Chrome (Android) o Safari (iPhone) en `http://192.168.1.50:3000`.
2. **Agregar a pantalla de inicio** / *Instalar aplicación*.
3. Entrar una vez con el PIN: la sesión dura 30 días, así que no hay que loguearse cada rato.
4. **Subir el volumen de notificaciones**: el celular avisa cuando un pedido pasa a LISTO.

Si el WiFi falla un momento, el pedido queda en cola local con un indicador visible de "pendiente de enviar" y se manda solo al volver la señal. Explicáselo a cada mesera en la capacitación: es la parte que más tranquiliza.

---

## 5. Computadora de caja

Es servidor **y** estación de trabajo. En su propio navegador:

1. Abrir `http://localhost:3000` (o la IP fija; da igual).
2. Instalar como aplicación para que abra sin barra de direcciones.
3. Ponerla en el arranque de Windows para que quede lista al encender.

---

## 6. Lista de comprobación final

Antes de dar por instalado, todo esto tiene que pasar **con el restaurante cerrado y alguien mirando**:

- [ ] `http://<IP>:3000/api/health` responde `{"ok":true}` desde un celular en el WiFi
- [ ] La tablet de cocina abre sola tras reiniciarla, sin login
- [ ] Una mesera toma un pedido de prueba desde su celular
- [ ] El pedido aparece en la tablet de cocina en **menos de 2 segundos**
- [ ] Cocina lo lleva a EN PREPARACIÓN y a LISTO; el celular de la mesera avisa
- [ ] Caja ve la cuenta con el total correcto
- [ ] Se apaga la PC, se enciende, y el sistema vuelve **solo** (sin abrir terminal)
- [ ] Se corre el respaldo y **se prueba la restauración**
- [ ] La IP está escrita en un papel pegado a la PC
- [ ] La UPS está conectada a la PC **y al router** (si el cliente la compró)

---

## 7. Datos para dejar por escrito al cliente

| Dato | Valor |
|---|---|
| Dirección del sistema | `http://______________:3000` |
| Ubicación de la base de datos | `______________` |
| Ubicación de los respaldos | local: `__________` · USB: `__________` |
| Nombre del servicio | `BrisasPOS` (NSSM) |
| Contacto de soporte | `______________` |
