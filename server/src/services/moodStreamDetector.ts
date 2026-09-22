import { type SceneMood, VALID_MOODS } from "@dnd-adventures/shared-types";

/**
 * Creates a stateful mood detector for streaming text chunks.
 * Strips {{mood:TAG}} from forwarded text and fires `onMoodChange` when a new mood is detected.
 * Handles partial tags split across chunk boundaries.
 */
export function createMoodStreamDetector(
  onMoodChange: (mood: SceneMood) => void,
  onText: (text: string) => void,
): (chunk: string) => void {
  let buffer = "";
  let currentMood: SceneMood | null = null;

  return (chunk: string) => {
    buffer += chunk;

    // Process complete {{mood:TAG}} patterns and flush clean text
    while (true) {
      const tagStart = buffer.indexOf("{{mood:");
      if (tagStart === -1) {
        // No tag start found — check if buffer ends with a partial "{{mood:" prefix
        // e.g. buffer ends with "{{", "{{m", "{{mo", etc.
        const partial = findPartialTagSuffix(buffer);
        if (partial > 0) {
          // Flush everything before the potential partial tag
          const safe = buffer.slice(0, buffer.length - partial);
          if (safe) onText(safe);
          buffer = buffer.slice(buffer.length - partial);
        } else {
          // No partial — flush everything
          if (buffer) onText(buffer);
          buffer = "";
        }
        break;
      }

      // Flush text before the tag
      if (tagStart > 0) {
        onText(buffer.slice(0, tagStart));
      }

      const tagEnd = buffer.indexOf("}}", tagStart + 7);
      if (tagEnd === -1) {
        // Incomplete tag — wait for more data
        buffer = buffer.slice(tagStart);
        break;
      }

      // Extract the mood value
      const moodValue = buffer.slice(tagStart + 7, tagEnd);
      if (VALID_MOODS.includes(moodValue as SceneMood) && moodValue !== currentMood) {
        currentMood = moodValue as SceneMood;
        onMoodChange(currentMood);
      }

      // Skip any trailing whitespace/newline after the tag
      let afterTag = tagEnd + 2;
      while (afterTag < buffer.length && (buffer[afterTag] === " " || buffer[afterTag] === "\n" || buffer[afterTag] === "\r")) {
        afterTag++;
      }

      buffer = buffer.slice(afterTag);
    }
  };
}

/** Returns the length of any partial "{{mood:" prefix at the end of the string. */
function findPartialTagSuffix(str: string): number {
  const TAG_PREFIX = "{{mood:";
  // Check progressively longer suffixes of str against prefixes of TAG_PREFIX
  for (let len = Math.min(TAG_PREFIX.length - 1, str.length); len >= 1; len--) {
    if (str.slice(-len) === TAG_PREFIX.slice(0, len)) {
      return len;
    }
  }
  return 0;
}
