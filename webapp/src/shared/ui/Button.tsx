import type { ComponentPropsWithRef } from 'react'
import styles from './ui.module.css'

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...props
}: ComponentPropsWithRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'icon'
}) {
  return (
    <button type={type} className={`${styles.button} ${styles[variant]} ${className}`} {...props} />
  )
}
