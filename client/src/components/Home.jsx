import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Clock, Target, Zap, Flame, Play, Plus } from 'lucide-react'
import { tasksStorage } from '../services/storage'

export default function Home() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      const response = await tasksStorage.getAll()
      setTasks(response.data)
    } catch (error) {
      console.error('Error loading tasks:', error)
    }
  }

  const toggleTask = async (id) => {
    try {
      const task = tasks.find(t => t.id === id)
      const updatedTask = { ...task, completed: !task.completed }
      await tasksStorage.update(id, updatedTask)
      setTasks(tasks.map(t => 
        t.id === id ? updatedTask : t
      ))
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  const remainingTasks = tasks.filter(t => !t.completed).length

  return (
    <div className="min-h-screen bg-dayflow-dark pb-24">
      {/* Header */}
      <div className="p-4 flex justify-between items-center">
        <div>
          <p className="text-gray-400 text-sm">GOOD EVENING</p>
          <h1 className="text-xl font-bold">ALEX JOHNSON</h1>
        </div>
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6" />
          <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
            🐱
          </div>
        </div>
      </div>

      {/* Today's Quest */}
      <div className="px-4 mb-6">
        <h2 className="text-lg font-bold mb-3">TODAY'S QUEST</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="text-gray-400 text-sm">HOURS</span>
            </div>
            <p className="text-2xl font-bold">5.2h</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-green-400" />
              <span className="text-gray-400 text-sm">FOCUS</span>
            </div>
            <p className="text-2xl font-bold">3.5h</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-gray-400 text-sm">SCORE</span>
            </div>
            <p className="text-2xl font-bold">87%</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-5 h-5 text-orange-400" />
              <span className="text-gray-400 text-sm">STREAK</span>
            </div>
            <p className="text-2xl font-bold">x12</p>
          </div>
        </div>
      </div>

      {/* Focus Mode */}
      <div className="px-4 mb-6">
        <div className="bg-dayflow-red rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="font-bold">Start a pomodoro session</p>
          </div>
          <button className="bg-white text-dayflow-red p-3 rounded-full">
            <Play className="w-6 h-6" fill="currentColor" />
          </button>
        </div>
      </div>

      {/* Today's Tasks */}
      <div className="px-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold">TODAY'S TASKS</h2>
          <span className="text-gray-400">{remainingTasks} LEFT</span>
        </div>
        
        <div className="space-y-3">
          {tasks.map(task => (
            <div
              key={task.id}
              className={`bg-gray-800 rounded-lg p-4 border ${
                task.completed ? 'border-gray-700 opacity-60' : 'border-gray-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                    task.completed ? 'bg-green-500 border-green-500' : 'border-gray-500'
                  }`}
                >
                  {task.completed && (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1">
                  <p className={`font-medium ${task.completed ? 'line-through text-gray-500' : ''}`}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="bg-amber-900 text-amber-200 text-xs px-2 py-1 rounded">
                      {task.category}
                    </span>
                    <span className="text-gray-400 text-sm">{task.time}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-6 py-4">
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate('/home')}
            className="flex flex-col items-center gap-1 text-green-400"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
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
