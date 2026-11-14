'use client';
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const saved = localStorage.getItem('trend-theme');
    const resolved = saved === 'light' || saved === 'dark' ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setTheme(resolved); document.documentElement.dataset.theme = resolved;
  }, []);
  const toggle = () => { const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); document.documentElement.dataset.theme = next; localStorage.setItem('trend-theme', next); };
  return <button className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggle}>{theme === 'dark' ? '☼' : '☾'} <span>{theme === 'dark' ? 'Light' : 'Dark'} mode</span>
  </button>;
}
