import { streamBedrockResponse } from "./bedrock.js";
import { appendMessage, type Conversation } from "./conversationStore.js";
import { buildLoreContext } from "./rag.js";
import { queueBedrockCall } from "./bedrockQueue.js";
import { createMoodStreamDetector } from "./moodStreamDetector.js";
import { stripTTSTags, extractMood, extractScene, expandPhrases } from "./tts.js";
import type { ChatMessage } from "@dnd-adventures/shared-types";

export interface DmTurnCallbacks {
  onText: (text: string) => void;
  onMoodChange: (mood: string) => void;
}

export interface DmTurnOptions {
  characterClass?: string;
  pronouns?: string;
  multiplayerPrompt?: string;
  /** Text to extract lore entities from — defaults to userMessage if not provided */
  loreQuery?: string;
}

export interface DmTurnResult {
  fullText: string;
  cleanText: string;
  mood: string | undefined;
  scene: string | undefined;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Execute a single DM turn: build lore context, stream Bedrock response,
 * persist assistant message. Transport-agnostic — callers provide callbacks
 * for SSE (chat.ts) or Socket.IO (turnHandlers.ts).
 */
export async function executeDmTurn(
  conversation: Conversation,
  userMessage: string,
  history: ChatMessage[],
  callbacks: DmTurnCallbacks,
  options: DmTurnOptions = {},
): Promise<DmTurnResult> {
  const loreContext = await buildLoreContext(options.loreQuery ?? userMessage).catch(() => "");

  const detector = createMoodStreamDetector(
    callbacks.onMoodChange,
    callbacks.onText,
  );

  const result = await queueBedrockCall(() =>
    streamBedrockResponse(
      history,
      (chunk: string) => detector(chunk),
      {
        characterClass: options.characterClass,
        pronouns: options.pronouns,
        multiplayerPrompt: options.multiplayerPrompt,
        loreContext,
      }
    )
  );

  const [mood] = extractMood(result.text);
  const [scene] = extractScene(result.text);

  // Persist assistant response
  await appendMessage(conversation.id, {
    role: "assistant",
    content: stripTTSTags(expandPhrases(result.text)),
  });

  return {
    fullText: result.text,
    cleanText: stripTTSTags(expandPhrases(result.text)),
    mood: mood ?? undefined,
    scene: scene ?? undefined,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}
