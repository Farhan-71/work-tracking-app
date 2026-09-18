import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Award, Flame, Target, Zap, CheckCircle, BookOpen, Bell, Moon } from 'lucide-react'
import { userStorage, achievementsStorage } from '../services/storage'

export default function Profile() {
  const navigate = useNavigate()
  const [darkMode, setDarkMode] = useState(true)
  const [notifications, setNotifications] = useState(true)
  const [user, setUser] = useState(null)
  const [achievements, setAchievements] = useState([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [userResponse, achievementsResponse] = await Promise.all([
        userStorage.get(),
        achievementsStorage.getAll()
      ])
      setUser(userResponse.data)
      setAchievements(achievementsResponse.data)
      setDarkMode(userResponse.data.darkMode)
      setNotifications(userResponse.data.notifications)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const handleToggleDarkMode = async () => {
    try {
      const newValue = !darkMode
      setDarkMode(newValue)
      await userStorage.update({ darkMode: newValue })
    } catch (error) {
      console.error('Error updating dark mode:', error)
    }
  }

  const handleToggleNotifications = async () => {
    try {
      const newValue = !notifications
      setNotifications(newValue)
      await userStorage.update({ notifications: newValue })
    } catch (error) {
      console.error('Error updating notifications:', error)
    }
  }

  const achievementIcons = {
    'CHAMP': <Award className="w-6 h-6" />,
    'SPEEDRUN': <Zap className="w-6 h-6" />,
    'FOCUSED': <Target className="w-6 h-6" />,
    'PERFECT': <CheckCircle className="w-6 h-6" />,
    'ON FIRE': <Flame className="w-6 h-6" />,
    'SCHOLAR': <BookOpen className="w-6 h-6" />,
  }

  return (
    <div className="min-h-screen bg-dayflow-dark pb-24">
      {/* Header */}
      <div className="p-4">
        <h1 className="text-xl font-bold">Profile</h1>
      </div>

      {/* Profile Card */}
      <div className="px-4 mb-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center text-3xl">
              🐱
            </div>
            <div>
              <h2 className="text-xl font-bold">{user?.name || 'ALEX JOHNSON'}</h2>
              <p className="text-gray-400 text-sm">{user?.email || 'alex.johnson@email.com'}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-700">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-400">{user?.streak || 12}</p>
              <p className="text-gray-400 text-xs">STREAK</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{user?.bestStreak || 24}</p>
              <p className="text-gray-400 text-xs">BEST</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-400">{user?.tasksDone || 87}</p>
              <p className="text-gray-400 text-xs">DONE</p>
            </div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="px-4 mb-6">
        <h2 className="text-lg font-bold mb-3">ACHIEVEMENTS</h2>
        <div className="grid grid-cols-2 gap-3">
          {achievements.map(achievement => (
            <div
              key={achievement.id}
              className={`rounded-xl p-4 border ${
                achievement.unlocked
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-gray-900 border-gray-800 opacity-50'
              }`}
            >
              <div className={`mb-2 ${achievement.unlocked ? 'text-green-400' : 'text-gray-600'}`}>
                {achievementIcons[achievement.name] || <Award className="w-6 h-6" />}
              </div>
              <p className="font-bold text-sm">{achievement.name}</p>
              <p className="text-gray-400 text-xs">{achievement.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="px-4 mb-6">
        <h2 className="text-lg font-bold mb-3">Settings</h2>
        <div className="bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 text-gray-400" />
              <span>Dark Mode</span>
            </div>
            <button
              onClick={handleToggleDarkMode}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                darkMode ? 'bg-green-500' : 'bg-gray-600'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full transition-transform ${
                  darkMode ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-gray-400" />
              <span>Notifications</span>
            </div>
            <button
              onClick={handleToggleNotifications}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                notifications ? 'bg-green-500' : 'bg-gray-600'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full transition-transform ${
                  notifications ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-6 py-4">
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate('/home')}
            className="flex flex-col items-center gap-1 text-gray-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs">HOME</span>
          </button>
          <button
            onClick={() => navigate('/tasks')}
            className="flex flex-col items-center gap-1 text-gray-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs">TASKS</span>
          </button>
          <button 
            onClick={() => navigate('/tasks')}
            className="bg-dayflow-red p-4 rounded-full -mt-8"
          >
            <Plus className="w-8 h-8 text-white" />
          </button>
          <button
            onClick={() => navigate('/stats')}
            className="flex flex-col items-center gap-1 text-gray-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-xs">STATS</span>
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="flex flex-col items-center gap-1 text-green-400"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">ME</span>
          </button>
        </div>
      </div>
    </div>
  )
}
