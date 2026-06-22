import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/inter/index.css'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 3 min stale: reduz refetches em navegação entre páginas (INP)
      staleTime: 3 * 60 * 1000,
      // Cache persiste 10 min em memória após o componente desmontar
      gcTime: 10 * 60 * 1000,
      retry: 1,
      // Não refetch em foco de janela — evita burst de requests ao voltar de aba
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
