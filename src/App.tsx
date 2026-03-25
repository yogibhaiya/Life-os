/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Send, CheckCircle2, Circle, Clock, AlertCircle, Heart, Briefcase, IndianRupee, LayoutDashboard, Settings, Search, X, Radio, Languages, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

import { MemoryItem, Category } from './types';
import { getMemories, saveMemory, updateMemory, deleteMemory } from './lib/storage';
import { parseInput } from './lib/nlp';
import { useSpeech } from './hooks/useSpeech';
import { analyzePatterns } from './lib/patterns';
import { cn } from './lib/utils';

export default function App() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'home' | 'search'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [language, setLanguage] = useState<'bn-IN' | 'en-IN'>('bn-IN');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(() => {
    const data = getMemories();
    setMemories(data);
    setSuggestions(analyzePatterns(data));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Request Notification Permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            setNotificationsEnabled(true);
          }
        });
      }
    }
  }, []);

  // Notification Checker Interval
  useEffect(() => {
    if (!notificationsEnabled) return;

    const interval = setInterval(() => {
      const currentMemories = getMemories();
      const now = Date.now();
      let updated = false;

      currentMemories.forEach(m => {
        // Only trigger for Tasks that are incomplete, have a specific due date, and haven't been notified yet
        if (m.intent === 'Task' && !m.completed && m.dueDate && !m.notified) {
          if (now >= m.dueDate) {
            // Trigger local notification
            new Notification('Life OS Reminder', {
              body: m.text,
              icon: '/favicon.ico',
              requireInteraction: true
            });
            
            // Mark as notified so it doesn't trigger again
            updateMemory(m.id, { notified: true });
            updated = true;
          }
        }
      });

      if (updated) {
        loadData();
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [notificationsEnabled, loadData]);

  const handleAutoSave = useCallback((text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    const currentMemories = getMemories();
    const nowTime = Date.now();

    // 1. Exact Duplicate Check (Anytime)
    const isExactDuplicate = currentMemories.some(
      m => m.text.toLowerCase().trim() === trimmedText.toLowerCase()
    );

    if (isExactDuplicate) {
      console.log("Exact duplicate detected, skipping save:", trimmedText);
      return;
    }

    // 2. Substring/Expansion Check (Recent only - last 30 seconds)
    const recentMemories = currentMemories.filter(m => nowTime - m.createdAt < 30000);
    
    // Is the new text a fragment of a recent memory?
    const isFragment = recentMemories.some(m => 
      m.text.toLowerCase().includes(trimmedText.toLowerCase())
    );
    
    if (isFragment) {
      console.log("Fragment of recent memory detected, skipping save:", trimmedText);
      return;
    }

    // Is the new text an expansion of a recent memory?
    const expandedMemory = recentMemories.find(m => 
      trimmedText.toLowerCase().includes(m.text.toLowerCase().trim())
    );

    const parsed = parseInput(trimmedText);
    
    if (expandedMemory) {
      console.log("Expansion of recent memory detected, updating:", trimmedText);
      updateMemory(expandedMemory.id, {
        text: parsed.text || trimmedText,
        category: parsed.category || expandedMemory.category,
        intent: parsed.intent || expandedMemory.intent,
        dueDate: parsed.dueDate || expandedMemory.dueDate,
        ruleLimit: parsed.ruleLimit || expandedMemory.ruleLimit
      });
      loadData();
      return;
    }

    // Handle Reschedule Intelligence using fresh storage data
    if (parsed.intent === 'Reschedule') {
      const lastTask = currentMemories.find(m => m.intent === 'Task' && !m.completed);
      if (lastTask) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        updateMemory(lastTask.id, { dueDate: tomorrow.getTime() });
        loadData();
        return;
      }
    }

    const newItem: MemoryItem = {
      id: Math.random().toString(36).substring(2, 9),
      text: parsed.text || trimmedText,
      category: parsed.category || 'General',
      intent: parsed.intent || 'Note',
      createdAt: Date.now(),
      dueDate: parsed.dueDate,
      completed: false,
      ruleLimit: parsed.ruleLimit
    };

    saveMemory(newItem);
    loadData();
  }, [loadData]);

  const handleSpeechResult = useCallback((text: string, isContinuousMode: boolean) => {
    if (isContinuousMode) {
      handleAutoSave(text);
    } else {
      setInputText(prev => prev ? prev + ' ' + text : text);
    }
  }, [handleAutoSave]);

  const { isListening, isContinuous, transcript, startListening, stopListening, setTranscript } = useSpeech(handleSpeechResult, language);

  const handleManualSave = () => {
    if (!inputText.trim()) return;
    handleAutoSave(inputText);
    setInputText('');
    setTranscript('');
  };

  const toggleComplete = (id: string, currentStatus: boolean) => {
    updateMemory(id, { completed: !currentStatus });
    loadData();
  };

  const handleDelete = (id: string) => {
    deleteMemory(id);
    loadData();
  };

  const getCategoryIcon = (category: Category) => {
    switch (category) {
      case 'Health': return <Heart className="w-4 h-4 text-rose-500" />;
      case 'Finance': return <IndianRupee className="w-4 h-4 text-emerald-500" />;
      case 'Work': return <Briefcase className="w-4 h-4 text-blue-500" />;
      case 'Relationship': return <Heart className="w-4 h-4 text-purple-500" />;
      default: return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  const todayTasks = memories.filter(m => {
    if (m.intent !== 'Task') return false;
    if (!m.dueDate) return true; // Show tasks without specific date
    const today = new Date();
    const taskDate = new Date(m.dueDate);
    return taskDate.toDateString() === today.toDateString();
  });

  const completedToday = todayTasks.filter(m => m.completed).length;

  const filteredMemories = memories.filter(m => 
    m.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)] flex flex-col max-w-md mx-auto shadow-2xl relative overflow-hidden">
      
      {/* Header */}
      <header className="px-6 pt-12 pb-4 bg-[var(--color-card)] shadow-sm z-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              Life OS
              {isContinuous && (
                <span className="flex items-center gap-1 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full animate-pulse">
                  <Radio className="w-3 h-3" /> Live
                </span>
              )}
            </h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {format(new Date(), 'EEEE, MMMM d')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if ('Notification' in window && Notification.permission !== 'granted') {
                  Notification.requestPermission().then(p => setNotificationsEnabled(p === 'granted'));
                }
              }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 transition-colors",
                notificationsEnabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-[var(--color-muted)] text-[var(--color-foreground)] hover:bg-[var(--color-border)]"
              )}
              title="Notifications"
            >
              <Bell className="w-3 h-3" />
            </button>
            <button
              onClick={() => {
                stopListening();
                setLanguage(l => l === 'bn-IN' ? 'en-IN' : 'bn-IN');
              }}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--color-muted)] text-[var(--color-foreground)] flex items-center gap-1 transition-colors hover:bg-[var(--color-border)]"
              title="Toggle Language"
            >
              <Languages className="w-3 h-3" />
              {language === 'bn-IN' ? 'BN' : 'EN'}
            </button>
            <button 
              onClick={() => isContinuous ? stopListening() : startListening(true)}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                isContinuous ? "bg-red-100 text-red-600" : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
              )}
              title="Toggle Background Listening"
            >
              {isContinuous ? <MicOff className="w-5 h-5" /> : <Radio className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-40 px-4 pt-4 space-y-6">
        
        {activeTab === 'home' ? (
          <>
            {/* Smart Suggestions */}
            <AnimatePresence>
              {suggestions.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                    <h2 className="font-medium text-amber-800 dark:text-amber-400">Smart Insights</h2>
                  </div>
                  <ul className="space-y-2">
                    {suggestions.map((s, i) => (
                      <li key={i} className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                        <span className="mt-1">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Daily Summary */}
            <div className="bg-[var(--color-card)] rounded-2xl p-5 shadow-sm border border-[var(--color-border)]">
              <h2 className="font-medium mb-1">Today's Focus</h2>
              <p className="text-sm text-[var(--color-muted-foreground)] mb-4">
                You have {todayTasks.length} tasks today, {completedToday} completed.
              </p>
              
              <div className="space-y-3">
                {todayTasks.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-start gap-3 group">
                    <button 
                      onClick={() => toggleComplete(task.id, task.completed)}
                      className="mt-0.5 flex-shrink-0"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-[var(--color-muted-foreground)]" />
                      )}
                    </button>
                    <div className={cn("flex-1", task.completed && "opacity-50 line-through")}>
                      <p className="text-sm font-medium">{task.text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getCategoryIcon(task.category)}
                        <span className="text-xs text-[var(--color-muted-foreground)]">{task.category}</span>
                        {task.dueDate && (
                          <span className="text-xs text-[var(--color-muted-foreground)] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(task.dueDate, 'h:mm a')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {todayTasks.length === 0 && (
                  <p className="text-sm text-[var(--color-muted-foreground)] italic">No tasks for today. Enjoy your day!</p>
                )}
              </div>
            </div>

            {/* Recent Memories Context */}
            <div>
              <h3 className="text-sm font-medium text-[var(--color-muted-foreground)] mb-3 px-1">Recent Context & Notes</h3>
              <div className="space-y-2">
                {memories.filter(m => m.intent !== 'Task').slice(0, 5).map(memory => (
                  <div key={memory.id} className="bg-[var(--color-card)] p-3 rounded-xl border border-[var(--color-border)] flex items-center gap-3">
                    <div className="p-2 bg-[var(--color-muted)] rounded-lg">
                      {getCategoryIcon(memory.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{memory.text}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)] capitalize">{memory.intent}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-muted-foreground)]" />
              <input
                type="text"
                placeholder="Search memories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            
            <div className="space-y-3">
              {filteredMemories.map(memory => (
                <div key={memory.id} className="bg-[var(--color-card)] p-4 rounded-xl border border-[var(--color-border)]">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(memory.category)}
                      <span className="text-xs font-medium text-[var(--color-muted-foreground)]">{memory.category} • {memory.intent}</span>
                    </div>
                    <button onClick={() => handleDelete(memory.id)} className="text-[var(--color-muted-foreground)] hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm">{memory.text}</p>
                  <p className="text-xs text-[var(--color-muted-foreground)] mt-2">
                    {format(memory.createdAt, 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)] to-transparent pt-10 pb-6 px-4">
        <div className="relative max-w-md mx-auto">
          {isListening && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -top-12 left-0 right-0 text-center"
            >
              <span className="bg-[var(--color-primary)] text-white text-xs px-3 py-1.5 rounded-full shadow-md">
                {isContinuous ? "Background listening active..." : "Listening..."}
              </span>
            </motion.div>
          )}
          
          {/* Show live transcript in continuous mode above the input */}
          {isContinuous && transcript && (
            <div className="absolute -top-24 left-0 right-0 bg-black/80 text-white text-xs p-3 rounded-xl shadow-lg backdrop-blur-sm line-clamp-2">
              "{transcript}"
            </div>
          )}

          <div className="flex items-end gap-2 bg-[var(--color-card)] p-2 rounded-2xl shadow-lg border border-[var(--color-border)]">
            <button
              onClick={() => isListening ? stopListening() : startListening(false)}
              className={cn(
                "p-3 rounded-xl transition-colors",
                isListening && !isContinuous ? "bg-red-100 text-red-600 dark:bg-red-900/30" : "bg-[var(--color-muted)] text-[var(--color-foreground)]"
              )}
              title="Manual Voice Input"
            >
              {isListening && !isContinuous ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            
            <textarea
              ref={inputRef as any}
              value={isContinuous ? '' : (isListening && transcript ? (inputText ? inputText + ' ' + transcript : transcript) : inputText)}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isContinuous ? "Listening in background..." : "What do you want to remember?"}
              disabled={isContinuous}
              className="flex-1 max-h-32 min-h-[48px] bg-transparent border-none focus:ring-0 resize-none py-3 px-2 text-sm disabled:opacity-50"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleManualSave();
                }
              }}
            />
            
            <button
              onClick={handleManualSave}
              disabled={isContinuous || !inputText.trim()}
              className="p-3 bg-[var(--color-primary)] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bottom Nav */}
        <div className="flex justify-center gap-8 mt-6 text-[var(--color-muted-foreground)]">
          <button 
            onClick={() => setActiveTab('home')}
            className={cn("flex flex-col items-center gap-1", activeTab === 'home' && "text-[var(--color-primary)]")}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] font-medium">Home</span>
          </button>
          <button 
            onClick={() => setActiveTab('search')}
            className={cn("flex flex-col items-center gap-1", activeTab === 'search' && "text-[var(--color-primary)]")}
          >
            <Search className="w-5 h-5" />
            <span className="text-[10px] font-medium">Search</span>
          </button>
        </div>
      </div>
    </div>
  );
}
