import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useBlocker } from 'react-router'
import { Button } from '../ui/Button'
import styles from './guards.module.css'

export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    when && currentLocation.pathname !== nextLocation.pathname,
  )
  const blocked = blocker.state === 'blocked'
  const dialog = useRef<HTMLDialogElement>(null)
  const keepButton = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!when) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [when])
  useEffect(() => {
    if (!blocked) return
    const element = dialog.current
    element?.showModal()
    keepButton.current?.focus()
    return () => {
      element?.close()
    }
  }, [blocked])
  return createPortal(
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault()
        if (blocker.state === 'blocked') blocker.reset()
      }}
    >
      <span className={styles.eyebrow}>TU CONFIGURACIÓN</span>
      <h2 id={`${id}-title`}>Tienes cambios sin guardar</h2>
      <p id={`${id}-description`}>Si sales ahora, los cambios de configuración se descartarán.</p>
      <div className={styles.actions}>
        <button
          ref={keepButton}
          className={styles.keepButton}
          onClick={() => { if (blocker.state === 'blocked') blocker.reset() }}
        >Seguir editando</button>
        <Button onClick={() => { if (blocker.state === 'blocked') blocker.proceed() }}>Salir sin guardar</Button>
      </div>
    </dialog>,
    document.body,
  )
}
