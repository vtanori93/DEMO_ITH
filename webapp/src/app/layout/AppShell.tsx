import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigationType } from 'react-router'
import { routes, useRoute } from '../routes'
import { APP_PATHS } from '../../shared/contracts/navigation'
import { Icon } from '../../shared/ui/Icon'
import { DeviceStateLabel } from '../../features/gateway/ui/GatewayPresence'
import { MobileNavigation } from './MobileNavigation'
import { useSidebar } from './useSidebar'
import { CHANNELS } from '../../shared/contracts/measurements'
import styles from './AppShell.module.css'

export function AppShell() {
  const route = useRoute()
  const { collapsed, toggle } = useSidebar()
  const header = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const previousPath = useRef(pathname)
  useEffect(() => {
    const element = header.current
    if (!element) return
    const root = document.documentElement
    const previous = root.style.getPropertyValue('--app-header-height')
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--app-header-height', `${Math.ceil(element.getBoundingClientRect().height)}px`)
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      if (previous) root.style.setProperty('--app-header-height', previous)
      else root.style.removeProperty('--app-header-height')
    }
  }, [])
  useEffect(() => {
    if (previousPath.current !== pathname && previousPath.current !== '/') {
      document.getElementById('main-content')?.focus({ preventScroll: true })
      if (navigationType !== 'POP') window.scrollTo(0, 0)
    }
    previousPath.current = pathname
  }, [pathname, navigationType])
  const navigation = () =>
    Object.entries(routes).map(([id, item]) => (
      <NavLink
        key={id}
        to={item.path}
        end
        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
        aria-label={item.label}
        title={collapsed ? item.label : undefined}
      >
        <Icon name={item.icon} size={20} />
        <span className={styles.navText}>{item.label}</span>
        {id === 'monitor' && (
          <span className={styles.navCount} aria-hidden="true">
            {CHANNELS.length}
          </span>
        )}
      </NavLink>
    ))
  return (
    <div className={styles.shell} data-sidebar-collapsed={collapsed}>
      <a
        className={styles.skipLink}
        href="#main-content"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main-content')?.focus()
        }}
      >
        Saltar al contenido
      </a>
      <aside
        id="desktop-sidebar"
        aria-label="Barra lateral"
        className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}
      >
        <Link className={styles.brand} to={APP_PATHS.monitor} aria-label="Voltio, ir al monitor">
          <span className={styles.brandMark}>
            <Icon name="pulse" size={26} />
          </span>
          <span className={styles.brandWordmark}>
            voltio<span className={styles.brandDot}>.</span>
          </span>
        </Link>
        <div className={styles.workspace}>
          <span className={styles.workspaceLabel}>LABORATORIO DE SEÑALES</span>
          <span className={styles.versionBadge}>v1.0</span>
        </div>
        <p className={styles.navLabel}>ESPACIO DE TRABAJO</p>
        <nav className={styles.desktopNav} aria-label="Navegación principal">
          {navigation()}
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.device} title={collapsed ? 'Estado del ESP32' : undefined}>
            <Icon name="chip" size={28} />
            <div className={styles.deviceText}>
              <strong>ESP32</strong>
              <span>
                <DeviceStateLabel />
              </span>
            </div>
            <Icon name="wifi" size={18} />
          </div>
          <div className={styles.signature}>
            HECHO PARA TUS SEÑALES
            <Icon name="bolt" size={15} />
          </div>
        </div>
      </aside>
      <div className={styles.mainShell}>
        <header ref={header} className={styles.topbar}>
          <div className={styles.topbarStart}>
            <button
              type="button"
              className={styles.sidebarToggle}
              onClick={toggle}
              aria-controls="desktop-sidebar"
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
              title={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            >
              <Icon name={collapsed ? 'sidebarExpand' : 'sidebarCollapse'} size={21} />
            </button>
            <Link
              className={`${styles.brand} ${styles.mobileBrand}`}
              to={APP_PATHS.monitor}
              aria-label="Voltio, ir al monitor"
            >
              <span className={styles.brandMark}>
                <Icon name="pulse" size={23} />
              </span>
              voltio<span className={styles.brandDot}>.</span>
            </Link>
            <div className={styles.breadcrumb}>
              <span>Espacio de trabajo</span>
              <Icon name="chevron" size={14} />
              <strong>{route?.label ?? routes.monitor.label}</strong>
            </div>
          </div>
          <span className={styles.localTag}>
            <span />
            {window.location.protocol === 'https:' ? 'CONEXIÓN SEGURA' : 'ENTORNO LOCAL'}
          </span>
          <MobileNavigation route={route?.path ?? null} />
        </header>
        <main id="main-content" tabIndex={-1} className={styles.main}>
          <div className={styles.pageContent}>
            <Outlet />
          </div>
          <footer className={styles.footer}>
            <span>
              <strong>
                voltio<span>.</span>
              </strong>{' '}
              Una ventana a tus señales.
            </span>
            <span>
              Diseñado para tu ESP32 <Icon name="pulse" size={17} />
            </span>
          </footer>
        </main>
      </div>
      <ScrollRestoration />
    </div>
  )
}
