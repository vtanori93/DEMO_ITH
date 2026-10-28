import { useEffect, useState } from 'react'

const STORAGE_KEY = 'voltio.layout.sidebar-collapsed.v1'

function readCollapsed(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'true' }
  catch { return false }
}

export function useSidebar() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)) }
    catch { /* La navegación sigue funcionando sin almacenamiento local. */ }
  }, [collapsed])
  return { collapsed, toggle: () => setCollapsed((current) => !current) }
}
