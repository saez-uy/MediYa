import { useInactivityLogout } from '../hooks/useInactivityLogout'

export default function InactivityGuard({ children }: { children: React.ReactNode }) {
  useInactivityLogout()
  return <>{children}</>
}
