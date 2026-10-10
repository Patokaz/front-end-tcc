import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { ProvedorToast } from '@/ui/Toast'
import { criarClienteQuery } from './consultas/cliente'
import { ProvedorAutenticacao } from './funcionalidades/autenticacao/ProvedorAutenticacao'
import { ProvedorPreferencias } from './preferencias'
import { roteador } from './rotas'

export function App() {
  const [clienteQuery] = useState(criarClienteQuery)
  return (
    <QueryClientProvider client={clienteQuery}>
      <ProvedorPreferencias>
        <ProvedorToast>
          <ProvedorAutenticacao>
            <RouterProvider router={roteador} />
          </ProvedorAutenticacao>
        </ProvedorToast>
      </ProvedorPreferencias>
    </QueryClientProvider>
  )
}
