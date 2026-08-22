import ProtectedRouteLayout from '@/components/ProtectedRouteLayout'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRouteLayout>{children}</ProtectedRouteLayout>
}
