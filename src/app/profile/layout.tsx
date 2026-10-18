import ProtectedRouteLayout from '@/components/ProtectedRouteLayout'

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRouteLayout>{children}</ProtectedRouteLayout>
}
