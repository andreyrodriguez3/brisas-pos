/** Orígenes HTTP de los dispositivos de la LAN y del entorno de desarrollo. */
export function esOrigenLan(origen: string | undefined): boolean {
  // Clientes nativos y peticiones del mismo origen pueden omitir Origin.
  if (!origen) return true;
  try {
    const url = new URL(origen);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname;
    if (['localhost', '127.0.0.1', '[::1]'].includes(host)) return true;
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
    const octetos = host.split('.').map(Number);
    if (octetos.some((octeto) => octeto > 255)) return false;
    const [a, b] = octetos;
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  } catch {
    return false;
  }
}

export function origenCorsLan(
  origen: string | undefined,
  callback: (error: Error | null, permitido: boolean) => void,
): void {
  callback(null, esOrigenLan(origen));
}
