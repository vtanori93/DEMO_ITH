import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('No se encontró el contenedor de la aplicación.')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
