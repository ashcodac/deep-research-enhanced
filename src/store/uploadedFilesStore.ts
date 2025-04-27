// src/store/uploadedFilesStore.ts
import { create } from "zustand";

interface UploadedFilesState {
  files: File[];
  setFiles: (files: File[]) => void;
  addFile: (file: File) => void;
  removeFile: (index: number) => void;
  clearFiles: () => void;
}

export const useUploadedFilesStore = create<UploadedFilesState>((set) => ({
  files: [],
  setFiles: (files) => set({ files }),
  addFile: (file) => set((state) => ({ files: [...state.files, file] })),
  removeFile: (index) =>
    set((state) => ({
      files: state.files.filter((_, i) => i !== index),
    })),
  clearFiles: () => set({ files: [] }),
}));
