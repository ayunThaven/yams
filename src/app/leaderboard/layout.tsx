import ProtectedRouteLayout from '@/components/ProtectedRouteLayout'

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRouteLayout>{children}</ProtectedRouteLayout>
}
