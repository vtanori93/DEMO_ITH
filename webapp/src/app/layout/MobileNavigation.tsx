import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { routes } from '../routes'
import { NavLink } from 'react-router'
import { Icon } from '../../shared/ui/Icon'
import { DeviceStateLabel } from '../../features/gateway/ui/GatewayPresence'
import styles from './MobileNavigation.module.css'

export function MobileNavigation({ route }: { route: string | null }) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)
  const closing = useRef(false)
  const resetScroll = useRef(false)
  const scrollPosition = useRef(0)
  const pointerStartedOutside = useRef(false)
  const [open, setOpen] = useState(false)
  const [animatingOut, setAnimatingOut] = useState(false)

  const requestClose = useCallback((navigate = false) => {
    if (navigate) resetScroll.current = true
    if (!dialog.current?.open || closing.current) return
    closing.current = true
    setAnimatingOut(true)
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180
    closeTimer.current = window.setTimeout(() => dialog.current?.close(), duration)
  }, [])

  useEffect(() => {
    if (!open) return
    const scrollY = scrollPosition.current
    const body = document.body
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    Object.assign(body.style, {
      position: 'fixed',
      top: `-${scrollY}px`,
      left: '0',
      right: '0',
      width: '100%',
      overflow: 'hidden',
    })
    return () => {
      Object.assign(body.style, previous)
      window.scrollTo(0, resetScroll.current ? 0 : scrollY)
      resetScroll.current = false
    }
  }, [open])

  useEffect(() => {
    requestClose(true)
  }, [route, requestClose])
  useEffect(() => {
    const desktop = matchMedia('(min-width: 1024px)')
    const resize = () => {
      if (desktop.matches) dialog.current?.close()
    }
    desktop.addEventListener('change', resize)
    return () => {
      desktop.removeEventListener('change', resize)
      window.clearTimeout(closeTimer.current)
    }
  }, [])

  function show() {
    if (!dialog.current || dialog.current.open) return
    resetScroll.current = false
    closing.current = false
    setAnimatingOut(false)
    scrollPosition.current = window.scrollY
    dialog.current.showModal()
    setOpen(true)
    closeButton.current?.focus({ preventScroll: true })
  }
  function afterClose() {
    window.clearTimeout(closeTimer.current)
    closing.current = false
    setOpen(false)
    setAnimatingOut(false)
    if (resetScroll.current || matchMedia('(min-width: 1024px)').matches)
      document.getElementById('main-content')?.focus({ preventScroll: true })
    else trigger.current?.focus({ preventScroll: true })
  }
  function outside(x: number, y: number) {
    const bounds = dialog.current?.getBoundingClientRect()
    return !!bounds && (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom)
  }

  function handleKeyboard(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return
    const controls = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], [tabindex="0"]',
      ),
    ].filter((element) => element.getClientRects().length > 0)
    if (!controls.length) return
    event.preventDefault()
    const current = document.activeElement instanceof HTMLElement
      ? controls.indexOf(document.activeElement)
      : -1
    const next =
      current < 0
        ? event.shiftKey
          ? controls.length - 1
          : 0
        : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length
    controls[next]?.focus()
  }

  return (
    <>
      <button
        ref={trigger}
        className={styles.trigger}
        aria-label="Abrir menú de navegación"
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        data-open={open}
        onClick={show}
      >
        <span className={styles.hamburger} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>Menú</span>
      </button>
      {createPortal(
        <dialog
          ref={dialog}
          id={id}
          className={`${styles.drawer} ${animatingOut ? styles.closing : ''}`}
          aria-label="Menú de navegación"
          aria-describedby={`${id}-description`}
          onCancel={(event) => {
            event.preventDefault()
            requestClose()
          }}
          onClose={afterClose}
          onKeyDown={handleKeyboard}
          onPointerDown={(event) => {
            pointerStartedOutside.current = outside(event.clientX, event.clientY)
          }}
          onClick={(event) => {
            if (pointerStartedOutside.current && outside(event.clientX, event.clientY))
              requestClose()
          }}
        >
          <div className={styles.header}>
            <div className={styles.brand} aria-label="Voltio">
              <span className={styles.brandMark}>
                <Icon name="pulse" size={25} />
              </span>
              voltio<span className={styles.brandDot}>.</span>
            </div>
            <button
              ref={closeButton}
              className={styles.closeButton}
              onClick={() => requestClose()}
              aria-label="Cerrar menú"
            >
              <Icon name="close" size={21} />
            </button>
          </div>
          <div className={styles.intro}>
            <span className={styles.eyebrow}>
              <span />
              ESPACIO DE TRABAJO
            </span>
            <h2>
              Tu espacio.<span>Tus señales.</span>
            </h2>
            <p id={`${id}-description`}>Selecciona dónde quieres continuar.</p>
            <svg className={styles.wave} viewBox="0 0 210 48" fill="none" aria-hidden="true">
              <path d="M0 29h42l9-9 9 17 12-31 15 37 12-26 10 12h101" />
              <path d="M0 29h210" />
            </svg>
          </div>
          <nav className={styles.navigation} aria-label="Navegación principal móvil">
            {Object.entries(routes).map(([key, item]) => (
              <NavLink
                key={key}
                to={item.path}
                end
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                aria-label={item.label}
                onClick={() => requestClose(true)}
              >
                <span className={styles.navIcon}>
                  <Icon name={item.icon} size={23} />
                </span>
                <span className={styles.navCopy}>
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </span>
                <span className={styles.navArrow}>
                  <Icon name="chevron" size={18} />
                </span>
              </NavLink>
            ))}
          </nav>
          <div className={styles.bottom}>
            <div className={styles.device}>
              <span className={styles.deviceIcon}>
                <Icon name="chip" size={28} />
              </span>
              <div>
                <span className={styles.deviceEyebrow}>TU DISPOSITIVO</span>
                <strong>ESP32</strong>
                <span className={styles.deviceStatus}>
                  <DeviceStateLabel />
                </span>
              </div>
              <Icon name="wifi" size={21} />
            </div>
            <div className={styles.footer}>
              <span>
                3 variables <i /> °C · V · A
              </span>
              <span>
                voltio
                <Icon name="pulse" size={17} />
              </span>
            </div>
          </div>
        </dialog>,
        document.body,
      )}
    </>
  )
}
