import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Plus } from 'lucide-react'
import { statsStorage } from '../services/storage'

export default function Stats() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const response = await statsStorage.get()
      setStats(response.data)
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !stats) {
    return <div className="min-h-screen bg-dayflow-dark flex items-center justify-center">Loading...</div>
  }

  const weekData = stats.weekData || []
  const breakdownData = stats.breakdown || []

  return (
    <div className="min-h-screen bg-dayflow-dark pb-24">
      {/* Header */}
      <div className="p-4">
        <h1 className="text-xl font-bold">Analytics</h1>
      </div>

      {/* Current Streak */}
      <div className="px-4 mb-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-400 text-sm mb-1">Current Streak</p>
              <p className="text-4xl font-bold">{stats.currentStreak} DAYS</p>
              <p className="text-gray-400 text-sm mt-1">Best: {stats.bestStreak} days</p>
            </div>
            <div className="text-6xl">🔥</div>
          </div>
        </div>
      </div>

      {/* Task Summary */}
      <div className="px-4 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-900/30 rounded-xl p-4 border border-green-700">
            <p className="text-green-400 text-2xl font-bold">{stats.done}</p>
            <p className="text-green-400 text-sm">DONE</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-2xl font-bold">{stats.pending}</p>
            <p className="text-gray-400 text-sm">PENDING</p>
          </div>
          <div className="bg-red-900/30 rounded-xl p-4 border border-red-700">
            <p className="text-red-400 text-2xl font-bold">{stats.overdue}</p>
            <p className="text-red-400 text-sm">OVERDUE</p>
          </div>
        </div>
      </div>

      {/* This Week Bar Chart */}
      <div className="px-4 mb-6">
        <h2 className="text-lg font-bold mb-3">This Week</h2>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekData}>
              <XAxis dataKey="day" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#374151', border: 'none', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="tasks" fill="#4CAF50" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Breakdown Donut Chart */}
      <div className="px-4 mb-6">
        <h2 className="text-lg font-bold mb-3">Breakdown</h2>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={breakdownData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {breakdownData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#374151', border: 'none', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value, entry) => (
                  <span style={{ color: entry.color }}>{value} ({entry.payload.value}%)</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
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
            className="flex flex-col items-center gap-1 text-green-400"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
            <span className="text-xs">STATS</span>
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="flex flex-col items-center gap-1 text-gray-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs">ME</span>
          </button>
        </div>
      </div>
    </div>
  )
}
