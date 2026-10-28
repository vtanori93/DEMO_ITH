import type { KeyboardEvent } from 'react'

/** Mantiene Tab y Mayús+Tab dentro del diálogo y omite los controles desactivados. */
export function trapDialogFocus(event: KeyboardEvent<HTMLDialogElement>): void {
  if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
  )].filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0)
  const index = document.activeElement instanceof HTMLElement ? controls.indexOf(document.activeElement) : -1
  if (index < 0 || (event.shiftKey ? index === 0 : index === controls.length - 1)) {
    event.preventDefault()
    controls[event.shiftKey ? controls.length - 1 : 0]?.focus()
  }
}
