import { Preferences } from '@capacitor/preferences';

const DEBUG = true; // Enable for debugging storage issues

const STORAGE_KEYS = {
  tasks: 'dayflow_tasks',
  dark: 'dayflow_dark',
  username: 'dayflow_username',
  appSettings: 'dayflow_app_settings',
  completionHistory: 'dayflow_completion_history',
  onboarded: 'dayflow_onboarded',
};

// Browser storage fallback
const readBrowserStorage = (key) => {
  try {
    if (typeof window !== 'undefined') {
      const value = window.localStorage.getItem(key);
      if (DEBUG) console.log(`Storage: Browser storage read ${key}:`, value ? 'found' : 'not found');
      return value;
    }
  } catch (error) {
    if (DEBUG) console.error(`Storage: Browser storage read error for ${key}:`, error);
  }
  return null;
};

const writeBrowserStorage = (key, value) => {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
      if (DEBUG) console.log(`Storage: Saved ${key} to browser storage`);
    }
  } catch (error) {
    if (DEBUG) console.error(`Storage: Browser storage write error for ${key}:`, error);
    // Ignore browser storage errors when native storage is available.
  }
};

// Read from native storage with browser fallback
const readStoredValue = async (key) => {
  try {
    const { value } = await Preferences.get({ key });
    if (value !== null) {
      if (DEBUG) console.log(`Storage: Read ${key} from native storage (${value.length} chars)`);
      return value;
    } else {
      if (DEBUG) console.log(`Storage: ${key} not found in native storage`);
    }
  } catch (error) {
    if (DEBUG) console.log(`Storage: Native storage failed for ${key}, using browser fallback:`, error);
    // Fallback to browser storage below.
  }
  const browserValue = readBrowserStorage(key);
  if (browserValue !== null) {
    if (DEBUG) console.log(`Storage: Read ${key} from browser storage (${browserValue.length} chars)`);
  } else {
    if (DEBUG) console.log(`Storage: ${key} not found in browser storage`);
  }
  return browserValue;
};

// Write to native storage with browser fallback
const writeStoredValue = async (key, value) => {
  try {
    await Preferences.set({ key, value });
    if (DEBUG) console.log(`Storage: Saved ${key} to native storage`);
  } catch (error) {
    if (DEBUG) console.log(`Storage: Native storage failed, using browser fallback for ${key}:`, error);
    // Keep browser fallback for web/dev environments.
  }
  writeBrowserStorage(key, value);
};

// JSON helpers
const readStoredJson = async (key, fallback) => {
  try {
    const raw = await readStoredValue(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (DEBUG) console.log(`Storage: Parsed JSON for ${key}:`, Array.isArray(parsed) ? `${parsed.length} items` : typeof parsed);
      return parsed;
    }
    if (DEBUG) console.log(`Storage: No data found for ${key}, using fallback`);
    return fallback;
  } catch (error) {
    console.error(`Storage: JSON parse error for ${key}:`, error);
    return fallback;
  }
};

const writeStoredJson = async (key, value) => {
  try {
    const jsonString = JSON.stringify(value);
    if (DEBUG) console.log(`Storage: Writing JSON for ${key}:`, jsonString.length, 'chars');
    await writeStoredValue(key, jsonString);
    // Verify write was successful
    const verify = await readStoredValue(key);
    if (verify === jsonString) {
      if (DEBUG) console.log(`Storage: Verified ${key} was written successfully`);
    } else {
      console.error(`Storage: Verification failed for ${key}`);
    }
  } catch (error) {
    console.error(`Storage: JSON write error for ${key}:`, error);
  }
};

// Default tasks - only used when explicitly requested, not for fallback
const createDefaultTasks = () => [
  { id: '1', title: 'Review quarterly report', category: 'Work', priority: 'HIGH', time: '45m', due: 'Today', completed: false, late: false },
  { id: '2', title: 'Team standup meeting', category: 'Work', priority: 'MED', time: '30m', due: 'Today', completed: true, late: false },
  { id: '3', title: 'Update project docs', category: 'Work', priority: 'LOW', time: '20m', due: 'Today', completed: false, late: false },
  { id: '4', title: 'Morning yoga session', category: 'Health', priority: 'MED', time: '45m', due: 'Today', completed: true, late: false },
  { id: '5', title: 'Read Atomic Habits', category: 'Study', priority: 'LOW', time: '30m', due: 'Today', completed: false, late: false },
  { id: '6', title: 'Reply to client emails', category: 'Work', priority: 'HIGH', time: '20m', due: 'Yesterday', completed: false, late: true },
];

// Default user data
const createDefaultUser = () => ({
  id: 1,
  name: 'Alex Johnson',
  email: 'alex.johnson@email.com',
  streak: 12,
  bestStreak: 24,
  tasksDone: 87,
  darkMode: true,
  notifications: true,
});

// Default achievements
const createDefaultAchievements = () => [
  { id: 1, name: 'CHAMP', description: '10+ streak', unlocked: true },
  { id: 2, name: 'SPEEDRUN', description: '1h all', unlocked: true },
  { id: 3, name: 'FOCUSED', description: '5 sessions', unlocked: true },
  { id: 4, name: 'PERFECT', description: '100% day', unlocked: false },
  { id: 5, name: 'ON FIRE', description: '7d streak', unlocked: true },
  { id: 6, name: 'SCHOLAR', description: '10 study', unlocked: false },
];

// Tasks API using local storage
export const tasksStorage = {
  getAll: async () => {
    const tasks = await readStoredJson(STORAGE_KEYS.tasks, []);
    return { data: tasks };
  },

  getById: async (id) => {
    const tasks = await readStoredJson(STORAGE_KEYS.tasks, []);
    const task = tasks.find(t => t.id === id);
    return { data: task };
  },

  create: async (task) => {
    const tasks = await readStoredJson(STORAGE_KEYS.tasks, []);
    const newTask = {
      id: String(Date.now()),
      ...task,
      completed: false,
      late: false,
    };
    tasks.push(newTask);
    await writeStoredJson(STORAGE_KEYS.tasks, tasks);
    return { data: newTask };
  },

  update: async (id, updatedTask) => {
    const tasks = await readStoredJson(STORAGE_KEYS.tasks, []);
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      tasks[index] = { ...tasks[index], ...updatedTask };
      await writeStoredJson(STORAGE_KEYS.tasks, tasks);
      return { data: tasks[index] };
    }
    throw new Error('Task not found');
  },

  delete: async (id) => {
    const tasks = await readStoredJson(STORAGE_KEYS.tasks, []);
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      tasks.splice(index, 1);
      await writeStoredJson(STORAGE_KEYS.tasks, tasks);
      return { data: { message: 'Task deleted' } };
    }
    throw new Error('Task not found');
  },
};

// User API using local storage
export const userStorage = {
  get: async () => {
    const user = await readStoredJson(STORAGE_KEYS.username, null);
    return { data: user || createDefaultUser() };
  },

  update: async (userData) => {
    const user = await readStoredJson(STORAGE_KEYS.username, null);
    const updatedUser = { ...(user || createDefaultUser()), ...userData };
    await writeStoredJson(STORAGE_KEYS.username, updatedUser);
    return { data: updatedUser };
  },
};

// Achievements API using local storage
export const achievementsStorage = {
  getAll: async () => {
    const achievements = await readStoredJson('dayflow_achievements', null);
    return { data: achievements || createDefaultAchievements() };
  },

  update: async (id, achievementData) => {
    const achievements = await readStoredJson('dayflow_achievements', null);
    const achievementsList = achievements || createDefaultAchievements();
    const index = achievementsList.findIndex(a => a.id === parseInt(id));
    if (index !== -1) {
      achievementsList[index] = { ...achievementsList[index], ...achievementData };
      await writeStoredJson('dayflow_achievements', achievementsList);
      return { data: achievementsList[index] };
    }
    throw new Error('Achievement not found');
  },
};

// Stats API using local storage
export const statsStorage = {
  get: async () => {
    const tasks = await readStoredJson(STORAGE_KEYS.tasks, []);
    const user = await readStoredJson(STORAGE_KEYS.username, null);
    const defaultUser = createDefaultUser();
    const userData = user || defaultUser;

    const doneCount = tasks.filter(t => t.completed).length;
    const pendingCount = tasks.filter(t => !t.completed).length;
    const overdueCount = tasks.filter(t => t.late).length;
    const total = doneCount + pendingCount;

    // Calculate breakdown percentages
    const donePercent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    const pendingPercent = total > 0 ? Math.round((pendingCount / total) * 100) : 0;
    const overduePercent = total > 0 ? Math.round((overdueCount / total) * 100) : 0;

    const stats = {
      currentStreak: userData.streak,
      bestStreak: userData.bestStreak,
      done: doneCount,
      pending: pendingCount,
      overdue: overdueCount,
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
        { name: 'Done', value: donePercent, color: '#4CAF50' },
        { name: 'Pending', value: pendingPercent, color: '#282828' },
        { name: 'Overdue', value: overduePercent, color: '#E53935' },
      ],
    };

    return { data: stats };
  },
};

// General storage helpers
export const storage = {
  get: async (key, fallback = null) => {
    return await readStoredValue(key) || fallback;
  },

  set: async (key, value) => {
    await writeStoredValue(key, value);
  },

  getJson: async (key, fallback) => {
    return await readStoredJson(key, fallback);
  },

  setJson: async (key, value) => {
    await writeStoredJson(key, value);
  },

  remove: async (key) => {
    try {
      await Preferences.remove({ key });
      if (DEBUG) console.log(`Storage: Removed ${key} from native storage`);
    } catch (error) {
      if (DEBUG) console.log(`Storage: Native remove failed for ${key}, using browser fallback:`, error);
      // Fallback to browser storage
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(key);
          if (DEBUG) console.log(`Storage: Removed ${key} from browser storage`);
        }
      } catch {
        // Ignore errors
      }
    }
  },

  // Debug function to list all stored keys
  debugListAll: async () => {
    if (!DEBUG) return;
    console.log("=== Storage Debug Info ===");
    const keys = Object.values(STORAGE_KEYS);
    for (const key of keys) {
      try {
        const value = await readStoredValue(key);
        console.log(`${key}:`, value ? `${value.length} chars` : 'null/empty');
      } catch (error) {
        console.log(`${key}: Error reading`);
      }
    }
    console.log("========================");
  },

  // Initialize storage with defaults if empty
  initializeDefaults: async () => {
    if (DEBUG) console.log("Storage: Initializing defaults if needed");
    const tasks = await readStoredJson(STORAGE_KEYS.tasks, null);
    if (!tasks) {
      if (DEBUG) console.log("Storage: No tasks found, initializing with empty array");
      await writeStoredJson(STORAGE_KEYS.tasks, []);
    }

    const user = await readStoredJson(STORAGE_KEYS.username, null);
    if (!user) {
      if (DEBUG) console.log("Storage: No user found, initializing with defaults");
      await writeStoredJson(STORAGE_KEYS.username, createDefaultUser());
    }

    const onboarding = await readStoredJson(STORAGE_KEYS.onboarded, null);
    if (onboarding === null) {
      if (DEBUG) console.log("Storage: No onboarding state found, initializing as false");
      await writeStoredJson(STORAGE_KEYS.onboarded, false);
    }
  },
};

export default { tasksStorage, userStorage, achievementsStorage, statsStorage, storage, STORAGE_KEYS };