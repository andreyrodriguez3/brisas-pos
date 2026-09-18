import { describe, expect, it } from 'vitest';
import { esOrigenLan, origenCorsLan } from './origen-lan';

describe('orígenes permitidos para REST y Socket.IO', () => {
  it.each([
    undefined,
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://[::1]:5173',
    'http://192.168.100.61:5173',
    'https://10.0.0.1',
    'http://172.16.0.1',
    'http://172.31.255.255',
  ])('permite dispositivos locales: %s', (origen) => {
    expect(esOrigenLan(origen)).toBe(true);
  });

  it.each([
    'https://example.com',
    'http://localhost.example.com',
    'http://192.168.1.1.example.com',
    'http://172.15.0.1',
    'http://172.32.0.1',
    'http://8.8.8.8',
    'http://192.168.999.1',
    'file://localhost',
    'null',
    'origen-invalido',
  ])('rechaza orígenes externos o inválidos: %s', (origen) => {
    expect(esOrigenLan(origen)).toBe(false);
  });

  it('entrega al middleware la misma decisión', () => {
    origenCorsLan('https://example.com', (error, permitido) => {
      expect(error).toBeNull();
      expect(permitido).toBe(false);
    });
  });
});
