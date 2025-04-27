import { create } from "zustand";

interface ChunksState {
  chunks: Chunk[];
  addChunks: (newChunks: Chunk[]) => void;
  clearChunks: () => void;
}

export const useChunksStore = create<ChunksState>((set) => ({
  chunks: [],
  addChunks: (newChunks) =>
    set((state) => ({
      chunks: [...state.chunks, ...newChunks],
    })),
  clearChunks: () => set({ chunks: [] }),
}));
