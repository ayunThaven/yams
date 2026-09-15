import UserProfile from '@/components/UserProfile'
import RecentAchievements from '@/components/RecentAchievements'
import GameHistory from '@/components/GameHistory'

export default function ProfilePage() {
  return <div className="club-page">
    <header className="club-page-header"><p className="club-eyebrow">Carnet de joueur</p><h1 className="club-page-title">Votre histoire autour de la table.</h1><p className="club-page-subtitle">Parcours, records et médailles : tout ce que vos lancers ont laissé derrière eux.</p></header>
    <div className="club-profile-stack"><UserProfile detailed/><RecentAchievements/><GameHistory/></div>
  </div>
}
