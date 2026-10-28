import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button } from './Button'
import styles from './ui.module.css'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('No se pudo mostrar la aplicación.', error, info.componentStack)
  }
  override render() {
    if (this.state.failed)
      return (
        <main className={`${styles.panel} ${styles.error}`}>
          <h1>No se pudo mostrar esta vista</h1>
          <p>Recarga la aplicación para volver a abrir el monitor.</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Volver a cargar
          </Button>
        </main>
      )
    return this.props.children
  }
}
