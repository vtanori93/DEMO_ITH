import { RouterProvider } from 'react-router/dom'
import { router } from './router'
import { TelemetryProvider } from './providers/TelemetryProvider'
import { ErrorBoundary } from '../shared/ui/ErrorBoundary'
import { GatewayProvider } from './providers/GatewayProvider'
import { IndicatorProvider } from './providers/IndicatorProvider'

export default function App() {
  return (
    <ErrorBoundary>
      <GatewayProvider>
        <TelemetryProvider>
          <IndicatorProvider>
            <RouterProvider router={router} />
          </IndicatorProvider>
        </TelemetryProvider>
      </GatewayProvider>
    </ErrorBoundary>
  )
}
