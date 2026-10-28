import type { ReactNode } from 'react'
import { Icon } from './Icon'
import styles from './ui.module.css'

export function Notice({
  children,
  tone = 'warning',
  action,
  alert = false,
}: {
  children: ReactNode
  tone?: 'warning' | 'danger'
  action?: ReactNode
  alert?: boolean
}) {
  return (
    <div className={`${styles.notice} ${styles[tone]}`} role={alert ? 'alert' : undefined}>
      <Icon name="info" size={20} />
      <div className={styles.noticeContent}>{children}</div>
      {action && <div className={styles.noticeAction}>{action}</div>}
    </div>
  )
}
