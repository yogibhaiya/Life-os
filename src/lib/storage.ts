import { MemoryItem } from '../types';

const STORAGE_KEY = 'life_os_memories';

export function getMemories(): MemoryItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to parse memories", e);
    return [];
  }
}

export function saveMemory(item: MemoryItem) {
  const memories = getMemories();
  memories.unshift(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
}

export function updateMemory(id: string, updates: Partial<MemoryItem>) {
  const memories = getMemories();
  const index = memories.findIndex(m => m.id === id);
  if (index !== -1) {
    memories[index] = { ...memories[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
  }
}

export function deleteMemory(id: string) {
  const memories = getMemories();
  const filtered = memories.filter(m => m.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
