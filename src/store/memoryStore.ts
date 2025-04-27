"use client";

import { create } from "zustand";

interface MemoryEntry {
  question: string;
  answer: string;
}

interface MemoryState {
  memories: MemoryEntry[];
  addMemory: (memory: MemoryEntry) => void;
  clearMemories: () => void;
}

export const useMemoryStore = create<MemoryState>((set) => ({
  memories: [],
  addMemory: (memory) =>
    set((state) => ({
      memories: [...state.memories, memory].slice(-10), // Keep only last 10 for safety
    })),
  clearMemories: () => set({ memories: [] }),
}));
