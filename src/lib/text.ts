export const MAX_INPUT_WORDS = 50000;
const SCALE_TARGETS = [5000, 2500, 1000, 500, 250, 100, 50, 10] as const;

export function selectCompressionTargets(originalWordCount: number): number[] {
  let current = originalWordCount;
  const targets: number[] = [];

  while (current > 1) {
    const threshold = current / 2;
    const next = SCALE_TARGETS.find((target) => target <= threshold);
    if (!next) {
      break;
    }

    targets.push(next);
    current = next;
  }

  return targets;
}

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
