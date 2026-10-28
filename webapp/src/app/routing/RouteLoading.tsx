import styles from '../../shared/ui/ui.module.css'

export function RouteLoading() {
  return (
    <div className={`${styles.panel} ${styles.skeleton}`} role="status" aria-label="Cargando vista">
      <span className={styles.skeletonLine} />
      <span className={styles.skeletonLine} />
      Preparando tus señales…
    </div>
  )
}
