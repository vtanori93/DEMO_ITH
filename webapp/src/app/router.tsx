import { createBrowserRouter } from 'react-router'
import { AppShell } from './layout/AppShell'
import { GatewayGuard } from './guards/GatewayGuard'
import { RouteErrorPage } from './routing/RouteErrorPage'
import { IndexRedirect } from './routing/IndexRedirect'
import { NotFoundRoute } from './routing/NotFoundRoute'
import { routes } from './routes'

export const router = createBrowserRouter([
  {
    Component: AppShell,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, Component: IndexRedirect },
      ...Object.entries(routes).map(([id, route]) => {
        const Page = route.component
        return {
          id,
          path: route.path,
          element: route.guard === 'gateway' ? <GatewayGuard><Page /></GatewayGuard> : <Page />,
          errorElement: <RouteErrorPage />,
        }
      }),
      { path: '*', element: <NotFoundRoute />, errorElement: <RouteErrorPage /> },
    ],
  },
])
