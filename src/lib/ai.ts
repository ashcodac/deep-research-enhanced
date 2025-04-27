/**
 * Fake embedding generator: converts text to an array of numbers (vector).
 */
export function fakeEmbed(text: string): number[] {
    const embeddingSize = 128;
    const textCodePoints = Array.from(text).map((char) => char.codePointAt(0) || 0);
    const vector = new Array(embeddingSize).fill(0);
  
    textCodePoints.forEach((code, idx) => {
      vector[idx % embeddingSize] += code;
    });
  
    return vector;
  }
  
  /**
   * Cosine similarity between two vectors.
   */
  function cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, val, idx) => sum + val * b[idx], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (normA * normB);
  }
  
  /**
   * Find top matching document chunks.
   */
  export function findClosestChunks(
    question: string,
    chunks: Chunk[],
    topK: number = 5
  ): Chunk[] {
    const questionVector = fakeEmbed(question);
  
    const scoredChunks = chunks.map((chunk) => {
      const chunkVector = fakeEmbed(chunk.chunkText);
      const score = cosineSimilarity(questionVector, chunkVector);
      return { chunk, score };
    });
  
    scoredChunks.sort((a, b) => b.score - a.score); // higher score = closer match
  
    return scoredChunks.slice(0, topK).map((item) => item.chunk);
  }
  