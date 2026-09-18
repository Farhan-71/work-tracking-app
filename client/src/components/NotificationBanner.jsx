import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Flame, Bell, Calendar, Siren, X } from "lucide-react";

const STYLES = {
  completed: {
    accent: "#3A86FF",
    label: "Task Completed",
    icon: <Check className="text-white w-5 h-5" />,
    badge: "DONE!",
    dot: "#3A86FF",
    categoryColor: "#3A86FF"
  },
  streak: {
    accent: "#FB5607",
    label: "3-Day Streak!",
    icon: <Flame className="text-white w-5 h-5" fill="#FB5607" />,
    badge: "STREAK",
    dot: "#FB5607",
    categoryColor: "#FB5607"
  },
  due: {
    accent: "#FFBE0B",
    label: "Due Today",
    icon: <Bell className="text-white w-5 h-5" />,
    badge: "DUE NOW",
    dot: "#FFBE0B",
    categoryColor: "#FFBE0B"
  },
  overdue: {
    accent: "#FF006E",
    label: "Task Overdue",
    icon: <Siren className="text-white w-5 h-5" />,
    badge: "OVERDUE",
    dot: "#FF006E",
    categoryColor: "#FF006E"
  },
  upcoming: {
    accent: "#38B000",
    label: "Coming Up Tomorrow",
    icon: <Calendar className="text-white w-5 h-5" />,
    badge: "UPCOMING",
    dot: "#38B000",
    categoryColor: "#38B000"
  }
};

export function NotificationBanner({ data, onDismiss }) {
  if (!data) return null;

  const style = STYLES[data.type] || STYLES.completed;
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        onClick={onDismiss}
        className="fixed top-4 left-4 right-4 z-[100] cursor-pointer"
        style={{
          background: "#111111",
          borderRadius: "16px",
          borderLeft: `5px solid ${style.accent}`,
          boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          userSelect: "none"
        }}
      >
        {/* Icon Box */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: "56px",
            height: "56px",
            background: "rgba(255,255,255,0.05)",
            border: `1.5px solid ${style.accent}`,
            borderRadius: "10px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "2px",
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)"
          }}>
            {style.icon}
            <span style={{
              fontSize: "8px",
              fontWeight: "900",
              color: style.accent,
              fontFamily: "monospace",
              letterSpacing: "0.5px"
            }}>{style.badge}</span>
          </div>
          {/* Blue corner dot from design */}
          <div style={{
            position: "absolute",
            top: "-2px",
            right: "-2px",
            width: "8px",
            height: "8px",
            background: style.dot,
            borderRadius: "50%",
            boxShadow: `0 0 8px ${style.dot}`
          }} />
        </div>

        {/* Text Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#666666" }}>DayFlow</span>
            <span style={{ color: "#444444" }}>•</span>
            <span style={{ fontSize: "12px", fontWeight: "700", color: style.categoryColor }}>{data.label || style.label}</span>
            {data.type === 'completed' && <span>🎉</span>}
            {data.type === 'streak' && <span>🔥</span>}
          </div>
          <p style={{
            fontSize: "15px",
            fontWeight: "500",
            color: "#FFFFFF",
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}>
            {data.message}
          </p>
        </div>

        {/* Right side Info */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "#666666", marginBottom: "4px" }}>
            {timeStr}
          </div>
          <div style={{
            fontSize: "9px",
            fontWeight: "500",
            color: "#333333",
            fontFamily: "monospace"
          }}>
            tap to dismiss
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
