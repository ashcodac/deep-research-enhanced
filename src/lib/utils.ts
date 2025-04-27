import { v4 as uuidv4 } from "uuid";

export async function splitFileIntoChunks(file: File): Promise<Chunk[]> {
  const text = await file.text();
  const maxChunkSize = 800; // characters
  const chunks: Chunk[] = [];

  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    const chunkText = text.slice(start, start + maxChunkSize);
    chunks.push({
      id: uuidv4(),
      fileName: file.name,
      chunkIndex,
      chunkText,
    });
    start += maxChunkSize;
    chunkIndex += 1;
  }

  return chunks;
}
