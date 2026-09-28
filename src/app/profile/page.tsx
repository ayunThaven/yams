import UserProfile from '@/components/UserProfile'
import RecentAchievements from '@/components/RecentAchievements'
import GameHistory from '@/components/GameHistory'

export default function ProfilePage() {
  return <div className="club-page">
    <header className="club-page-header"><p className="club-eyebrow">Profil</p><h1 className="club-page-title">Vos statistiques.</h1><p className="club-page-subtitle">Retrouvez vos parties, vos records et vos succès.</p></header>
    <div className="club-profile-stack"><UserProfile detailed/><RecentAchievements/><GameHistory/></div>
  </div>
}
