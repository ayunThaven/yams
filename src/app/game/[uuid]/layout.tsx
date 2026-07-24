import ProtectedRouteLayout from '@/components/ProtectedRouteLayout'

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRouteLayout>{children}</ProtectedRouteLayout>
}
