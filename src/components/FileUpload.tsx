"use client";

import { useUploadedFilesStore } from "@/store/uploadedFilesStore";
import { useChunksStore } from "@/store/chunksStore";
import { UploadCloud, X, FileText } from "lucide-react";
import { ChangeEvent, DragEvent } from "react";
import { splitFileIntoChunks } from "@/lib/utils";

function FileUpload() {
  const { files, setFiles, removeFile } = useUploadedFilesStore();
  const { addChunks } = useChunksStore();

  const handleFilesChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter(
        (file) =>
          file.type === "application/pdf" ||
          file.type === "text/plain" ||
          file.name.endsWith(".md")
      );
      setFiles([...files, ...selected]);
      await processFiles(selected);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter(
      (file) =>
        file.type === "application/pdf" ||
        file.type === "text/plain" ||
        file.name.endsWith(".md")
    );
    setFiles([...files, ...dropped]);
    await processFiles(dropped);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const processFiles = async (filesToProcess: File[]) => {
    for (const file of filesToProcess) {
      const chunks = await splitFileIntoChunks(file);
      addChunks(chunks);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Upload Box */}
      <div
        className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-900 shadow-md transition cursor-pointer"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <UploadCloud className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-2" />
        <p className="text-base text-gray-600 dark:text-gray-300 mb-2">
          Select or Drag Files (PDF, TXT, MD)
        </p>
        <label className="cursor-pointer inline-block bg-black text-white px-6 py-2 text-base rounded hover:bg-gray-800">
          Choose File(s)
          <input
            type="file"
            multiple
            accept=".pdf,.txt,.md"
            className="hidden"
            onChange={handleFilesChange}
          />
        </label>
      </div>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="border rounded-lg p-4 bg-white dark:bg-gray-800 shadow-md">
          <p className="font-semibold mb-3 text-base text-gray-800 dark:text-gray-100">
            Selected Files:
          </p>
          <ul className="text-base text-gray-700 dark:text-gray-300 space-y-2">
            {files.map((file, index) => (
              <li
                key={index}
                className="flex justify-between items-center px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <span className="flex items-center gap-2 truncate max-w-[80%]">
                  <FileText size={18} />
                  {file.name}
                </span>
                <button
                  onClick={() => removeFile(index)}
                  className="text-gray-800 dark:text-gray-100 text-sm"
                >
                  <X size={18} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default FileUpload;
