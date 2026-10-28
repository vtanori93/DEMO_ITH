import type { HTMLAttributes, ReactNode } from 'react'
import styles from './ui.module.css'

export function Panel({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`${styles.panel} ${className}`} {...props} />
}
export function PanelHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className={styles.panelHeader}>
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions}
    </div>
  )
}
