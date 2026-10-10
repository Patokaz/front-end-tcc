import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import { App } from './app/App'

/**
 * Com VITE_USAR_MOCKS=true, o servidor simulado (MSW) responde às chamadas de /api/v1
 * até o backend FastAPI existir. Com "false", nada do mock entra no bundle.
 */
async function iniciarDadosSimulados() {
  if (import.meta.env.VITE_USAR_MOCKS !== 'true') return
  const { iniciarServidorSimulado } = await import('./mocks/navegador')
  await iniciarServidorSimulado()
}

iniciarDadosSimulados().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
