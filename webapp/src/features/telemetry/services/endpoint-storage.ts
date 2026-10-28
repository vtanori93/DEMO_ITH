export function readSavedEndpoint(): string {
  const fallback = '/ws/monitor'
  try {
    return localStorage.getItem('voltio.monitor.endpoint.v2') || fallback
  } catch {
    return fallback
  }
}

export function saveEndpoint(endpoint: string): void {
  try {
    localStorage.setItem('voltio.monitor.endpoint.v2', endpoint)
  } catch {
    /* La conexión no depende del almacenamiento local. */
  }
}
