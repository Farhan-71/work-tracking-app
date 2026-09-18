import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 5000

// Middleware
app.use(cors())
app.use(bodyParser.json())

// Data file paths
const dataDir = path.join(__dirname, 'data')
const tasksFile = path.join(dataDir, 'tasks.json')
const usersFile = path.join(dataDir, 'users.json')
const achievementsFile = path.join(dataDir, 'achievements.json')

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir)
}

// Initialize data files if they don't exist
const initializeDataFile = (filePath, defaultData) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2))
  }
}

initializeDataFile(tasksFile, [
  { id: 1, title: 'Review quarterly report', category: 'Work', priority: 'HIGH', time: '45m', due: 'Today', completed: false, late: false },
  { id: 2, title: 'Team standup meeting', category: 'Work', priority: 'MED', time: '30m', due: 'Today', completed: true, late: false },
  { id: 3, title: 'Update project docs', category: 'Work', priority: 'LOW', time: '20m', due: 'Today', completed: false, late: false },
  { id: 4, title: 'Morning yoga session', category: 'Health', priority: 'MED', time: '45m', due: 'Today', completed: true, late: false },
  { id: 5, title: 'Read Atomic Habits', category: 'Study', priority: 'LOW', time: '30m', due: 'Today', completed: false, late: false },
  { id: 6, title: 'Reply to client emails', category: 'Work', priority: 'HIGH', time: '20m', due: 'Yesterday', completed: false, late: true },
])

initializeDataFile(usersFile, {
  id: 1,
  name: 'Alex Johnson',
  email: 'alex.johnson@email.com',
  streak: 12,
  bestStreak: 24,
  tasksDone: 87,
  darkMode: true,
  notifications: true,
})

initializeDataFile(achievementsFile, [
  { id: 1, name: 'CHAMP', description: '10+ streak', unlocked: true },
  { id: 2, name: 'SPEEDRUN', description: '1h all', unlocked: true },
  { id: 3, name: 'FOCUSED', description: '5 sessions', unlocked: true },
  { id: 4, name: 'PERFECT', description: '100% day', unlocked: false },
  { id: 5, name: 'ON FIRE', description: '7d streak', unlocked: true },
  { id: 6, name: 'SCHOLAR', description: '10 study', unlocked: false },
])

// Helper functions
const readData = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error)
    return null
  }
}

const writeData = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
    return true
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error)
    return false
  }
}

// Routes

// Get all tasks
app.get('/api/tasks', (req, res) => {
  const tasks = readData(tasksFile)
  res.json(tasks)
})

// Get task by id
app.get('/api/tasks/:id', (req, res) => {
  const tasks = readData(tasksFile)
  const task = tasks.find(t => t.id === parseInt(req.params.id))
  if (task) {
    res.json(task)
  } else {
    res.status(404).json({ error: 'Task not found' })
  }
})

// Create new task
app.post('/api/tasks', (req, res) => {
  const tasks = readData(tasksFile)
  const newTask = {
    id: tasks.length + 1,
    ...req.body,
    completed: false,
    late: false,
  }
  tasks.push(newTask)
  writeData(tasksFile, tasks)
  res.status(201).json(newTask)
})

// Update task
app.put('/api/tasks/:id', (req, res) => {
  const tasks = readData(tasksFile)
  const index = tasks.findIndex(t => t.id === parseInt(req.params.id))
  if (index !== -1) {
    tasks[index] = { ...tasks[index], ...req.body }
    writeData(tasksFile, tasks)
    res.json(tasks[index])
  } else {
    res.status(404).json({ error: 'Task not found' })
  }
})

// Delete task
app.delete('/api/tasks/:id', (req, res) => {
  const tasks = readData(tasksFile)
  const index = tasks.findIndex(t => t.id === parseInt(req.params.id))
  if (index !== -1) {
    tasks.splice(index, 1)
    writeData(tasksFile, tasks)
    res.json({ message: 'Task deleted' })
  } else {
    res.status(404).json({ error: 'Task not found' })
  }
})

// Get user data
app.get('/api/user', (req, res) => {
  const user = readData(usersFile)
  res.json(user)
})

// Update user data
app.put('/api/user', (req, res) => {
  const user = readData(usersFile)
  const updatedUser = { ...user, ...req.body }
  writeData(usersFile, updatedUser)
  res.json(updatedUser)
})

// Get achievements
app.get('/api/achievements', (req, res) => {
  const achievements = readData(achievementsFile)
  res.json(achievements)
})

// Update achievement
app.put('/api/achievements/:id', (req, res) => {
  const achievements = readData(achievementsFile)
  const index = achievements.findIndex(a => a.id === parseInt(req.params.id))
  if (index !== -1) {
    achievements[index] = { ...achievements[index], ...req.body }
    writeData(achievementsFile, achievements)
    res.json(achievements[index])
  } else {
    res.status(404).json({ error: 'Achievement not found' })
  }
})

// Get stats
app.get('/api/stats', (req, res) => {
  const tasks = readData(tasksFile)
  const user = readData(usersFile)
  
  const stats = {
    currentStreak: user.streak,
    bestStreak: user.bestStreak,
    done: tasks.filter(t => t.completed).length,
    pending: tasks.filter(t => !t.completed).length,
    overdue: tasks.filter(t => t.late).length,
    weekData: [
      { day: 'Mon', tasks: 8 },
      { day: 'Tue', tasks: 12 },
      { day: 'Wed', tasks: 6 },
      { day: 'Thu', tasks: 10 },
      { day: 'Fri', tasks: 14 },
      { day: 'Sat', tasks: 4 },
      { day: 'Sun', tasks: 7 },
    ],
    breakdown: [
      { name: 'Done', value: 65, color: '#4CAF50' },
      { name: 'Pending', value: 25, color: '#282828' },
      { name: 'Overdue', value: 10, color: '#E53935' },
    ],
  }
  
  res.json(stats)
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
