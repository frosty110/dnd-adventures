/**
 * Shared input sanitization for user-facing text inputs.
 * Strips prompt injection patterns, control characters, and enforces length limits.
 */
import { CHARACTER_CLASS_IDS } from '@dnd-adventures/shared-types';

// Patterns that could be used for Bedrock/Claude template injection,
// including XML-like role confusion tags that Claude interprets as special tokens.
const INJECTION_PATTERNS = /\{\{|\}\}|<\||>\||<\/?(?:system|human|assistant|prompt|instruction|context)[^>]*>/gi;

// Full unicode control character range — excludes tab (0x09), newline (0x0A), CR (0x0D)
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// Invisible and zero-width unicode characters that can be used to bypass filters
const INVISIBLE_CHARS = /[\u00AD\u200B-\u200F\u2028\u2029\uFEFF\u200C\u200D]/g;

/**
 * Sanitize user input text before it reaches Bedrock or gets stored.
 * - Strips template injection patterns: {{ }} <| |> and XML role confusion tags
 * - Strips dangerous control characters (full unicode range 0x00-0x1F excluding tab/LF/CR, plus DEL 0x7F)
 * - Strips invisible and zero-width unicode characters
 * - Enforces max length
 * - Trims whitespace
 */
export function sanitizeUserInput(text: string, maxLength = 2000): string {
  return text
    .replace(INJECTION_PATTERNS, "")
    .replace(CONTROL_CHARS, "")
    .replace(INVISIBLE_CHARS, "")
    .slice(0, maxLength)
    .trim();
}

/**
 * Valid character classes — derived from shared CHARACTER_CLASS_IDS to ensure
 * client and server always agree on valid values.
 * Typed as Set<string> so `.has()` accepts arbitrary user input without type assertions.
 */
export const VALID_CHARACTER_CLASSES: Set<string> = new Set(CHARACTER_CLASS_IDS);

/**
 * Validate and normalize a characterClass value from request body.
 * Returns the normalized class string if valid, undefined otherwise.
 */
export function validateCharacterClass(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.toLowerCase().trim();
  return VALID_CHARACTER_CLASSES.has(normalized) ? normalized : undefined;
}

/**
 * Sanitize pronouns field from request body.
 * Applies full input sanitization and caps at 50 characters.
 * Returns undefined if input is not a string or sanitizes to empty string.
 */
export function sanitizePronouns(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const clean = sanitizeUserInput(raw, 50);
  return clean || undefined;
}
