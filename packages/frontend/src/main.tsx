import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { ErrorApi } from './shared/api/cliente';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Los datos operativos llegan por Socket.IO, no por polling.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: (intentos, error) => {
        // La sesión vencida no se reintenta: hay que volver a marcar el PIN.
        if (error instanceof ErrorApi && error.estado === 401) return false;
        return intentos < 3;
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
