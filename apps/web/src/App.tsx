import { useEffect, useState } from 'react';
import { MODULES } from '@microslab/contracts';

/** Pantalla provisional de la Fase 0: confirma que la app compila y habla con la API. */
export function App() {
  const [api, setApi] = useState<'comprobando' | 'ok' | 'sin conexión'>('comprobando');

  useEffect(() => {
    fetch('/api/v1/health')
      .then((r) => setApi(r.ok ? 'ok' : 'sin conexión'))
      .catch(() => setApi('sin conexión'));
  }, []);

  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ color: 'var(--ms-color-primary)' }}>MICROSLAB 3.0</h1>
      <p>
        Fase 0 · API: {api} · {MODULES.length} módulos registrados
      </p>
    </main>
  );
}
