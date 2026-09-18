import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Check, Trash2 } from 'lucide-react'
import { tasksStorage } from '../services/storage'

export default function Tasks() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [showAddModal, setShowAddModal] = useState(false)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTask, setNewTask] = useState({
    title: '',
    category: 'Work',
    priority: 'MED',
    due: 'Today',
    time: '30m'
  })

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      const response = await tasksStorage.getAll()
      setTasks(response.data)
    } catch (error) {
      console.error('Error loading tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const filters = ['ALL', 'TODAY', 'TMR', 'DONE', 'LATE!']

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

  const handleSaveTask = async () => {
    try {
      const response = await tasksStorage.create(newTask)
      setTasks([...tasks, response.data])
      setShowAddModal(false)
      setNewTask({
        title: '',
        category: 'Work',
        priority: 'MED',
        due: 'Today',
        time: '30m'
      })
    } catch (error) {
      console.error('Error creating task:', error)
    }
  }

  const handleDeleteTask = async (id) => {
    try {
      await tasksStorage.delete(id)
      setTasks(tasks.filter(t => t.id !== id))
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = 
      activeFilter === 'ALL' ? true :
      activeFilter === 'TODAY' ? task.due === 'Today' :
      activeFilter === 'TMR' ? task.due === 'Tomorrow' :
      activeFilter === 'DONE' ? task.completed :
      activeFilter === 'LATE!' ? task.late : true
    return matchesSearch && matchesFilter
  })

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'HIGH': return 'bg-red-500'
      case 'MED': return 'bg-orange-500'
      case 'LOW': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const getCategoryColor = (category) => {
    switch(category) {
      case 'Work': return 'bg-amber-900 text-amber-200'
      case 'Health': return 'bg-green-900 text-green-200'
      case 'Study': return 'bg-blue-900 text-blue-200'
      case 'Personal': return 'bg-purple-900 text-purple-200'
      default: return 'bg-gray-700 text-gray-300'
    }
  }

  return (
    <div className="min-h-screen bg-dayflow-dark pb-24">
      {/* Header */}
      <div className="p-4">
        <h1 className="text-xl font-bold mb-1">YOUR QUESTS</h1>
        <p className="text-gray-400 text-sm">MY TASKS</p>
      </div>

      {/* Search Bar */}
      <div className="px-4 mb-4">
        <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="SEARCH TASKS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent flex-1 outline-none text-white placeholder-gray-500"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 mb-4 flex gap-2 flex-wrap">
        {filters.map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              activeFilter === filter
                ? 'bg-gray-700 text-white'
                : filter === 'LATE!'
                ? 'border-2 border-dayflow-red text-dayflow-red'
                : filter === 'DONE'
                ? 'border-2 border-dayflow-green text-dayflow-green'
                : 'border-2 border-gray-600 text-gray-400'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="px-4 space-y-3">
        {filteredTasks.map(task => (
          <div
            key={task.id}
            className={`bg-gray-800 rounded-lg p-4 border ${
              task.late ? 'border-dayflow-red' : 'border-gray-700'
            } ${task.completed ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={() => toggleTask(task.id)}
                className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  task.completed ? 'bg-green-500 border-green-500' : 'border-gray-500'
                }`}
              >
                {task.completed && <Check className="w-4 h-4 text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${task.completed ? 'line-through text-gray-500' : ''}`}>
                  {task.title}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-xs px-2 py-1 rounded ${getCategoryColor(task.category)}`}>
                    {task.category}
                  </span>
                  <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                  <span className="text-gray-400 text-xs">{task.priority}</span>
                  <span className="text-gray-400 text-xs">{task.time}</span>
                  <span className="text-gray-400 text-xs">{task.due}</span>
                </div>
              </div>
              <button
                onClick={() => handleDeleteTask(task.id)}
                className="text-gray-500 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-1">NEW QUEST</h2>
            <p className="text-gray-400 text-sm mb-4">ADD TASK</p>
            
            <input
              type="text"
              placeholder="Task name..."
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="w-full bg-gray-700 rounded-lg p-3 mb-4 outline-none text-white placeholder-gray-500"
            />
            
            <p className="text-sm text-gray-400 mb-2">Category</p>
            <div className="flex gap-2 mb-4">
              {['Work', 'Personal', 'Health', 'Study'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setNewTask({ ...newTask, category: cat })}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    newTask.category === cat ? 'bg-dayflow-red' : 'bg-gray-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            
            <p className="text-sm text-gray-400 mb-2">Priority</p>
            <div className="flex gap-2 mb-4">
              {['HIGH', 'MED', 'LOW'].map(pri => (
                <button
                  key={pri}
                  onClick={() => setNewTask({ ...newTask, priority: pri })}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    newTask.priority === pri ? 'bg-dayflow-red' : 'bg-gray-700'
                  }`}
                >
                  {pri}
                </button>
              ))}
            </div>
            
            <p className="text-sm text-gray-400 mb-2">Due Date</p>
            <div className="flex gap-2 mb-6">
              {['Today', 'Tomorrow', 'This Week'].map(date => (
                <button
                  key={date}
                  onClick={() => setNewTask({ ...newTask, due: date })}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    newTask.due === date ? 'bg-dayflow-red' : 'bg-gray-700'
                  }`}
                >
                  {date}
                </button>
              ))}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-lg bg-gray-700 font-medium"
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveTask}
                disabled={!newTask.title}
                className="flex-1 py-3 rounded-lg bg-dayflow-red font-medium disabled:opacity-50"
              >
                SAVE
              </button>
            </div>
          </div>
        </div>
      )}

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
            className="flex flex-col items-center gap-1 text-green-400"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">TASKS</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
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
