export const MAX_INPUT_WORDS = 50000;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function clampToWordLimit(text: string, limit: number): string {
  const normalized = text.trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= limit) {
    return normalized;
  }

  // Preserve original internal spacing/newlines while truncating by word count.
  const tokens = normalized.match(/\S+\s*/g) ?? [];
  return tokens.slice(0, limit).join("").trimEnd();
}
