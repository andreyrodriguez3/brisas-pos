/**
 * `crypto.randomUUID()` solo existe en contextos seguros (HTTPS o localhost).
 * El sistema corre en la LAN del restaurante por HTTP plano sobre una IP
 * (http://<IP-DE-CAJA>:3000), así que en el celular de la mesera y en la
 * tablet de cocina esa función no existe y explota en silencio.
 *
 * `idempotencia_key` viaja al backend y `enviarPedidoSchema` la valida con
 * `z.string().uuid()`, así que el reemplazo tiene que tener forma de UUID v4
 * real, no cualquier string único. `crypto.getRandomValues` sí funciona sin
 * contexto seguro (a diferencia de `randomUUID`), así que se arma el UUID a mano.
 */
export function generarId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versión 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
