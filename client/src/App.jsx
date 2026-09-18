import { useState, useEffect, useRef } from "react";
import { Preferences } from "@capacitor/preferences";
import { LocalNotifications } from "@capacitor/local-notifications";
import { motion } from "framer-motion";
import {
  Plus, Clock, Trophy, Play, Pause, RotateCcw,
  X, Check, ChevronRight, Bell, Search, Timer,
  Moon, Sun, Settings, Volume2, Calendar, CheckCircle2,
  Home, CheckSquare, BarChart2, UserCircle,
} from "lucide-react";
import { ImageWithFallback } from "./components/ImageWithFallback";
import { NotificationBanner } from "./components/NotificationBanner";
import catPng   from "/cat.png";
import bunnyPng from "/bunny.png";

// ─── Palette ─────────────────────────────────────────────────────────────────
const LIGHT = {
  dark:  "#2B2B2B",
  mid:   "#6B6B6B",
  light: "#C8C8C8",
  cream: "#F5F4EF",
  white: "#FFFFFF",
  red:   "#E63232",
  black: "#0D1B3E",
  card:  "#FAFAF8",
};

const DARK = {
  dark:  "#E8E8E8",   // light text on dark bg
  mid:   "#A0A0A0",
  light: "#555566",
  cream: "#1A1C2A",   // dark page background
  white: "#252838",   // dark card surface
  red:   "#FF4444",
  black: "#6B7FCC",   // navy → periwinkle in dark mode
  card:  "#1E2030",
};

// Runtime palette — updated by App and read by all components via module-level ref
const P = { ...LIGHT };

const CAT_META = {
  work:     {bg:"#EAEAEA",border:"#6B6B6B",text:"#2B2B2B",label:"Work",    emoji:"💼"},
  personal: {bg:"#F5E8E8",border:"#B05050",text:"#7A1818",label:"Personal",emoji:"🌸"},
  health:   {bg:"#E8F0E8",border:"#507750",text:"#1A4A1A",label:"Health",  emoji:"💪"},
  learning: {bg:"#EEE8D8",border:"#806030",text:"#4A3010",label:"Study",   emoji:"📖"},
};
const PRIO_COLOR = {high:"#E63232",medium:"#C07020",low:"#207820"};

// ─── Local storage helpers ────────────────────────────────────────────────────
const STORAGE_KEYS = {
  tasks: "dayflow_tasks",
  dark: "dayflow_dark",
  username: "dayflow_username",
  appSettings: "dayflow_app_settings",
  completionHistory: "dayflow_completion_history",
  onboarded: "dayflow_onboarded",
};

const DEFAULT_APP_SETTINGS = {
  focusDuration: 25,
  breakDuration: 5,
  autoStartBreak: false,
  showCompletedTasks: true,
  confettiOnComplete: true,
};

const readBrowserStorage = (key) => {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

const writeBrowserStorage = (key, value) => {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Ignore browser storage errors when native storage is available.
  }
};

const readStoredValue = async (key) => {
  try {
    const { value } = await Preferences.get({ key });
    if (value !== null) return value;
  } catch {
    // Fallback to browser storage below.
  }

  return readBrowserStorage(key);
};

const writeStoredValue = async (key, value) => {
  try {
    await Preferences.set({ key, value });
  } catch {
    // Keep browser fallback for web/dev environments.
  }

  writeBrowserStorage(key, value);
};

const pad = (v) => String(v).padStart(2, "0");

const formatDateInput = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const getRelativeDate = (offset = 0) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return formatDateInput(date);
};

const normalizeCategory = (value = "work") => {
  const key = String(value).toLowerCase();
  if (key === "study") return "learning";
  return CAT_META[key] ? key : "work";
};

const normalizePriority = (value = "medium") => {
  const key = String(value).toLowerCase();
  return ["high", "medium", "low"].includes(key) ? key : "medium";
};

const normalizeDueDate = (value) => {
  if (!value) return getRelativeDate(0);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value === "Today") return getRelativeDate(0);
  if (value === "Tomorrow") return getRelativeDate(1);
  if (value === "Yesterday") return getRelativeDate(-1);

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? getRelativeDate(0) : formatDateInput(parsed);
};

const normalizeEstimatedTime = (task) => {
  const estimated = Number(task?.estimatedTime);
  if (Number.isFinite(estimated) && estimated > 0) return estimated;

  if (typeof task?.time === "string" && /^\d+\s*m$/i.test(task.time.trim())) {
    return Number.parseInt(task.time, 10);
  }

  return 30;
};

const normalizeClockTime = (value) =>
  typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : "";

const getDueDateLabel = (dueDate) => {
  const normalized = normalizeDueDate(dueDate);
  if (normalized === getRelativeDate(0)) return "Today";
  if (normalized === getRelativeDate(1)) return "Tomorrow";
  if (normalized === getRelativeDate(-1)) return "Yesterday";

  const parsed = new Date(`${normalized}T00:00:00`);
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const isTaskOverdue = (task) => {
  if (task.completed) return false;
  const today = new Date(`${getRelativeDate(0)}T00:00:00`);
  const dueDate = new Date(`${normalizeDueDate(task.dueDate)}T00:00:00`);
  return dueDate < today;
};

const normalizeTimestamp = (value, fallback = null) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
};

const normalizeTask = (task, index = 0) => {
  const normalized = {
    id: String(task?.id ?? `task-${Date.now()}-${index}`),
    title: String(task?.title ?? "").trim(),
    category: normalizeCategory(task?.category),
    priority: normalizePriority(task?.priority),
    completed: Boolean(task?.completed),
    dueDate: normalizeDueDate(task?.dueDate),
    estimatedTime: normalizeEstimatedTime(task),
    time: normalizeClockTime(task?.time),
    createdAt: normalizeTimestamp(task?.createdAt, new Date().toISOString()),
    completedAt: Boolean(task?.completed) ? normalizeTimestamp(task?.completedAt, new Date().toISOString()) : null,
  };

  return {
    ...normalized,
    overdue: isTaskOverdue(normalized),
  };
};

const createDefaultTasks = () => ([
  { id: "1", title: "Review quarterly report", category: "work", priority: "high", dueDate: getRelativeDate(0), estimatedTime: 45, completed: false, time: "09:00" },
  { id: "2", title: "Team standup meeting", category: "work", priority: "medium", dueDate: getRelativeDate(0), estimatedTime: 30, completed: true, time: "10:00" },
  { id: "3", title: "Update project docs", category: "work", priority: "low", dueDate: getRelativeDate(0), estimatedTime: 20, completed: false, time: "14:00" },
  { id: "4", title: "Morning yoga session", category: "health", priority: "medium", dueDate: getRelativeDate(0), estimatedTime: 45, completed: true, time: "07:00" },
  { id: "5", title: "Read Atomic Habits", category: "learning", priority: "low", dueDate: getRelativeDate(1), estimatedTime: 30, completed: false, time: "20:00" },
  { id: "6", title: "Reply to client emails", category: "work", priority: "high", dueDate: getRelativeDate(-1), estimatedTime: 20, completed: false, time: "11:30" },
].map(normalizeTask));

const readStoredJson = async (key, fallback) => {
  try {
    const raw = await readStoredValue(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeStoredJson = async (key, value) => {
  await writeStoredValue(key, JSON.stringify(value));
};

const loadStoredAppSettings = async () => {
  const savedSettings = await readStoredJson(STORAGE_KEYS.appSettings, DEFAULT_APP_SETTINGS);
  return {
    ...DEFAULT_APP_SETTINGS,
    ...savedSettings,
    focusDuration: Math.min(180, Math.max(1, Number(savedSettings?.focusDuration) || DEFAULT_APP_SETTINGS.focusDuration)),
    breakDuration: Math.min(60, Math.max(1, Number(savedSettings?.breakDuration) || DEFAULT_APP_SETTINGS.breakDuration)),
  };
};

const loadStoredTasks = async () => {
  const savedTasks = await readStoredJson(STORAGE_KEYS.tasks, null);
  if (!Array.isArray(savedTasks) || savedTasks.length === 0) {
    return []; // Return empty array instead of defaults, allowing users to start fresh
  }
  return savedTasks.map(normalizeTask);
};

const loadStoredDarkMode = async () => Boolean(await readStoredJson(STORAGE_KEYS.dark, false));
const getAdaptiveIconColor = () => (P.cream === DARK.cream ? "#FFFFFF" : "#000000");

const getDayKeyFromTimestamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatDateInput(date);
};

const getStartOfWeek = () => {
  const date = new Date(`${getRelativeDate(0)}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
};

const buildTaskStats = (tasks, completionHistory = []) => {
  const safeTasks = tasks.map(normalizeTask);
  const total = safeTasks.length;
  const done = safeTasks.filter((task) => task.completed);
  const pending = safeTasks.filter((task) => !task.completed);
  const overdue = safeTasks.filter((task) => isTaskOverdue(task));
  const todayKey = getRelativeDate(0);
  const tomorrowKey = getRelativeDate(1);
  const todayTasks = safeTasks.filter((task) => normalizeDueDate(task.dueDate) === todayKey);
  const tomorrowTasks = safeTasks.filter((task) => normalizeDueDate(task.dueDate) === tomorrowKey);
  const todayDone = todayTasks.filter((task) => task.completed);
  const completedMinutes = done.reduce((sum, task) => sum + (task.estimatedTime || 0), 0);
  const todayMinutes = todayDone.reduce((sum, task) => sum + (task.estimatedTime || 0), 0);
  const score = total ? Math.round((done.length / total) * 100) : 0;

  // Use completion history for persistent stats even when tasks are deleted
  const completedByDay = {};
  
  // Add current completed tasks
  done.forEach((task) => {
    const key = getDayKeyFromTimestamp(task.completedAt) || normalizeDueDate(task.dueDate);
    completedByDay[key] = (completedByDay[key] || 0) + 1;
  });
  
  // Add historical completions (group by date, not taskId)
  completionHistory.forEach((record) => {
    if (record.date) {
      completedByDay[record.date] = (completedByDay[record.date] || 0) + 1;
    }
  });

  let currentStreak = 0;
  const streakCursor = new Date(`${todayKey}T00:00:00`);
  while (completedByDay[formatDateInput(streakCursor)] > 0) {
    currentStreak += 1;
    streakCursor.setDate(streakCursor.getDate() - 1);
  }

  const completionDays = Object.keys(completedByDay).sort();
  let bestStreak = 0;
  let runningStreak = 0;
  let previousDate = null;
  completionDays.forEach((dayKey) => {
    const date = new Date(`${dayKey}T00:00:00`);
    if (previousDate) {
      const diffDays = Math.round((date - previousDate) / 86400000);
      runningStreak = diffDays === 1 ? runningStreak + 1 : 1;
    } else {
      runningStreak = 1;
    }
    bestStreak = Math.max(bestStreak, runningStreak);
    previousDate = date;
  });

  const weekStart = getStartOfWeek();
  const weekData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const key = formatDateInput(date);
    return {
      day: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3),
      v: completedByDay[key] || 0,
      key,
    };
  });

  const bestDay = weekData.reduce((best, day) => (day.v > best.v ? day : best), weekData[0] || { day: "N/A", v: 0 });
  const pie = [
    { name: "Done", value: total ? Math.round((done.length / total) * 100) : 0, color: "#207820" },
    { name: "Pending", value: total ? Math.round((pending.length / total) * 100) : 0, color: "#2B2B2B" },
    { name: "Overdue", value: total ? Math.round((overdue.length / total) * 100) : 0, color: "#E63232" },
  ];
  
  // Calculate total done count from completion history for accurate stats
  const totalDoneCount = Object.values(completedByDay).reduce((sum, count) => sum + count, 0);

  const activityMap = Array.from({ length: 35 }, (_, index) => {
    const date = new Date(`${todayKey}T00:00:00`);
    date.setDate(date.getDate() - (34 - index));
    const key = formatDateInput(date);
    const count = completedByDay[key] || 0;
    return {
      id: key,
      v: count >= 4 ? 4 : count >= 3 ? 3 : count >= 2 ? 2 : count >= 1 ? 1 : 0,
    };
  });

  const categories = ["work", "personal", "health", "learning"];
  const categoryBreakdown = categories.map((category) => {
    const count = safeTasks.filter((task) => task.category === category).length;
    return {
      key: category,
      label: CAT_META[category].label,
      count,
      value: total ? Math.round((count / total) * 100) : 0,
      color:
        category === "work" ? P.dark :
        category === "personal" ? P.mid :
        category === "health" ? "#207820" : P.red,
    };
  });

  const achievements = [
    { key: "champ", e: "🏆", l: "CHAMP", d: "10+ streak", bg: "#EAEAEA", bc: P.dark, unlocked: currentStreak >= 10 },
    { key: "speedrun", e: "⚡", l: "SPEEDRUN", d: "1h done", bg: "#FDF0F0", bc: P.red, unlocked: completedMinutes >= 60 },
    { key: "focused", e: "🎯", l: "FOCUSED", d: "5 tasks done", bg: "#E8F0E8", bc: "#207820", unlocked: done.length >= 5 },
    { key: "perfect", e: "🌟", l: "PERFECT", d: "100% today", bg: "#F0EEE0", bc: "#806030", unlocked: todayTasks.length > 0 && todayDone.length === todayTasks.length },
    { key: "onfire", e: "🔥", l: "ON FIRE", d: "7d streak", bg: "#FDF0F0", bc: P.red, unlocked: currentStreak >= 7 },
    { key: "scholar", e: "📚", l: "SCHOLAR", d: "10 study", bg: "#E8EAEE", bc: "#304070", unlocked: safeTasks.filter((task) => task.category === "learning" && task.completed).length >= 10 },
  ];

  const weeklyDone = weekData.reduce((sum, item) => sum + item.v, 0);

  return {
    total,
    done: totalDoneCount, // Use total from completion history instead of current tasks
    pending: pending.length,
    overdue: overdue.length,
    todayTasks,
    todayDone,
    tomorrowTasks,
    todayMinutes,
    completedMinutes,
    score,
    currentStreak,
    bestStreak,
    weekData,
    pie,
    activityMap,
    bestDay,
    categoryBreakdown,
    achievements,
    unlockedAchievements: achievements.filter((badge) => badge.unlocked),
    weeklyDone,
  };
};

const PET_PHRASES=["PAT PAT! 🐾","SO SOFT!","PURR~ ♪","NYAA~ ❤","LOVE U!","*happy*","UWU~","YAY! 🎉","SQUISH~","COMFY!"];

// ─── Global CSS ───────────────────────────────────────────────────────────────
function G({dark=false}) {
  return (
    <style>{`
      @keyframes pop    {0%{transform:scale(0);opacity:0}65%{transform:scale(1.1);opacity:1}100%{transform:scale(1)}}
      @keyframes confetti{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(80px) rotate(720deg);opacity:0}}
      @keyframes blink  {0%,49%{opacity:1}50%,100%{opacity:0}}
      @keyframes floatUp{0%{transform:translateY(0) scale(1);opacity:1}80%{opacity:.8}100%{transform:translateY(-60px) scale(.7);opacity:0}}
      /* idle: gentle bob + subtle breathe-scale */
      @keyframes idleBob{
        0%,100%{transform:translateY(0)    scale(1)}
        40%    {transform:translateY(-7px) scale(1.04)}
        60%    {transform:translateY(-5px) scale(1.03)}
      }
      /* pet reaction: big bounce + tilt */
      @keyframes happyBounce{
        0%  {transform:translateY(0)    scale(1)    rotate(0deg)}
        25% {transform:translateY(-16px) scale(1.22) rotate(-8deg)}
        55% {transform:translateY(-8px)  scale(1.12) rotate(6deg)}
        80% {transform:translateY(-4px)  scale(1.05) rotate(-3deg)}
        100%{transform:translateY(0)    scale(1)    rotate(0deg)}
      }
      .scroll-hide::-webkit-scrollbar{display:none}
      .scroll-hide{-ms-overflow-style:none;scrollbar-width:none}
      .px-card{background:${P.white};border:2.5px solid ${P.black};box-shadow:4px 4px 0 ${P.dark};border-radius:6px;transition:background .3s,border-color .3s}
      .px-btn{border:2.5px solid ${P.black};box-shadow:3px 3px 0 ${P.dark};border-radius:4px;cursor:pointer;transition:all .08s}
      .px-btn:active{box-shadow:1px 1px 0 ${P.dark}!important;transform:translate(2px,2px)}
      .px-input{border:2.5px solid ${P.black};box-shadow:3px 3px 0 ${P.dark};border-radius:4px;outline:none;background:${P.white};color:${P.dark};transition:background .3s}
      .px-input:focus{border-color:${P.red};box-shadow:3px 3px 0 ${P.red}}
      .px-input::placeholder{color:${P.mid}}
      .px-img{image-rendering:pixelated;image-rendering:crisp-edges}
      /* Full-screen on real phones (≤480px) - edge-to-edge like native app */
      @media (max-width: 480px) {
        .app-fullscreen {
          width: 100vw !important;
          height: 100dvh !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
        .app-fullscreen-wrapper {
          width: 100vw !important;
          height: 100dvh !important;
          padding: 0 !important;
        }
        .bottom-nav-inner {
          border-radius: 0 !important;
          border-left: none !important;
          border-right: none !important;
          border-bottom: none !important;
        }
        .bottom-nav-mobile {
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
        }
      }
    `}</style>
  );
}

// ─── Pettable Mascot (original PNG + CSS animations) ─────────────────────────
function PettableMascot({src, size=80}) {
  const [patting, setPatting] = useState(false);
  const [hearts, setHearts]   = useState([]);
  const [phrase, setPhrase]   = useState("");
  const count = useRef(0);

  const pet = () => {
    const id  = Date.now();
    const off = (Math.random()-.5)*36;
    const EMOJIS=["❤️","💕","✨","💗","🌟","💖"];
    const e = EMOJIS[Math.floor(Math.random()*EMOJIS.length)];
    count.current++;
    setPhrase(PET_PHRASES[count.current % PET_PHRASES.length]);
    setHearts(h=>[...h,{id,off,e}]);
    setPatting(true);
    setTimeout(()=>setPatting(false), 750);
    setTimeout(()=>setHearts(h=>h.filter(x=>x.id!==id)), 1300);
  };

  return (
    <div style={{position:"relative",display:"inline-block",cursor:"pointer",userSelect:"none",flexShrink:0}}
      onClick={pet} title="Pet me!">
      {hearts.map(h=>(
        <div key={h.id} style={{position:"absolute",bottom:"100%",
          left:`calc(50% + ${h.off}px)`,transform:"translateX(-50%)",
          pointerEvents:"none",animation:"floatUp 1.2s ease-out forwards",
          fontSize:Math.round(size*.28),lineHeight:1,
          filter:"drop-shadow(0 1px 2px rgba(0,0,0,.25))"}}>
          {h.e}
        </div>
      ))}
      {patting&&(
        <div style={{position:"absolute",bottom:"calc(100% + 5px)",left:"50%",
          transform:"translateX(-50%)",whiteSpace:"nowrap",
          background:P.white,border:`2.5px solid ${P.black}`,
          boxShadow:`2px 2px 0 ${P.black}`,borderRadius:3,
          padding:"3px 9px",fontSize:9,fontFamily:"monospace",
          fontWeight:900,color:P.red,
          animation:"pop .15s ease-out",pointerEvents:"none",zIndex:10}}>
          {phrase}
        </div>
      )}
      <ImageWithFallback src={src} alt="" className="px-img" style={{
        width:size, height:size, objectFit:"contain", display:"block",
        animation: patting ? "happyBounce .28s ease-in-out 2.5" : "idleBob 2.6s ease-in-out infinite",
      }}/>
    </div>
  );
}

// Non-interactive sprite (splash screen) — uses same PNG with float animation
function Sprite({src, size=80}) {
  return (
    <div style={{display:"inline-block",flexShrink:0}}>
      <ImageWithFallback src={src} alt="" className="px-img"
        style={{width:size,height:size,objectFit:"contain",display:"block",
          animation:"idleBob 2.6s ease-in-out infinite"}}/>
    </div>
  );
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────
function PixelBar({pct,color=P.red,h=12}) {
  return (
    <div style={{background:"rgba(255,255,255,.25)",border:"2px solid rgba(255,255,255,.4)",borderRadius:2,height:h,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${pct}%`,background:color,
        backgroundImage:"repeating-linear-gradient(90deg,transparent,transparent 5px,rgba(255,255,255,.2) 5px,rgba(255,255,255,.2) 6px)",
        transition:"width 1.2s cubic-bezier(.4,0,.2,1)",borderRadius:2}}/>
    </div>
  );
}

function Bars({data}) {
  const max=Math.max(...data.map(d=>d.v));
  const COLS=[P.dark,P.red,P.mid,P.dark,P.red,P.mid,P.dark];
  return (
    <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:6,height:110}}>
      {data.map((d,i)=>{
        const h=Math.max(8,(d.v/max)*80);
        return (
          <div key={d.day} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,flex:1}}>
            <span style={{fontSize:9,fontWeight:900,color:COLS[i],fontFamily:"monospace"}}>{d.v}</span>
            <div style={{height:80,width:"100%",display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
              <div style={{height:h,background:COLS[i],border:`1.5px solid ${P.black}`,
                backgroundImage:"repeating-linear-gradient(180deg,transparent,transparent 3px,rgba(0,0,0,.1) 3px,rgba(0,0,0,.1) 4px)"}}/>
            </div>
            <span style={{fontSize:8,fontWeight:700,color:P.mid,fontFamily:"monospace"}}>{d.day}</span>
          </div>
        );
      })}
    </div>
  );
}

function Donut({segs}) {
  const r=34,sw=16,c=2*Math.PI*r; let deg=-90;
  return (
    <svg width={100} height={100} viewBox="0 0 100 100">
      <circle cx={50} cy={50} r={r} fill="none" stroke="#E5E5E0" strokeWidth={sw}/>
      {segs.map(s=>{
        const dash=Math.max(0,(s.value/100)*c-2);
        const sd=deg; deg+=(s.value/100)*360;
        return <circle key={s.name} cx={50} cy={50} r={r} fill="none" stroke={s.color}
          strokeWidth={sw} strokeLinecap="butt" strokeDasharray={`${dash} ${c}`} transform={`rotate(${sd} 50 50)`}/>;
      })}
    </svg>
  );
}

function CatChip({cat}) {
  const m=CAT_META[cat];
  return <span style={{fontSize:10,padding:"2px 8px",borderRadius:2,fontWeight:700,background:m.bg,color:m.text,border:`1.5px solid ${m.border}`,fontFamily:"monospace"}}>{m.emoji} {m.label}</span>;
}
function PrioChip({p}) {
  const labels={high:"HIGH",medium:"MED",low:"LOW"};
  return <span style={{fontSize:9,padding:"2px 7px",borderRadius:2,fontWeight:700,background:"transparent",color:PRIO_COLOR[p],border:`1.5px solid ${PRIO_COLOR[p]}`,fontFamily:"monospace"}}>● {labels[p]}</span>;
}

function Confetti() {
  const COLS=[P.dark,P.red,P.mid,P.black,P.red,P.dark];
  return (
    <div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:30}}>
      {Array.from({length:16},(_,i)=>(
        <div key={i} style={{position:"absolute",left:`${5+i*5.8}%`,top:"8%",
          width:10,height:10,background:COLS[i%6],opacity:0,
          borderRadius:i%3===0?"50%":0,
          animation:`confetti 1.3s ease-out ${i*0.07}s forwards`}}/>
      ))}
    </div>
  );
}

// ─── Splash ───────────────────────────────────────────────────────────────────
function Splash({done}) {
  useEffect(()=>{const t=setTimeout(done,2800);return()=>clearTimeout(t);},[done]);
  return (
    <div style={{position:"absolute",inset:0,background:P.dark,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)`,backgroundSize:"16px 16px"}}/>
      {[...Array(12)].map((_,i)=>(
        <div key={i} style={{position:"absolute",top:`${5+(i*7.8)%88}%`,left:`${(i*9.3)%90}%`,
          width:i%3===0?6:4,height:i%3===0?6:4,
          background:[P.white,P.red,P.light,P.cream][i%4],
          animation:`blink ${0.7+(i%4)*.3}s step-end infinite`}}/>
      ))}
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:.6}}
        style={{display:"flex",flexDirection:"column",alignItems:"center",gap:20,zIndex:1}}>
        <div style={{background:P.red,border:`3px solid ${P.white}`,boxShadow:`5px 5px 0 ${P.white}`,padding:"14px 24px",borderRadius:4}}>
          <span style={{fontFamily:"monospace",fontWeight:900,fontSize:22,color:P.white,letterSpacing:2}}>DAY</span>
          <span style={{fontFamily:"monospace",fontWeight:900,fontSize:22,color:P.dark,letterSpacing:2}}>FLOW</span>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
          <Sprite src={catPng}   size={96}/>
          <Sprite src={bunnyPng} size={88}/>
        </div>
        <div style={{textAlign:"center",display:"flex",flexDirection:"column",gap:8}}>
          <span style={{fontFamily:"monospace",fontWeight:700,fontSize:10,color:P.light,letterSpacing:3}}>TRACK TODAY</span>
          <span style={{fontFamily:"monospace",fontWeight:900,fontSize:10,color:P.white,letterSpacing:2}}>GROW TOMORROW</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontFamily:"monospace",fontSize:9,color:P.light}}>LOADING</span>
          <span style={{fontFamily:"monospace",fontSize:9,color:P.red,animation:"blink .55s step-end infinite"}}>█</span>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Onboarding ───────────────────────────────────────────────────────────────
const OB=[
  {title:"CAPTURE TASKS", desc:"Grab every to-do before it slips away.",src:bunnyPng,col:P.dark,  accentBg:"#EAEAEA"},
  {title:"STAY FOCUSED",  desc:"Pomodoro mode keeps you locked in.",    src:catPng,  col:P.red,   accentBg:"#FDF0F0"},
  {title:"LEVEL UP!",     desc:"Charts and streaks celebrate every win.",src:catPng, col:"#207820",accentBg:"#E8F0E8"},
];

function Onboarding({done}) {
  const [pg,setPg]=useState(0);
  const p=OB[pg];
  return (
    <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",background:p.accentBg,transition:"background .4s"}}>
      <div style={{display:"flex",justifyContent:"center",gap:6,paddingTop:20,paddingBottom:8}}>
        {OB.map((_,i)=>(
          <div key={i} style={{width:i===pg?28:8,height:8,background:i===pg?p.col:P.light,border:`2px solid ${P.black}`,borderRadius:2,transition:"all .3s"}}/>
        ))}
      </div>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <PettableMascot src={p.src} size={160}/>
      </div>
      <div style={{background:P.white,borderTop:`3px solid ${p.col}`,borderLeft:`3px solid ${p.col}`,borderRight:`3px solid ${p.col}`,borderBottom:"none",borderRadius:"6px 6px 0 0",margin:"0 12px",padding:"24px 22px 28px"}}>
        <h2 style={{fontFamily:"monospace",fontWeight:900,fontSize:15,color:p.col,marginBottom:12,letterSpacing:1}}>{p.title}</h2>
        <p style={{fontFamily:"'Inter',sans-serif",fontSize:14,color:P.mid,lineHeight:1.6,marginBottom:24}}>{p.desc}</p>
        <button onClick={()=>pg<2?setPg(q=>q+1):done()} className="px-btn"
          style={{width:"100%",padding:"14px 0",fontSize:14,fontWeight:900,fontFamily:"monospace",background:p.col,color:P.white,borderColor:P.black,letterSpacing:1}}>
          {pg<2?"NEXT ▶":"START ▶▶"}
        </button>
        {pg<2&&<button onClick={done} style={{width:"100%",marginTop:10,padding:"8px 0",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif",color:P.light,background:"transparent",border:"none",cursor:"pointer"}}>skip intro</button>}
      </div>
    </div>
  );
}

// ─── Home Screen  (mascot: CAT) ───────────────────────────────────────────────
function HomeScreen({tasks,onToggle,onFocus,showNotificationDot,userName}) {
  const stats = buildTaskStats(tasks);
  const todayAll=tasks.filter(t=>getDueDateLabel(t.dueDate)==="Today");
  const done=todayAll.filter(t=>t.completed).length;
  const pct=todayAll.length?Math.round((done/todayAll.length)*100):0;
  const h=new Date().getHours();
  const greet=h<12?"GOOD MORNING":h<17?"GOOD AFTERNOON":"GOOD EVENING";

  return (
    <div className="scroll-hide" style={{flex:1,overflowY:"auto",padding:"12px 16px 128px",display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:4}}>
        <div>
          <div style={{fontFamily:"monospace",fontSize:8,color:P.mid,marginBottom:3,letterSpacing:2}}>{greet}</div>
          <div style={{fontFamily:"monospace",fontWeight:900,fontSize:17,color:P.dark,lineHeight:1.4}}>
            {userName.includes(" ") ? (
              <>
                {userName.split(" ")[0].toUpperCase()}<br/>
                {userName.split(" ").slice(1).join(" ").toUpperCase()}
              </>
            ) : (
              userName.toUpperCase()
            )}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button className="px-btn" style={{width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",background:P.white,position:"relative"}}>
            <Bell style={{width:17,height:17,color:P.dark}}/>
            {showNotificationDot && <div style={{position:"absolute",top:4,right:4,width:8,height:8,background:P.red,border:`2px solid ${P.black}`,borderRadius:"50%"}}/>}
          </button>
          <PettableMascot src={catPng} size={52}/>
        </div>
      </div>

      <div style={{background:P.dark,border:`3px solid ${P.black}`,boxShadow:`6px 6px 0 ${P.black}`,borderRadius:6,padding:"18px 18px 16px",position:"relative"}}>
        <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,background:P.red,borderRadius:"50%",opacity:.12,pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
          <div>
            <div style={{fontFamily:"monospace",fontSize:8,color:P.light,marginBottom:6,letterSpacing:2}}>TODAY'S QUEST</div>
            <div style={{fontFamily:"monospace",fontWeight:900,fontSize:42,color:P.white,lineHeight:1}}>
              {pct}<span style={{fontSize:18,color:P.light}}>%</span>
            </div>
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:600,color:P.light,marginTop:4}}>{done}/{todayAll.length} tasks complete</div>
          </div>
          <PettableMascot src={catPng} size={72}/>
        </div>
        <PixelBar pct={pct} color={P.red} h={14}/>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
          <span style={{fontFamily:"monospace",fontSize:8,color:P.light}}>0%</span>
          <span style={{fontFamily:"monospace",fontSize:8,color:P.light}}>100%</span>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[
          {e:"⏰",l:"HOURS",  v:`${(stats.todayMinutes/60).toFixed(stats.todayMinutes >= 60 ? 1 : 0)}h`,bg:P.white,   bc:P.dark},
          {e:"🎯",l:"DONE",   v:String(stats.done),bg:"#FDF0F0", bc:P.red},
          {e:"⚡",l:"SCORE",  v:`${stats.score}%`, bg:"#EAEAEA",  bc:P.mid},
          {e:"🔥",l:"STREAK", v:`×${stats.currentStreak}`, bg:P.dark,     bc:P.black,light:true},
        ].map(s=>(
          <div key={s.l} style={{background:s.bg,border:`2.5px solid ${s.bc}`,boxShadow:`3px 3px 0 ${s.bc}`,borderRadius:4,padding:"13px 14px"}}>
            <div style={{fontSize:20,marginBottom:7}}>{s.e}</div>
            <div style={{fontFamily:"monospace",fontWeight:900,fontSize:18,color:s.light?P.white:s.bc,lineHeight:1}}>{s.v}</div>
            <div style={{fontFamily:"monospace",fontSize:8,color:s.light?P.light:P.mid,marginTop:4,letterSpacing:1}}>{s.l}</div>
          </div>
        ))}
      </div>

      <button onClick={onFocus} className="px-btn"
        style={{width:"100%",padding:"13px 16px",background:P.red,borderColor:P.black,color:P.white,display:"flex",alignItems:"center",gap:12}}>
        <Timer style={{width:18,height:18,flexShrink:0}}/>
        <div style={{textAlign:"left",flex:1}}>
          <div style={{fontFamily:"monospace",fontWeight:900,fontSize:9,letterSpacing:1,marginBottom:2}}>FOCUS MODE</div>
          <div style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:600,opacity:.85}}>Start a pomodoro session</div>
        </div>
        <span style={{fontFamily:"monospace",fontSize:12,fontWeight:900}}>▶</span>
      </button>

      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <span style={{fontFamily:"monospace",fontWeight:900,fontSize:10,color:P.dark,letterSpacing:1}}>TODAY'S TASKS</span>
          <span style={{fontFamily:"monospace",fontSize:9,fontWeight:700,padding:"3px 10px",background:P.red,border:`2px solid ${P.black}`,borderRadius:2,color:P.white}}>
            {todayAll.filter(t=>!t.completed).length} LEFT
          </span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          {todayAll.slice(0,4).map(task=>{
            const cc=CAT_META[task.category];
            return (
              <div key={task.id} style={{background:task.completed?"#EFEFEF":cc.bg,border:`2.5px solid ${task.completed?P.light:cc.border}`,boxShadow:`3px 3px 0 ${task.completed?P.light:cc.border}`,borderRadius:4,padding:"11px 13px",display:"flex",alignItems:"center",gap:10}}>
                <button onClick={()=>onToggle(task.id)} style={{width:22,height:22,border:`2.5px solid ${task.completed?"#207820":PRIO_COLOR[task.priority]}`,background:task.completed?"#207820":"white",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,borderRadius:2,cursor:"pointer",boxShadow:`2px 2px 0 ${P.black}`}}>
                  {task.completed&&<Check style={{width:12,height:12,color:"white"}}/>}
                </button>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontFamily:"'Inter',sans-serif",fontSize:15,fontWeight:700,textDecoration:task.completed?"line-through":"none",color:task.completed?P.mid:cc.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:5}}>{task.title}</p>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <CatChip cat={task.category}/>
                    {task.estimatedTime&&<span style={{fontFamily:"monospace",fontSize:9,color:P.mid}}>⏱{task.estimatedTime}m</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-card" style={{padding:"16px 18px"}}>
        <div style={{fontFamily:"monospace",fontWeight:900,fontSize:10,color:P.dark,marginBottom:12,letterSpacing:1}}>COMING UP</div>
        {stats.tomorrowTasks.length===0 ? (
          <div style={{fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:600,color:P.mid}}>No tasks scheduled for tomorrow yet.</div>
        ) : stats.tomorrowTasks.slice(0,2).map((task,i)=>(
          <div key={task.id} style={{display:"flex",alignItems:"center",gap:10,paddingTop:i!==0?10:0,marginTop:i!==0?10:0,borderTop:i!==0?`1.5px solid ${P.cream}`:undefined}}>
            <div style={{width:32,height:32,background:P.dark,border:`2px solid ${P.black}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Clock style={{width:14,height:14,color:P.white}}/>
            </div>
            <div style={{flex:1}}>
              <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:700,color:P.dark}}>{task.title}</p>
              <p style={{fontFamily:"monospace",fontSize:9,color:P.mid,marginTop:2}}>{getDueDateLabel(task.dueDate)}{task.time ? ` · ${task.time}` : ""}</p>
            </div>
            <PrioChip p={task.priority}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tasks Screen  (mascot: BUNNY) ────────────────────────────────────────────
function TasksScreen({tasks,onToggle,onAdd,onDelete,onEdit}) {
  const [filter,setFilter]=useState("all");
  const [q,setQ]=useState("");
  const TABS=[
    {k:"all",     l:"ALL",   col:P.dark},
    {k:"today",   l:"TODAY", col:P.red},
    {k:"tomorrow",l:"TMR",   col:P.mid},
    {k:"done",    l:"DONE",  col:"#207820"},
    {k:"overdue", l:"LATE!", col:"#E63232"},
  ];
  const filtered=tasks.filter(t=>{
    const ms=t.title.toLowerCase().includes(q.toLowerCase());
    const dueLabel = getDueDateLabel(t.dueDate);
    const overdue = isTaskOverdue(t);
    const mf=filter==="all"?true:filter==="today"?dueLabel==="Today":filter==="tomorrow"?dueLabel==="Tomorrow":filter==="done"?t.completed:overdue;
    return ms&&mf;
  });
  return (
    <div className="scroll-hide" style={{flex:1,overflowY:"auto",paddingBottom:128}}>
      <div style={{background:P.dark,borderBottom:`3px solid ${P.black}`,padding:"14px 16px 18px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div>
            <div style={{fontFamily:"monospace",fontSize:8,color:P.light,marginBottom:4,letterSpacing:2}}>YOUR QUESTS</div>
            <div style={{fontFamily:"monospace",fontWeight:900,fontSize:20,color:P.white,letterSpacing:1}}>MY TASKS</div>
          </div>
          <PettableMascot src={bunnyPng} size={58}/>
        </div>
        <div style={{background:"rgba(255,255,255,.12)",border:"2px solid rgba(255,255,255,.3)",borderRadius:4,display:"flex",alignItems:"center",gap:10,padding:"9px 14px"}}>
          <Search style={{width:15,height:15,color:"rgba(255,255,255,.7)",flexShrink:0}}/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="SEARCH TASKS..."
            style={{flex:1,background:"transparent",fontSize:14,outline:"none",color:P.white,fontWeight:700,border:"none",fontFamily:"monospace",letterSpacing:.5}}/>
          {q&&<button onClick={()=>setQ("")} style={{background:"transparent",border:"none",cursor:"pointer"}}><X style={{width:15,height:15,color:"rgba(255,255,255,.7)"}}/></button>}
        </div>
      </div>
      <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",gap:8,overflowX:"auto"}} className="scroll-hide">
          {TABS.map(f=>(
            <button key={f.k} onClick={()=>setFilter(f.k)} className="px-btn"
              style={{padding:"6px 12px",fontSize:9,fontWeight:900,whiteSpace:"nowrap",fontFamily:"monospace",letterSpacing:.5,
                background:filter===f.k?f.col:P.white,color:filter===f.k?P.white:f.col,
                borderColor:f.col,boxShadow:filter===f.k?`3px 3px 0 ${P.black}`:`2px 2px 0 ${f.col}`}}>
              {f.l}
            </button>
          ))}
        </div>
        {filtered.length===0?(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",paddingTop:32,gap:16}}>
            <PettableMascot src={bunnyPng} size={110}/>
            <div className="px-card" style={{textAlign:"center",padding:"18px 24px"}}>
              <div style={{fontFamily:"monospace",fontSize:10,color:P.dark,marginBottom:8,letterSpacing:1}}>NO TASKS!</div>
              <div style={{fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:600,color:P.mid,marginBottom:16}}>Quest log is empty</div>
              <button onClick={onAdd} className="px-btn"
                style={{padding:"10px 20px",fontSize:12,fontWeight:900,fontFamily:"monospace",background:P.red,color:P.white,borderColor:P.black,letterSpacing:1}}>
                + ADD TASK
              </button>
            </div>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {filtered.map(task=>{
              const cc=CAT_META[task.category];
              return (
                <div key={task.id} style={{background:task.completed?"#EFEFEF":isTaskOverdue(task)?"#FDF0F0":cc.bg,border:`2.5px solid ${isTaskOverdue(task)?P.red:task.completed?P.light:cc.border}`,boxShadow:`3px 3px 0 ${isTaskOverdue(task)?P.red:task.completed?P.light:cc.border}`,borderRadius:4,padding:"13px 15px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                    <button onClick={()=>onToggle(task.id)} style={{width:22,height:22,border:`2.5px solid ${task.completed?"#207820":PRIO_COLOR[task.priority]}`,background:task.completed?"#207820":"white",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2,borderRadius:2,cursor:"pointer",boxShadow:`2px 2px 0 ${P.black}`}}>
                      {task.completed&&<Check style={{width:12,height:12,color:"white"}}/>}
                    </button>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontFamily:"'Inter',sans-serif",fontSize:15,fontWeight:700,lineHeight:1.4,marginBottom:8,textDecoration:task.completed?"line-through":"none",color:task.completed?P.mid:isTaskOverdue(task)?P.red:cc.text}}>{task.title}</p>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <CatChip cat={task.category}/>
                        <PrioChip p={task.priority}/>
                        {task.estimatedTime&&<span style={{fontFamily:"monospace",fontSize:9,color:P.mid}}>⏱{task.estimatedTime}m</span>}
                        <span style={{fontFamily:"monospace",fontSize:9,color:isTaskOverdue(task)?P.red:P.light}}>
                          {getDueDateLabel(task.dueDate)}{task.time ? ` · ${task.time}` : ""}
                        </span>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,flexShrink:0}}>
                      <button onClick={()=>onEdit(task)} style={{width:28,height:28,background:P.white,border:`2px solid ${P.black}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:`2px 2px 0 ${P.black}`,marginTop:2}}>
                        <span style={{fontSize:12,fontWeight:900}}>✏️</span>
                      </button>
                      <button onClick={()=>onDelete(task.id)} style={{width:28,height:28,background:"#E63232",border:`2px solid ${P.black}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",boxShadow:`2px 2px 0 ${P.black}`,marginTop:2}}>
                        <X style={{width:14,height:14,color:"white"}}/>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Analytics Screen  (mascot: CAT) ─────────────────────────────────────────
function AnalyticsScreen({stats}) {
  const HM=["#F0F0EE","#C8C8C4","#9A9A96","#6B6B68",P.dark];
  return (
    <div className="scroll-hide" style={{flex:1,overflowY:"auto",paddingBottom:128}}>
      <div style={{background:P.dark,borderBottom:`3px solid ${P.black}`,padding:"14px 16px 18px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontFamily:"monospace",fontSize:8,color:P.light,marginBottom:4,letterSpacing:2}}>YOUR STATS</div>
            <div style={{fontFamily:"monospace",fontWeight:900,fontSize:18,color:P.white,letterSpacing:1}}>ANALYTICS</div>
          </div>
          <PettableMascot src={catPng} size={62}/>
        </div>
      </div>
      <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:14}}>
        <div style={{background:P.red,border:`3px solid ${P.black}`,boxShadow:`5px 5px 0 ${P.black}`,borderRadius:6,padding:"16px 18px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:40}}>🔥</div>
            <div>
              <div style={{fontFamily:"monospace",fontSize:8,color:"rgba(255,255,255,.7)",marginBottom:4,letterSpacing:2}}>CURRENT STREAK</div>
              <div style={{fontFamily:"monospace",fontWeight:900,fontSize:28,color:P.white,lineHeight:1}}>{stats.currentStreak} DAYS</div>
              <div style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:600,color:"rgba(255,255,255,.7)",marginTop:4}}>Best: {stats.bestStreak} days</div>
            </div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {[
            {v:String(stats.done),e:"✅",l:"DONE",   bg:"#E8F0E8",bc:"#207820"},
            {v:String(stats.pending),e:"⏳",l:"PENDING",bg:"#EAEAEA", bc:P.dark},
            {v:String(stats.overdue), e:"🚨",l:"OVERDUE",bg:"#FDF0F0", bc:P.red},
          ].map(s=>(
            <div key={s.l} style={{background:s.bg,border:`2.5px solid ${s.bc}`,boxShadow:`3px 3px 0 ${s.bc}`,borderRadius:4,padding:"13px 8px",textAlign:"center"}}>
              <div style={{fontSize:20,marginBottom:4}}>{s.e}</div>
              <div style={{fontFamily:"monospace",fontWeight:900,fontSize:16,color:s.bc,lineHeight:1}}>{s.v}</div>
              <div style={{fontFamily:"monospace",fontSize:8,color:s.bc,marginTop:4,letterSpacing:.5}}>{s.l}</div>
            </div>
          ))}
        </div>
        <div className="px-card" style={{padding:16}}>
          <div style={{fontFamily:"monospace",fontWeight:900,fontSize:9,color:P.dark,marginBottom:14,letterSpacing:1}}>THIS WEEK</div>
          <Bars data={stats.weekData}/>
        </div>
        <div className="px-card" style={{padding:16}}>
          <div style={{fontFamily:"monospace",fontWeight:900,fontSize:9,color:P.dark,marginBottom:14,letterSpacing:1}}>BREAKDOWN</div>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <Donut segs={stats.pie}/>
            <div style={{display:"flex",flexDirection:"column",gap:10,flex:1}}>
              {stats.pie.map(d=>(
                <div key={d.name} style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:12,height:12,background:d.color,border:`2px solid ${P.black}`,flexShrink:0,borderRadius:1}}/>
                  <span style={{fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:600,color:P.mid,flex:1}}>{d.name}</span>
                  <span style={{fontFamily:"monospace",fontWeight:900,fontSize:11,color:d.color}}>{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="px-card" style={{padding:16}}>
          <div style={{fontFamily:"monospace",fontWeight:900,fontSize:9,color:P.dark,marginBottom:10,letterSpacing:1}}>ACTIVITY MAP</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
            {stats.activityMap.map(c=>(
              <div key={c.id} style={{aspectRatio:"1",background:HM[c.v],border:`1.5px solid ${P.black}`,borderRadius:1}}/>
            ))}
          </div>
        </div>
        <div style={{background:"#EAEAEA",border:`3px solid ${P.dark}`,boxShadow:`4px 4px 0 ${P.black}`,borderRadius:6,padding:"16px 18px",display:"flex",alignItems:"center",gap:12}}>
          <Trophy style={{width:38,height:38,color:P.dark,flexShrink:0}}/>
          <div>
            <div style={{fontFamily:"monospace",fontSize:8,color:P.mid,marginBottom:4,letterSpacing:1}}>BEST DAY</div>
            <div style={{fontFamily:"monospace",fontWeight:900,fontSize:16,color:P.dark}}>{stats.bestDay?.v ? `${stats.bestDay.day} · ${stats.bestDay.v} done` : "No data yet"}</div>
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:600,color:P.mid,marginTop:2}}>
              {stats.bestDay?.v ? "Your strongest day this week" : "Complete tasks to build your weekly history"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Focus Screen  (mascot: BUNNY) ────────────────────────────────────────────
function FocusScreen({appSettings}) {
  const [mode,setMode]=useState("focus");
  const focusSeconds = appSettings.focusDuration * 60;
  const breakSeconds = appSettings.breakDuration * 60;
  const [left,setLeft]=useState(focusSeconds);
  const [on,setOn]=useState(false);
  const [sess,setSess]=useState(0);
  const ref=useRef(null);
  const total=mode==="focus"?focusSeconds:breakSeconds;
  const pct=((total-left)/total)*100;
  useEffect(()=>{
    if(on){ref.current=setInterval(()=>setLeft(p=>{if(p<=1){setOn(false);if(mode==="focus")setSess(s=>s+1);return 0;}return p-1;}),1000);}
    else if(ref.current)clearInterval(ref.current);
    return()=>{if(ref.current)clearInterval(ref.current);};
  },[on,mode]);
  useEffect(()=>{
    if(!on){
      setLeft(mode==="focus"?focusSeconds:breakSeconds);
    }
  },[mode,focusSeconds,breakSeconds,on]);
  const reset=()=>{setOn(false);setLeft(mode==="focus"?focusSeconds:breakSeconds);};
  const sw=(m)=>{setMode(m);setOn(false);};
  const mm=String(Math.floor(left/60)).padStart(2,"0"),ss=String(left%60).padStart(2,"0");
  const col=mode==="focus"?P.red:P.mid;
  return (
    <div className="scroll-hide" style={{flex:1,overflowY:"auto",paddingBottom:128,display:"flex",flexDirection:"column"}}>
      <div style={{background:P.dark,borderBottom:`3px solid ${P.black}`,padding:"14px 16px 18px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div>
            <div style={{fontFamily:"monospace",fontSize:8,color:P.light,marginBottom:4,letterSpacing:2}}>POMODORO</div>
            <div style={{fontFamily:"monospace",fontWeight:900,fontSize:18,color:P.white,letterSpacing:1}}>FOCUS MODE</div>
          </div>
          <PettableMascot src={bunnyPng} size={54}/>
        </div>
        <div style={{display:"flex",gap:0,background:"rgba(255,255,255,.1)",border:`2px solid rgba(255,255,255,.3)`,borderRadius:4,overflow:"hidden"}}>
          {["focus","break"].map((m,i)=>(
            <button key={m} onClick={()=>sw(m)}
              style={{flex:1,padding:"10px 0",fontSize:11,fontWeight:900,cursor:"pointer",fontFamily:"monospace",letterSpacing:1,
                background:mode===m?(m==="focus"?P.red:P.mid):"transparent",
                color:mode===m?P.white:"rgba(255,255,255,.6)",
                borderTop:"none",borderBottom:"none",borderLeft:"none",
                borderRight:i===0?`2px solid rgba(255,255,255,.2)`:"none"}}>
              {m==="focus"?"▶ FOCUS":"☕ BREAK"}
            </button>
          ))}
        </div>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:18,padding:"18px 20px"}}>
        <div style={{background:col,border:`3px solid ${P.black}`,boxShadow:`6px 6px 0 ${P.black}`,borderRadius:6,padding:"22px 36px",textAlign:"center",width:"100%"}}>
          <div style={{fontFamily:"monospace",fontWeight:900,fontSize:52,color:P.white,lineHeight:1,letterSpacing:4}}>{mm}:{ss}</div>
          <div style={{fontFamily:"monospace",fontSize:9,fontWeight:700,color:"rgba(255,255,255,.7)",marginTop:6,letterSpacing:2,textTransform:"uppercase"}}>{mode} session</div>
          <div style={{marginTop:14}}><PixelBar pct={pct} color="rgba(255,255,255,.85)" h={12}/></div>
        </div>
        <PettableMascot src={bunnyPng} size={100}/>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <button onClick={reset} className="px-btn" style={{width:48,height:48,display:"flex",alignItems:"center",justifyContent:"center",background:P.white}}>
            <RotateCcw style={{width:18,height:18,color:P.dark}}/>
          </button>
          <button onClick={()=>setOn(r=>!r)} className="px-btn"
            style={{width:76,height:76,display:"flex",alignItems:"center",justifyContent:"center",background:on?"#E63232":col,borderColor:P.black,boxShadow:`5px 5px 0 ${P.black}`}}>
            {on?<Pause style={{width:32,height:32,color:P.white}}/>:<Play style={{width:32,height:32,color:P.white,marginLeft:4}}/>}
          </button>
          <div className="px-card" style={{width:48,height:48,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontFamily:"monospace",fontWeight:900,fontSize:14,color:P.dark}}>{sess}</span>
          </div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {[0,1,2,3].map(i=>(
            <div key={i} style={{width:i<sess%4?24:14,height:14,background:i<sess%4?col:P.white,border:`2.5px solid ${i<sess%4?col:P.light}`,boxShadow:i<sess%4?`2px 2px 0 ${P.black}`:"none",borderRadius:2,transition:"all .3s"}}/>
          ))}
        </div>
        <div style={{fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:700,color:P.mid}}>
          {sess} session{sess!==1?"s":""} completed today 🎉
        </div>
      </div>
    </div>
  );
}

// ─── Profile Screen  (mascot: CAT) ────────────────────────────────────────────
function ProfileScreen({dark,toggleDark,stats,appSettings,setAppSettings,userName,setUserName}) {
  const [isEditing,setIsEditing]=useState(false);
  const [tempName,setTempName]=useState(userName);
  const [notificationsEnabled,setNotificationsEnabled]=useState(true);
  const [showNotificationSheet,setShowNotificationSheet]=useState(false);
  const [showAppSettingsSheet,setShowAppSettingsSheet]=useState(false);
  const [showAchievementsSheet,setShowAchievementsSheet]=useState(false);
  const [showWeeklyReportsSheet,setShowWeeklyReportsSheet]=useState(false);
  const actionIconColor = getAdaptiveIconColor();
  
  const [notificationSettings,setNotificationSettings]=useState({
    taskReminders: true,
    focusSessionEnd: true,
    dailySummary: true,
    streakAlerts: true,
    soundEffects: true,
  });

  const handleSaveName=()=>{
    setUserName(tempName);
    setIsEditing(false);
  };

  const activeNotificationCount = Object.values(notificationSettings).filter(Boolean).length;
  const OPTS=[
    {e:"🌙",l:"Dark Mode",     toggle:true, val:dark, fn:toggleDark},
    {e:"🔔",l:"Notifications", toggle:true, val:notificationsEnabled, fn:()=>setNotificationsEnabled(v=>!v), onClick:()=>setShowNotificationSheet(true)},
    {e:"🏅",l:"Achievements",  arrow:true, onClick:()=>setShowAchievementsSheet(true)},
    {e:"📈",l:"Weekly Reports",arrow:true, onClick:()=>setShowWeeklyReportsSheet(true)},
    {e:"⚙️", l:"App Settings",  arrow:true, onClick:()=>setShowAppSettingsSheet(true)},
  ];
  return (
    <div className="scroll-hide" style={{flex:1,overflowY:"auto",paddingBottom:128}}>
      <div style={{background:P.dark,borderBottom:`3px solid ${P.black}`,padding:"14px 16px 24px"}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
          <PettableMascot src={catPng} size={80}/>
          <div style={{background:P.white,border:`3px solid ${P.red}`,boxShadow:`4px 4px 0 ${P.red}`,borderRadius:4,width:64,height:64,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>
            🐱
          </div>
          <div style={{textAlign:"center"}}>
            {isEditing ? (
              <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
                <input 
                  value={tempName}
                  onChange={e=>setTempName(e.target.value)}
                  className="px-input" 
                  style={{padding:"6px 10px",fontSize:13,fontWeight:900,fontFamily:"monospace",textAlign:"center",width:150}}
                />
                <button onClick={handleSaveName} className="px-btn" style={{padding:"6px 12px",fontSize:10,fontWeight:700,fontFamily:"monospace",background:P.red,color:P.white,borderColor:P.black}}>
                  ✓
                </button>
              </div>
            ) : (
              <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
                <div style={{fontFamily:"monospace",fontWeight:900,fontSize:13,color:P.white,letterSpacing:1}}>{userName}</div>
                <button onClick={()=>setIsEditing(true)} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:12,color:P.light}}>
                  ✏️
                </button>
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:28}}>
            {[{l:"STREAK🔥",v:String(stats.currentStreak)},{l:"BEST🏆",v:String(stats.bestStreak)},{l:"DONE✅",v:String(stats.done)}].map(s=>(
              <div key={s.l} style={{textAlign:"center"}}>
                <div style={{fontFamily:"monospace",fontWeight:900,fontSize:16,color:P.red}}>{s.v}</div>
                <div style={{fontFamily:"monospace",fontSize:8,color:P.light,marginTop:3,letterSpacing:.5}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:14}}>
        <div className="px-card" style={{overflow:"hidden"}}>
          {OPTS.map((s,i)=>(
            <div key={i} onClick={s.onClick} style={{display:"flex",alignItems:"center",gap:10,padding:"13px 15px",borderTop:i!==0?`1.5px solid ${P.cream}`:undefined,cursor:s.onClick?"pointer":"default"}}>
              <div style={{width:36,height:36,background:P.cream,border:`2px solid ${P.dark}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>
                {s.e}
              </div>
              <div style={{flex:1}}>
                <span style={{fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:700,color:P.dark}}>{s.l}</span>
                {s.l==="Notifications" && (
                  <div style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:500,color:P.mid,marginTop:2}}>
                    {notificationsEnabled ? `On · ${activeNotificationCount} active` : "Off"}
                  </div>
                )}
              </div>
              {s.toggle&&(
                <button onClick={(e)=>{e.stopPropagation(); s.fn();}} style={{width:50,height:26,background:s.val?P.dark:P.light,border:`2.5px solid ${P.black}`,boxShadow:`2px 2px 0 ${P.black}`,borderRadius:3,position:"relative",cursor:"pointer",transition:"background .2s"}}>
                  <div style={{position:"absolute",top:3,width:16,height:16,background:s.val?P.red:P.white,border:`2px solid ${P.black}`,borderRadius:2,transition:"left .2s",left:s.val?26:4}}/>
                </button>
              )}
              {s.arrow&&<ChevronRight style={{width:16,height:16,color:P.light}}/>}
            </div>
          ))}
        </div>
      </div>
      {showNotificationSheet && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} onClick={()=>setShowNotificationSheet(false)}
          style={{position:"absolute",inset:0,zIndex:60,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.65)"}}/>
          <motion.div initial={{y:120,opacity:0}} animate={{y:0,opacity:1}}
            transition={{type:"spring",damping:28,stiffness:280}}
            style={{background:P.white,borderTop:`3px solid ${P.black}`,borderLeft:`3px solid ${P.black}`,borderRight:`3px solid ${P.black}`,borderBottom:"none",borderRadius:"6px 6px 0 0",boxShadow:`-4px -4px 0 ${P.dark}`,padding:"20px 18px 32px",position:"relative"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
              <div>
                <div style={{fontFamily:"monospace",fontSize:8,color:P.red,marginBottom:4,letterSpacing:2}}>NOTIFICATIONS</div>
                <div style={{fontFamily:"monospace",fontWeight:900,fontSize:14,color:P.dark,letterSpacing:1}}>SETTINGS</div>
              </div>
              <button onClick={()=>setShowNotificationSheet(false)} style={{width:30,height:30,background:P.cream,border:`2.5px solid ${P.black}`,boxShadow:`2px 2px 0 ${P.dark}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <X style={{width:13,height:13,color:actionIconColor}}/>
              </button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[
                {key:"taskReminders",label:"Task reminders",icon:<Calendar style={{width:18,height:18}}/>},
                {key:"focusSessionEnd",label:"Focus session end",icon:<Timer style={{width:18,height:18}}/>},
                {key:"dailySummary",label:"Daily summary",icon:<Clock style={{width:18,height:18}}/>},
                {key:"streakAlerts",label:"Streak alerts",icon:<Trophy style={{width:18,height:18}}/>},
                {key:"soundEffects",label:"Sound effects",icon:<Volume2 style={{width:18,height:18}}/>},
              ].map(item=>(
                <div key={item.key} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:P.cream,border:`2px solid ${P.dark}`,borderRadius:4}}>
                  <div style={{width:36,height:36,background:notificationSettings[item.key]?P.red:P.light,border:`2px solid ${P.black}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",color:notificationSettings[item.key]?P.white:P.dark}}>
                    {item.icon}
                  </div>
                  <span style={{fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:700,color:P.dark,flex:1}}>{item.label}</span>
                  <button onClick={()=>setNotificationSettings(prev=>({...prev,[item.key]:!prev[item.key]}))} style={{width:50,height:26,background:notificationSettings[item.key]?P.dark:P.light,border:`2.5px solid ${P.black}`,boxShadow:`2px 2px 0 ${P.black}`,borderRadius:3,position:"relative",cursor:"pointer",transition:"background .2s"}}>
                    <div style={{position:"absolute",top:3,width:16,height:16,background:notificationSettings[item.key]?P.red:P.white,border:`2px solid ${P.black}`,borderRadius:2,transition:"left .2s",left:notificationSettings[item.key]?26:4}}/>
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
      {showAppSettingsSheet && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} onClick={()=>setShowAppSettingsSheet(false)}
          style={{position:"absolute",inset:0,zIndex:60,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.65)"}}/>
          <motion.div initial={{y:120,opacity:0}} animate={{y:0,opacity:1}}
            transition={{type:"spring",damping:28,stiffness:280}}
            style={{background:P.white,borderTop:`3px solid ${P.black}`,borderLeft:`3px solid ${P.black}`,borderRight:`3px solid ${P.black}`,borderBottom:"none",borderRadius:"6px 6px 0 0",boxShadow:`-4px -4px 0 ${P.dark}`,padding:"20px 18px 32px",position:"relative",maxHeight:"80vh",overflowY:"auto"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
              <div>
                <div style={{fontFamily:"monospace",fontSize:8,color:P.red,marginBottom:4,letterSpacing:2}}>APP</div>
                <div style={{fontFamily:"monospace",fontWeight:900,fontSize:14,color:P.dark,letterSpacing:1}}>SETTINGS</div>
              </div>
              <button onClick={()=>setShowAppSettingsSheet(false)} style={{width:30,height:30,background:P.cream,border:`2.5px solid ${P.black}`,boxShadow:`2px 2px 0 ${P.dark}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <X style={{width:13,height:13,color:actionIconColor}}/>
              </button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:20}}>
              <div>
                <div style={{fontFamily:"monospace",fontSize:9,color:P.dark,marginBottom:10,letterSpacing:1}}>APPEARANCE</div>
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:P.cream,border:`2px solid ${P.dark}`,borderRadius:4}}>
                  <div style={{width:36,height:36,background:dark?P.dark:P.light,border:`2px solid ${P.black}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",color:dark?P.white:P.dark}}>
                    {dark?<Moon style={{width:18,height:18}}/>:<Sun style={{width:18,height:18}}/>}
                  </div>
                  <span style={{fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:700,color:P.dark,flex:1}}>Dark Mode</span>
                  <button onClick={toggleDark} style={{width:50,height:26,background:dark?P.dark:P.light,border:`2.5px solid ${P.black}`,boxShadow:`2px 2px 0 ${P.black}`,borderRadius:3,position:"relative",cursor:"pointer",transition:"background .2s"}}>
                    <div style={{position:"absolute",top:3,width:16,height:16,background:dark?P.red:P.white,border:`2px solid ${P.black}`,borderRadius:2,transition:"left .2s",left:dark?26:4}}/>
                  </button>
                </div>
              </div>
              <div>
                <div style={{fontFamily:"monospace",fontSize:9,color:P.dark,marginBottom:10,letterSpacing:1}}>FOCUS TIMER</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:P.cream,border:`2px solid ${P.dark}`,borderRadius:4}}>
                    <div style={{width:36,height:36,background:P.red,border:`2px solid ${P.black}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",color:P.white}}>
                      <Timer style={{width:18,height:18}}/>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:700,color:P.dark}}>Focus duration</div>
                      <div style={{fontFamily:"monospace",fontSize:11,color:P.mid,marginTop:2}}>{appSettings.focusDuration} min</div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>setAppSettings(prev=>({...prev,focusDuration:Math.max(1,prev.focusDuration-1)}))} style={{width:32,height:32,background:P.white,border:`2px solid ${P.black}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontWeight:900,fontSize:16,color:actionIconColor}}>{'-'}</button>
                      <button onClick={()=>setAppSettings(prev=>({...prev,focusDuration:Math.min(180,prev.focusDuration+1)}))} style={{width:32,height:32,background:P.white,border:`2px solid ${P.black}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontWeight:900,fontSize:16,color:actionIconColor}}>{'+'}</button>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:P.cream,border:`2px solid ${P.dark}`,borderRadius:4}}>
                    <div style={{width:36,height:36,background:P.mid,border:`2px solid ${P.black}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",color:P.white}}>
                      <Clock style={{width:18,height:18}}/>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:700,color:P.dark}}>Break duration</div>
                      <div style={{fontFamily:"monospace",fontSize:11,color:P.mid,marginTop:2}}>{appSettings.breakDuration} min</div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>setAppSettings(prev=>({...prev,breakDuration:Math.max(1,prev.breakDuration-1)}))} style={{width:32,height:32,background:P.white,border:`2px solid ${P.black}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontWeight:900,fontSize:16,color:actionIconColor}}>{'-'}</button>
                      <button onClick={()=>setAppSettings(prev=>({...prev,breakDuration:Math.min(60,prev.breakDuration+1)}))} style={{width:32,height:32,background:P.white,border:`2px solid ${P.black}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontWeight:900,fontSize:16,color:actionIconColor}}>{'+'}</button>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:P.cream,border:`2px solid ${P.dark}`,borderRadius:4}}>
                    <div style={{width:36,height:36,background:P.dark,border:`2px solid ${P.black}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",color:P.white}}>
                      <Play style={{width:18,height:18}}/>
                    </div>
                    <span style={{fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:700,color:P.dark,flex:1}}>Auto-start break</span>
                    <button onClick={()=>setAppSettings(prev=>({...prev,autoStartBreak:!prev.autoStartBreak}))} style={{width:50,height:26,background:appSettings.autoStartBreak?P.dark:P.light,border:`2.5px solid ${P.black}`,boxShadow:`2px 2px 0 ${P.black}`,borderRadius:3,position:"relative",cursor:"pointer",transition:"background .2s"}}>
                      <div style={{position:"absolute",top:3,width:16,height:16,background:appSettings.autoStartBreak?P.red:P.white,border:`2px solid ${P.black}`,borderRadius:2,transition:"left .2s",left:appSettings.autoStartBreak?26:4}}/>
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <div style={{fontFamily:"monospace",fontSize:9,color:P.dark,marginBottom:10,letterSpacing:1}}>TASKS</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:P.cream,border:`2px solid ${P.dark}`,borderRadius:4}}>
                    <div style={{width:36,height:36,background:"#207820",border:`2px solid ${P.black}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",color:P.white}}>
                      <CheckCircle2 style={{width:18,height:18}}/>
                    </div>
                    <span style={{fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:700,color:P.dark,flex:1}}>Show completed tasks</span>
                    <button onClick={()=>setAppSettings(prev=>({...prev,showCompletedTasks:!prev.showCompletedTasks}))} style={{width:50,height:26,background:appSettings.showCompletedTasks?P.dark:P.light,border:`2.5px solid ${P.black}`,boxShadow:`2px 2px 0 ${P.black}`,borderRadius:3,position:"relative",cursor:"pointer",transition:"background .2s"}}>
                      <div style={{position:"absolute",top:3,width:16,height:16,background:appSettings.showCompletedTasks?P.red:P.white,border:`2px solid ${P.black}`,borderRadius:2,transition:"left .2s",left:appSettings.showCompletedTasks?26:4}}/>
                    </button>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:P.cream,border:`2px solid ${P.dark}`,borderRadius:4}}>
                    <div style={{width:36,height:36,background:P.red,border:`2px solid ${P.black}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",color:P.white}}>
                      <Trophy style={{width:18,height:18}}/>
                    </div>
                    <span style={{fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:700,color:P.dark,flex:1}}>Confetti on complete</span>
                    <button onClick={()=>setAppSettings(prev=>({...prev,confettiOnComplete:!prev.confettiOnComplete}))} style={{width:50,height:26,background:appSettings.confettiOnComplete?P.dark:P.light,border:`2.5px solid ${P.black}`,boxShadow:`2px 2px 0 ${P.black}`,borderRadius:3,position:"relative",cursor:"pointer",transition:"background .2s"}}>
                      <div style={{position:"absolute",top:3,width:16,height:16,background:appSettings.confettiOnComplete?P.red:P.white,border:`2px solid ${P.black}`,borderRadius:2,transition:"left .2s",left:appSettings.confettiOnComplete?26:4}}/>
                    </button>
                  </div>
                </div>
              </div>
              <button onClick={()=>setShowAppSettingsSheet(false)} className="px-btn"
                style={{width:"100%",padding:"14px 0",fontSize:14,fontWeight:900,fontFamily:"monospace",background:P.red,color:P.white,borderColor:P.black,letterSpacing:1,marginTop:10}}>
                SAVE
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      {showAchievementsSheet && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} onClick={()=>setShowAchievementsSheet(false)}
          style={{position:"absolute",inset:0,zIndex:60,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.65)"}}/>
          <motion.div initial={{y:120,opacity:0}} animate={{y:0,opacity:1}}
            transition={{type:"spring",damping:28,stiffness:280}}
            style={{background:P.white,borderTop:`3px solid ${P.black}`,borderLeft:`3px solid ${P.black}`,borderRight:`3px solid ${P.black}`,borderBottom:"none",borderRadius:"6px 6px 0 0",boxShadow:`-4px -4px 0 ${P.dark}`,padding:"20px 18px 32px",position:"relative",maxHeight:"80vh",overflowY:"auto"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
              <div>
                <div style={{fontFamily:"monospace",fontSize:8,color:P.red,marginBottom:4,letterSpacing:2}}>YOUR</div>
                <div style={{fontFamily:"monospace",fontWeight:900,fontSize:14,color:P.dark,letterSpacing:1}}>ACHIEVEMENTS</div>
              </div>
              <button onClick={()=>setShowAchievementsSheet(false)} style={{width:30,height:30,background:P.cream,border:`2.5px solid ${P.black}`,boxShadow:`2px 2px 0 ${P.dark}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <X style={{width:13,height:13,color:actionIconColor}}/>
              </button>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",paddingTop:32,gap:16}}>
              <PettableMascot src={catPng} size={110}/>
              {stats.unlockedAchievements.length===0 ? (
                <div className="px-card" style={{textAlign:"center",padding:"18px 24px"}}>
                  <div style={{fontFamily:"monospace",fontSize:10,color:P.dark,marginBottom:8,letterSpacing:1}}>NO ACHIEVEMENTS YET</div>
                  <div style={{fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:600,color:P.mid}}>Complete tasks to earn badges</div>
                </div>
              ) : (
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,width:"100%"}}>
                  {stats.achievements.map((badge)=>(
                    <div key={badge.key} style={{background:badge.unlocked ? badge.bg : "#F3F3F3",border:`2.5px solid ${badge.unlocked ? badge.bc : P.light}`,boxShadow:`3px 3px 0 ${badge.unlocked ? badge.bc : P.light}`,borderRadius:4,padding:"14px 12px",opacity:badge.unlocked ? 1 : 0.55}}>
                      <div style={{fontSize:24,marginBottom:8}}>{badge.e}</div>
                      <div style={{fontFamily:"monospace",fontWeight:900,fontSize:11,color:badge.unlocked ? badge.bc : P.mid,letterSpacing:.5}}>{badge.l}</div>
                      <div style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:600,color:P.mid,marginTop:4}}>{badge.d}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      {showWeeklyReportsSheet && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} onClick={()=>setShowWeeklyReportsSheet(false)}
          style={{position:"absolute",inset:0,zIndex:60,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.65)"}}/>
          <motion.div initial={{y:120,opacity:0}} animate={{y:0,opacity:1}}
            transition={{type:"spring",damping:28,stiffness:280}}
            style={{background:P.white,borderTop:`3px solid ${P.black}`,borderLeft:`3px solid ${P.black}`,borderRight:`3px solid ${P.black}`,borderBottom:"none",borderRadius:"6px 6px 0 0",boxShadow:`-4px -4px 0 ${P.dark}`,padding:"20px 18px 32px",position:"relative",maxHeight:"80vh",overflowY:"auto"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
              <div>
                <div style={{fontFamily:"monospace",fontSize:8,color:P.red,marginBottom:4,letterSpacing:2}}>WEEKLY</div>
                <div style={{fontFamily:"monospace",fontWeight:900,fontSize:14,color:P.dark,letterSpacing:1}}>REPORTS</div>
              </div>
              <button onClick={()=>setShowWeeklyReportsSheet(false)} style={{width:30,height:30,background:P.cream,border:`2.5px solid ${P.black}`,boxShadow:`2px 2px 0 ${P.dark}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <X style={{width:13,height:13,color:actionIconColor}}/>
              </button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div className="px-card" style={{padding:16}}>
                <div style={{fontFamily:"monospace",fontSize:9,color:P.dark,marginBottom:12,letterSpacing:1}}>THIS WEEK</div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:"monospace",fontWeight:900,fontSize:24,color:P.red}}>{stats.weeklyDone}</div>
                    <div style={{fontFamily:"monospace",fontSize:8,color:P.mid,marginTop:4,letterSpacing:.5}}>TASKS DONE</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:"monospace",fontWeight:900,fontSize:24,color:"#207820"}}>{(stats.todayMinutes/60).toFixed(stats.todayMinutes >= 60 ? 1 : 0)}</div>
                    <div style={{fontFamily:"monospace",fontSize:8,color:P.mid,marginTop:4,letterSpacing:.5}}>FOCUS HRS</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:"monospace",fontWeight:900,fontSize:24,color:P.dark}}>{stats.currentStreak}</div>
                    <div style={{fontFamily:"monospace",fontSize:8,color:P.mid,marginTop:4,letterSpacing:.5}}>STREAK</div>
                  </div>
                </div>
              </div>
              <div className="px-card" style={{padding:16}}>
                <div style={{fontFamily:"monospace",fontSize:9,color:P.dark,marginBottom:12,letterSpacing:1}}>DAILY BREAKDOWN</div>
                <div style={{display:"flex",alignItems:"flex-end",gap:8,height:100}}>
                  {stats.weekData.map((d,i)=>(
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                      <div style={{width:"100%",background:P.red,height:`${Math.max(8, d.v * 18)}px`,borderRadius:2,border:`2px solid ${P.black}`,minHeight:8}}/>
                      <div style={{fontFamily:"monospace",fontSize:8,color:P.mid}}>{d.day.slice(0,1)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-card" style={{padding:16}}>
                <div style={{fontFamily:"monospace",fontSize:9,color:P.dark,marginBottom:12,letterSpacing:1}}>CATEGORY BREAKDOWN</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {stats.categoryBreakdown.map((c,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:60,fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:600,color:P.dark}}>{c.label}</div>
                      <div style={{flex:1,height:12,background:P.cream,borderRadius:2,overflow:"hidden"}}>
                        <div style={{width:`${c.value}%`,height:"100%",background:c.color}}/>
                      </div>
                      <div style={{fontFamily:"monospace",fontSize:10,color:P.mid,width:30,textAlign:"right"}}>{c.value}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

// ─── Add Task Modal ────────────────────────────────────────────────────────────
function AddModal({close,add,editTask,editingTask}) {
  const [title,setTitle]=useState(editingTask?.title||"");
  const [cat,setCat]=useState(editingTask?.category||"work");
  const [prio,setPrio]=useState(editingTask?.priority||"medium");
  const today = getRelativeDate(0);
  const [date,setDate]=useState(editingTask?.dueDate||today);
  const [time,setTime]=useState(editingTask?.time||"");
  const [pop,setPop]=useState(false);
  const actionIconColor = getAdaptiveIconColor();
  
  // Reset form when editing task changes
  useEffect(()=>{
    if(editingTask){
      setTitle(editingTask.title);
      setCat(editingTask.category);
      setPrio(editingTask.priority);
      setDate(normalizeDueDate(editingTask.dueDate));
      setTime(editingTask.time||"");
    }else{
      setTitle("");
      setCat("work");
      setPrio("medium");
      setDate(today);
      setTime("");
    }
  },[editingTask,today]);
  
  const handle=()=>{
    if(!title.trim())return;
    setPop(true);
    const payload = normalizeTask({
      ...editingTask,
      title,
      category:cat,
      priority:prio,
      dueDate:date,
      time,
      estimatedTime: editingTask?.estimatedTime ?? 30,
      completed: editingTask?.completed ?? false,
    });
    if(editingTask){
      editTask(editingTask.id,payload);
    }else{
      add(payload);
    }
    setTimeout(()=>{close();},900);
  };
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}}
      style={{position:"absolute",inset:0,zIndex:50,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}
      onClick={close}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.65)"}}/>
      <motion.div initial={{y:120,opacity:0}} animate={{y:0,opacity:1}}
        transition={{type:"spring",damping:28,stiffness:280}}
        style={{background:P.white,borderTop:`3px solid ${P.black}`,borderLeft:`3px solid ${P.black}`,borderRight:`3px solid ${P.black}`,borderBottom:"none",borderRadius:"6px 6px 0 0",boxShadow:`-4px -4px 0 ${P.dark}`,padding:"20px 18px 32px",position:"relative"}}
        onClick={e=>e.stopPropagation()}>
        {pop&&<Confetti/>}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <div>
            <div style={{fontFamily:"monospace",fontSize:8,color:P.red,marginBottom:4,letterSpacing:2}}>{editingTask?"EDIT QUEST":"NEW QUEST"}</div>
            <div style={{fontFamily:"monospace",fontWeight:900,fontSize:14,color:P.dark,letterSpacing:1}}>{editingTask?"EDIT TASK":"ADD TASK"}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <PettableMascot src={bunnyPng} size={52}/>
            <button onClick={close} style={{width:30,height:30,background:P.cream,border:`2.5px solid ${P.black}`,boxShadow:`2px 2px 0 ${P.dark}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
              <X style={{width:13,height:13,color:actionIconColor}}/>
            </button>
          </div>
        </div>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Task name..."
          className="px-input" style={{width:"100%",padding:"11px 14px",fontSize:14,fontWeight:600,fontFamily:"'Inter',sans-serif",boxSizing:"border-box",marginBottom:16}} autoFocus/>
        <div style={{fontFamily:"monospace",fontSize:8,color:P.dark,marginBottom:8,letterSpacing:1}}>CATEGORY</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
          {["work","personal","health","learning"].map(c=>{
            const cc=CAT_META[c];
            return (
              <button key={c} onClick={()=>setCat(c)} className="px-btn"
                style={{padding:"6px 12px",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif",cursor:"pointer",
                  background:cat===c?cc.bg:P.white,color:cc.text,
                  borderColor:cc.border,boxShadow:cat===c?`3px 3px 0 ${cc.border}`:`2px 2px 0 ${cc.border}`}}>
                {cc.emoji} {cc.label}
              </button>
            );
          })}
        </div>
        <div style={{fontFamily:"monospace",fontSize:8,color:P.dark,marginBottom:8,letterSpacing:1}}>PRIORITY</div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {["high","medium","low"].map(p=>(
            <button key={p} onClick={()=>setPrio(p)} className="px-btn"
              style={{flex:1,padding:"9px 0",fontSize:11,fontWeight:700,fontFamily:"monospace",letterSpacing:.5,cursor:"pointer",
                background:prio===p?PRIO_COLOR[p]:P.white,color:prio===p?P.white:PRIO_COLOR[p],
                borderColor:PRIO_COLOR[p],boxShadow:prio===p?`3px 3px 0 ${P.black}`:`2px 2px 0 ${PRIO_COLOR[p]}`}}>
              {p==="high"?"HIGH":p==="medium"?"MED":"LOW"}
            </button>
          ))}
        </div>
        <div style={{fontFamily:"monospace",fontSize:8,color:P.dark,marginBottom:8,letterSpacing:1}}>DUE DATE</div>
        <input 
          type="date" 
          value={date} 
          onChange={e=>setDate(e.target.value)} 
          className="px-input" 
          style={{width:"100%",padding:"11px 14px",fontSize:14,fontWeight:600,fontFamily:"'Inter',sans-serif",boxSizing:"border-box",marginBottom:16}}
        />
        <div style={{fontFamily:"monospace",fontSize:8,color:P.dark,marginBottom:8,letterSpacing:1}}>TIME</div>
        <input 
          type="time" 
          value={time} 
          onChange={e=>setTime(e.target.value)} 
          className="px-input" 
          style={{width:"100%",padding:"11px 14px",fontSize:14,fontWeight:600,fontFamily:"'Inter',sans-serif",boxSizing:"border-box",marginBottom:24}}
        />
        <div style={{display:"flex",gap:10}}>
          <button onClick={close} className="px-btn"
            style={{flex:1,padding:"13px 0",fontSize:12,fontWeight:700,fontFamily:"monospace",background:P.cream,borderColor:P.mid,boxShadow:`3px 3px 0 ${P.mid}`,color:P.mid,letterSpacing:1}}>
            CANCEL
          </button>
          <button onClick={handle} disabled={!title.trim()} className="px-btn"
            style={{flex:1,padding:"13px 0",fontSize:12,fontWeight:700,fontFamily:"monospace",letterSpacing:1,
              background:title.trim()?P.red:"#E5E5E0",borderColor:title.trim()?P.black:"#CCCCCC",
              boxShadow:title.trim()?`3px 3px 0 ${P.black}`:"none",
              color:title.trim()?P.white:P.light,cursor:title.trim()?"pointer":"not-allowed"}}>
            SAVE ▶
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Bottom Nav ────────────────────────────────────────────────────────────────
function Nav({active,go,add,iconColor}) {
  const ITEMS=[
    {k:"home",     icon:<Home style={{width:20,height:20}}/>,      l:"Home",   col:P.dark},
    {k:"tasks",    icon:<CheckSquare style={{width:20,height:20}}/>,l:"Tasks",  col:P.red},
    {k:"analytics",icon:<BarChart2 style={{width:20,height:20}}/>,   l:"Stats",  col:P.mid},
    {k:"profile",  icon:<UserCircle style={{width:20,height:20}}/>,  l:"Profile",col:P.dark},
  ];
  return (
    <div className="bottom-nav-mobile" style={{position:"absolute",bottom:10,left:10,right:10,zIndex:40}}>
      <div className="bottom-nav-inner" style={{background:P.white,border:`2.5px solid ${P.black}`,boxShadow:`4px 4px 0 ${P.black}`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"space-around",padding:"10px 8px"}}>
        {ITEMS.slice(0,2).map(({k,icon,l,col})=>(
          <button key={k} onClick={()=>go(k)}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"8px 16px",
              background:active===k?col:"transparent",border:active===k?`2px solid ${col}`:"2px solid transparent",
              borderRadius:20,boxShadow:active===k?`2px 2px 0 ${col}`:"none",cursor:"pointer",transition:"all .2s"}}>
            <div style={{color:active===k?col:P.dark}}>{icon}</div>
            <span style={{fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:600,color:active===k?col:P.dark}}>{l}</span>
          </button>
        ))}
        <button onClick={add}
          style={{width:56,height:56,background:P.red,border:`3px solid ${P.black}`,boxShadow:`4px 4px 0 ${P.black}`,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",marginTop:-20,cursor:"pointer"}}>
          <Plus style={{width:28,height:28,color:iconColor}}/>
        </button>
        {ITEMS.slice(2).map(({k,icon,l,col})=>(
          <button key={k} onClick={()=>go(k)}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"8px 16px",
              background:active===k?col:"transparent",border:active===k?`2px solid ${col}`:"2px solid transparent",
              borderRadius:20,boxShadow:active===k?`2px 2px 0 ${col}`:"none",cursor:"pointer",transition:"all .2s"}}>
            <div style={{color:active===k?col:P.dark}}>{icon}</div>
            <span style={{fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:600,color:active===k?col:P.dark}}>{l}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,setScreen]=useState("splash");
  const [hasOnboarded,setHasOnboarded]=useState(false);
  const [tasks,setTasks]=useState([]);
  const [modal,setModal]=useState(false);
  const [editingTask,setEditingTask]=useState(null);
  const [dark,setDark]=useState(false);
  const [appSettings,setAppSettings]=useState(DEFAULT_APP_SETTINGS);
  const [completionHistory,setCompletionHistory]=useState([]);
  const [userName, setUserName] = useState("Alex Johnson");
  const [storageReady,setStorageReady]=useState(false);
  const [activeBanner, setActiveBanner] = useState(null);
  const notifiedStreaks = useRef(new Set());

  useEffect(() => {
    if (activeBanner) {
      const timer = setTimeout(() => setActiveBanner(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [activeBanner]);

  useEffect(()=>{
    let active = true;

    // Listen for local notifications while app is in foreground
    const notificationListener = LocalNotifications.addListener('localNotificationReceived', (notification) => {
      // We could trigger the banner here for any background-scheduled notifications
      // that fire while the app is open.
    });

    const hydrateStorage = async () => {
      const [savedTasks, savedDark, savedAppSettings, savedCompletionHistory, savedOnboarding, savedUserName] = await Promise.all([
        loadStoredTasks(),
        loadStoredDarkMode(),
        loadStoredAppSettings(),
        readStoredJson(STORAGE_KEYS.completionHistory, []),
        readStoredJson(STORAGE_KEYS.onboarded, false),
        readStoredValue(STORAGE_KEYS.username),
      ]);

      if (!active) return;

      // Initialize storage defaults if this is first launch
      if (savedTasks === null || savedOnboarding === null) {
        // Storage defaults will be handled by the fallback logic in readStoredJson
      }

      // Load saved data - use empty arrays as fallbacks to respect actual stored state
      setTasks(savedTasks || []);
      setDark(savedDark);
      setAppSettings(savedAppSettings);
      setCompletionHistory(savedCompletionHistory || []);
      setUserName(savedUserName || "Alex Johnson");
      setHasOnboarded(savedOnboarding);
      setStorageReady(true);

      // Force save data immediately after loading to ensure persistence
      if (savedTasks && savedTasks.length > 0) {
        void writeStoredJson(STORAGE_KEYS.tasks, savedTasks);
      }

      // Skip splash and onboarding if already onboarded
      if (savedOnboarding) {
        setScreen("home");
      }
      
      // Request notification permissions and create channel
      const permissions = await LocalNotifications.requestPermissions();

      // Create notification channel for Android
      try {
        await LocalNotifications.createChannel({
          id: "dayflow-tasks",
          name: "Task Reminders",
          description: "Notifications for task due dates",
          importance: 5,
          sound: "default",
          vibration: true,
          lights: true,
          visibility: 1, // PUBLIC visibility to show on lock screen
        });
      } catch (error) {
      }
      
    };

    void hydrateStorage();
    return () => {
      active = false;
    };
  },[]);

  useEffect(()=>{
    if (!storageReady) return;
    void writeStoredValue(STORAGE_KEYS.username, userName);
  },[userName,storageReady]);

  useEffect(()=>{
    if (!storageReady) return;
    const tasksToSave = tasks.map(({overdue,...task})=>task);
    void writeStoredJson(STORAGE_KEYS.tasks, tasksToSave);
  },[tasks,storageReady]);

  useEffect(()=>{
    if (!storageReady) return;
    void writeStoredJson(STORAGE_KEYS.dark, dark);
  },[dark,storageReady]);

  useEffect(()=>{
    if (!storageReady) return;
    void writeStoredJson(STORAGE_KEYS.appSettings, appSettings);
  },[appSettings,storageReady]);

  const toggle=async (id)=>{
    const task = tasks.find(t => t.id === id);
    const wasCompleted = task?.completed;
    
    setTasks(p=>p.map(t=>{
      if(t.id!==id) return normalizeTask(t);
      const completed = !t.completed;
      return normalizeTask({
        ...t,
        completed,
        completedAt: completed ? new Date().toISOString() : null,
      });
    }));

    // Trigger system notification and in-app banner when task is completed
    if (task && !wasCompleted) {
      setActiveBanner({
        type: 'completed',
        message: `${task.title} — done!`,
      });
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Date.now() % 1000000),
              title: "DayFlow • Task Completed",
              body: `${task.title} — done!`,
              schedule: { at: new Date(), allowWhileIdle: true },
              channelId: "dayflow-tasks",
              smallIcon: "ic_stat_icon_config_sample",
              largeIcon: "res://ic_launcher",
              sound: "default",
              ongoing: false,
              autoCancel: true,
            },
          ],
        });
      } catch (error) {
      }
    }
  };

  const scheduleTaskNotification = async (task) => {
    try {
      const dueDate = normalizeDueDate(task.dueDate);
      const due = new Date(`${dueDate}T${task.time || "09:00"}:00`);
      
      // Calculate 5 minutes before due time
      let scheduleTime = new Date(due.getTime() - 5 * 60 * 1000);

      // If 5 mins before is already past, try scheduling for the actual due time
      if (scheduleTime < new Date()) {
        scheduleTime = due;
      }

      // If even the due time is past, don't schedule system notification
      if (scheduleTime < new Date()) {
        console.log("Notification time is in the past, skipping system schedule");
        return;
      }

      const notificationId = Math.floor(Math.abs(parseInt(task.id.replace(/\D/g, '')) || Date.now()) % 1000000);
      
      // Cancel any existing notification for this task
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
      

      if (getDueDateLabel(task.dueDate) === "Today" && (scheduleTime.getTime() - Date.now()) < 10000) {
        setActiveBanner({
          type: 'due',
          message: task.title,
        });
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: "Task Due Soon",
            body: `"${task.title}" starts in 5 minutes!`,
            schedule: { at: scheduleTime, allowWhileIdle: true },
            channelId: "dayflow-tasks",
            smallIcon: "ic_stat_icon_config_sample",
            sound: "default",
            largeIcon: "ic_launcher",
            ongoing: false,
            autoCancel: true,
          },
        ],
      });
    } catch (error) {
    }
  };

  // Check for overdue tasks and show notifications
  const checkOverdueTasks = async () => {
    const overdueTasks = tasks.filter(t => isTaskOverdue(t) && !t.completed);
    if (overdueTasks.length > 0) {
      const firstOverdue = overdueTasks[0];
      setActiveBanner({
        type: 'overdue',
        message: firstOverdue.title,
      });
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Date.now() % 1000000),
              title: "DayFlow • Task Overdue",
              body: `${firstOverdue.title} - Task is overdue`,
              schedule: { at: new Date(), allowWhileIdle: true },
              channelId: "dayflow-tasks",
              smallIcon: "ic_stat_icon_config_sample",
              largeIcon: "res://ic_launcher",
              sound: "default",
              ongoing: false,
              autoCancel: true,
            },
          ],
        });
      } catch (error) {
      }
    }
  };

  // Check for upcoming tasks (due tomorrow)
  const checkUpcomingTasks = async () => {
    const tomorrowKey = getRelativeDate(1);
    const upcomingTasks = tasks.filter(t => normalizeDueDate(t.dueDate) === tomorrowKey && !t.completed);
    if (upcomingTasks.length > 0) {
      const firstUpcoming = upcomingTasks[0];
      const timeStr = firstUpcoming.time ? ` — ${firstUpcoming.time}` : "";
      setActiveBanner({
        type: 'upcoming',
        message: `${firstUpcoming.title}${timeStr}`,
      });
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Date.now() % 1000000),
              title: "DayFlow • Coming Up Tomorrow",
              body: `${firstUpcoming.title}${timeStr}`,
              schedule: { at: new Date(), allowWhileIdle: true },
              channelId: "dayflow-tasks",
              smallIcon: "ic_stat_icon_config_sample",
              largeIcon: "res://ic_launcher",
              sound: "default",
              ongoing: false,
              autoCancel: true,
            },
          ],
        });
      } catch (error) {
      }
    }
  };

  // Check for overdue tasks periodically
  useEffect(()=>{
    if (!storageReady) return;
    const interval = setInterval(() => {
      void checkOverdueTasks();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  },[tasks,storageReady]);

  // Check for upcoming tasks when storage is ready or tasks change
  useEffect(()=>{
    if (!storageReady) return;
    void checkUpcomingTasks();
  },[tasks,storageReady]);

  // Save completion history separately to persist stats when tasks are deleted
  useEffect(()=>{
    if (!storageReady) return;

    const syncHistory = async () => {
      // Build completion history from current completed tasks (store by date and timestamp)
      const currentCompletions = tasks
        .filter(t => t.completed && t.completedAt)
        .map(t => ({
          date: getDayKeyFromTimestamp(t.completedAt) || normalizeDueDate(t.dueDate),
          category: t.category,
          estimatedTime: t.estimatedTime || 30,
          timestamp: t.completedAt
        }));

      // Merge with existing completion history (use composite key to avoid duplicates)
      const historyMap = new Map();

      // Add existing history
      completionHistory.forEach(item => {
        const key = `${item.date}_${item.timestamp}`;
        historyMap.set(key, item);
      });

      // Add current completions
      currentCompletions.forEach(current => {
        const key = `${current.date}_${current.timestamp}`;
        historyMap.set(key, current);
      });

      // Convert back to array
      const mergedHistory = Array.from(historyMap.values());

      await writeStoredJson(STORAGE_KEYS.completionHistory, mergedHistory);
      setCompletionHistory(mergedHistory);

      // Check for streak milestones
      const stats = buildTaskStats(tasks, mergedHistory);
      const streakMilestones = [3, 7, 10, 14, 30];
      if (streakMilestones.includes(stats.currentStreak) && stats.currentStreak > 0 && !notifiedStreaks.current.has(stats.currentStreak)) {
        notifiedStreaks.current.add(stats.currentStreak);
        setActiveBanner({
          type: 'streak',
          label: `${stats.currentStreak}-Day Streak!`,
          message: "You're on a roll, keep it up",
        });
        try {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: Math.floor(Date.now() % 1000000),
                title: `DayFlow • ${stats.currentStreak}-Day Streak!`,
                body: "You're on a roll, keep it up",
                schedule: { at: new Date(), allowWhileIdle: true },
                channelId: "dayflow-tasks",
                smallIcon: "ic_stat_icon_config_sample",
                largeIcon: "res://ic_launcher",
                sound: "default",
                ongoing: false,
                autoCancel: true,
              },
            ],
          });
          } catch (error) {
        }
      }
    };

    void syncHistory();
  },[tasks,storageReady]);
  const addTask=(task)=>{
    const newTask = normalizeTask({...task,id:task.id??`task-${Date.now()}`});
    setTasks(p=>[newTask,...p]);
    // Schedule notification for the new task
    void scheduleTaskNotification(newTask);
  };
  const editTask=(id,updates)=>{
    const updatedTask = normalizeTask({...updates,id});
    setTasks(p=>p.map(t=>t.id===id?updatedTask:normalizeTask(t)));
    // Reschedule notification for the updated task
    void scheduleTaskNotification(updatedTask);
  };
  const deleteTask=(id)=>{
    setTasks(p=>p.filter(t=>t.id!==id));
    // Cancel notification for the deleted task
    const notificationId = parseInt(id.replace(/\D/g, '')) || Date.now();
    void LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
  };
  const isApp=!["splash","onboarding"].includes(screen);
  const stats = buildTaskStats(tasks, completionHistory);

  // Apply dark/light palette to the shared P object so all inline styles pick it up
  const palette = dark ? DARK : LIGHT;
  Object.assign(P, palette);
  const actionIconColor = dark ? "#FFFFFF" : "#000000";
  return (
    <div className="app-fullscreen-wrapper" style={{width:"100vw",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      backgroundColor:dark?"#0F1020":P.cream,
      backgroundImage:`linear-gradient(rgba(${dark?"100,110,255":"43,43,43"},.05) 1px,transparent 1px),linear-gradient(90deg,rgba(${dark?"100,110,255":"43,43,43"},.05) 1px,transparent 1px)`,
      backgroundSize:"16px 16px",transition:"background-color .3s"}}>
      <G dark={dark}/>
      <NotificationBanner data={activeBanner} onDismiss={() => setActiveBanner(null)} />
      <div className="app-fullscreen" style={{position:"relative",width:"100%",height:"100%",
        background:P.cream,
        display:"flex",flexDirection:"column",overflow:"hidden",
        transition:"background .3s,border-color .3s"}}>
        <div style={{flex:1,display:"flex",flexDirection:"column",position:"relative",overflow:"hidden",minHeight:0}}>
          {screen==="splash"     &&<Splash done={()=>setScreen(hasOnboarded?"home":"onboarding")}/>}
          {screen==="onboarding" &&<Onboarding done={()=>{writeStoredJson(STORAGE_KEYS.onboarded,true);setScreen("home");}}/>}
          {isApp&&(
            <>
              {screen==="home"      &&<HomeScreen tasks={tasks} stats={stats} onToggle={toggle} onFocus={()=>setScreen("focus")} showNotificationDot={stats.unlockedAchievements.length > 0} userName={userName}/>}
              {screen==="tasks"     &&<TasksScreen tasks={tasks} onToggle={toggle} onAdd={()=>{setEditingTask(null);setModal(true)}} onDelete={deleteTask} onEdit={(task)=>{setEditingTask(task);setModal(true)}}/>}
              {screen==="analytics" &&<AnalyticsScreen stats={stats}/>}
              {screen==="focus"     &&<FocusScreen appSettings={appSettings}/>}
              {screen==="profile"   &&<ProfileScreen dark={dark} toggleDark={()=>setDark(d=>!d)} stats={stats} appSettings={appSettings} setAppSettings={setAppSettings} userName={userName} setUserName={setUserName}/>}
              <Nav active={screen} go={setScreen} add={()=>{setEditingTask(null);setModal(true)}} iconColor={actionIconColor}/>
              {modal&&<AddModal close={()=>{setModal(false);setEditingTask(null)}} add={addTask} editTask={editTask} editingTask={editingTask}/>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
