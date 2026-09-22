import crypto from "crypto";
import { z } from "zod";
import { redisClient, isRedisAvailable } from "./redis.js";
import { logEvent } from "./logger.js";
import type { ChatMessage } from "@dnd-adventures/shared-types";

export type { ChatMessage };

export type Conversation = {
  id: string;
  history: ChatMessage[];
  characterClass?: string;
  pronouns?: string;
  userId?: string;
};

// Zod schema for validating conversation data retrieved from Redis.
// Corrupt or tampered Redis data is treated as a cache miss rather than a runtime type error.
const conversationSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
  characterClass: z.string().optional(),
  pronouns: z.string().optional(),
});

/**
 * Thrown when a user attempts to access a conversation owned by a different user.
 */
export class ConversationOwnershipError extends Error {
  constructor(conversationId: string) {
    super(`Access denied: conversation ${conversationId} belongs to another user`);
    this.name = "ConversationOwnershipError";
  }
}

// Conversations expire after 7 days idle (refresh on every access)
const CONVERSATION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Number of recent turns sent to Bedrock per request (matches getWindowedHistory default). */
export const HISTORY_WINDOW_SIZE = 12;

function redisKey(conversationId: string): string {
  return `conv:${conversationId}`;
}

// ---------------------------------------------------------------------------
// Interface — callers program against this; swap to RedisConversationStore
// by replacing the singleton below.
// ---------------------------------------------------------------------------
export interface IConversationStore {
  getOrCreate(conversationId?: string, userId?: string, characterClass?: string, pronouns?: string): Promise<Conversation>;
  appendMessage(conversationId: string, message: ChatMessage): Promise<void>;
  getWindowedHistory(conversationId: string, maxTurns?: number): Promise<ChatMessage[]>;
  getCharacterClass(conversationId: string): Promise<string | undefined>;
  getPronouns(conversationId: string): Promise<string | undefined>;
}

// ---------------------------------------------------------------------------
// InMemoryConversationStore — exported so tests can instantiate isolated
// instances; use the singleton (conversationStore) for production code.
// ---------------------------------------------------------------------------
export class InMemoryConversationStore implements IConversationStore {
  private store = new Map<string, Conversation>();
  private locks = new Map<string, Promise<void>>();

  private async withLock<T>(conversationId: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.locks.get(conversationId) ?? Promise.resolve();
    let release: () => void;
    const next = new Promise<void>(resolve => { release = resolve; });
    this.locks.set(conversationId, next);
    await existing;
    try {
      return await fn();
    } finally {
      release!();
      if (this.locks.get(conversationId) === next) this.locks.delete(conversationId);
    }
  }

  async getOrCreate(
    conversationId?: string,
    userId?: string,
    characterClass?: string,
    pronouns?: string
  ): Promise<Conversation> {
    const id = conversationId ?? crypto.randomUUID();

    if (isRedisAvailable()) {
      try {
        return await this.withLock(id, async () => {
          let convo = await this._getFromRedis(id);
          if (!convo) {
            convo = { id, history: [], userId, characterClass, pronouns };
          } else {
            // IDOR ownership check: if conversation already has an owner,
            // reject requests from a different user.
            if (convo.userId && userId && convo.userId !== userId) {
              throw new ConversationOwnershipError(id);
            }
            // Migration path: claim ownership for legacy conversations (no userId set)
            if (!convo.userId && userId) {
              convo.userId = userId;
            }
            if (characterClass && !convo.characterClass) {
              convo.characterClass = characterClass;
            }
            if (pronouns && !convo.pronouns) {
              convo.pronouns = pronouns;
            }
          }
          await this._saveToRedis(convo);
          return convo;
        });
      } catch (err) {
        if (err instanceof ConversationOwnershipError) throw err;
        console.error("[conversationStore] Redis error, falling back to in-memory:", err);
      }
    }

    // In-memory fallback — wrapped in withLock to prevent race conditions under
    // concurrent access (e.g., two requests for same id reading stale history).
    return this.withLock(id, async () => {
      if (!this.store.has(id)) {
        this.store.set(id, { id, history: [], userId, characterClass, pronouns });
      }
      const convo = this.store.get(id)!;
      // IDOR ownership check
      if (convo.userId && userId && convo.userId !== userId) {
        throw new ConversationOwnershipError(id);
      }
      // Migration path: claim ownership for legacy conversations
      if (!convo.userId && userId) {
        convo.userId = userId;
      }
      if (characterClass && !convo.characterClass) {
        convo.characterClass = characterClass;
      }
      if (pronouns && !convo.pronouns) {
        convo.pronouns = pronouns;
      }
      return convo;
    });
  }

  async getCharacterClass(conversationId: string): Promise<string | undefined> {
    if (isRedisAvailable()) {
      try {
        const convo = await this._getFromRedis(conversationId);
        return convo?.characterClass;
      } catch (err) {
        console.error("[conversationStore] Redis error, falling back to in-memory:", err);
      }
    }
    return this.store.get(conversationId)?.characterClass;
  }

  async getPronouns(conversationId: string): Promise<string | undefined> {
    if (isRedisAvailable()) {
      try {
        const convo = await this._getFromRedis(conversationId);
        return convo?.pronouns;
      } catch (err) {
        console.error("[conversationStore] Redis error, falling back to in-memory:", err);
      }
    }
    return this.store.get(conversationId)?.pronouns;
  }

  async appendMessage(conversationId: string, message: ChatMessage): Promise<void> {
    if (isRedisAvailable()) {
      try {
        await this.withLock(conversationId, async () => {
          const convo = await this._getFromRedis(conversationId);
          if (!convo) throw new Error(`Conversation ${conversationId} not found`);
          convo.history.push(message);
          if (convo.history.length > 100) convo.history = convo.history.slice(-100);
          await this._saveToRedis(convo);
        });
        return;
      } catch (err) {
        console.error("[conversationStore] Redis error, falling back to in-memory:", err);
      }
    }

    // In-memory fallback — wrapped in withLock to prevent lost-update races
    // where two concurrent appends both read history length N and both write N+1.
    await this.withLock(conversationId, async () => {
      const conversation = this.store.get(conversationId);
      if (!conversation) throw new Error(`Conversation ${conversationId} not found`);
      conversation.history.push(message);
      if (conversation.history.length > 100) conversation.history = conversation.history.slice(-100);
    });
  }

  // Keep last N turns to stay within token budget
  async getWindowedHistory(
    conversationId: string,
    maxTurns = 12
  ): Promise<ChatMessage[]> {
    if (isRedisAvailable()) {
      try {
        const convo = await this._getFromRedis(conversationId);
        if (!convo) return [];
        return convo.history.slice(-maxTurns);
      } catch (err) {
        console.error("[conversationStore] Redis error, falling back to in-memory:", err);
      }
    }

    // In-memory fallback
    const conversation = this.store.get(conversationId);
    if (!conversation) return [];
    return conversation.history.slice(-maxTurns);
  }

  // ---- private Redis helpers ----

  // Module-level flag: flips false on first GETEX failure, avoids retrying on older Redis
  private _getexSupported = true;

  private async _getFromRedis(conversationId: string): Promise<Conversation | null> {
    let raw: string | null | undefined;

    if (this._getexSupported) {
      try {
        raw = await redisClient.getEx(redisKey(conversationId), {
          EX: CONVERSATION_TTL_SECONDS,
        });
      } catch (err) {
        // GETEX requires Redis 6.2+. Fall back to GET+EXPIRE for older versions.
        this._getexSupported = false;
        logEvent("warn", "conversationStore.getex_unsupported", { fallback: "get+expire" });
        raw = await redisClient.get(redisKey(conversationId));
        if (raw) await redisClient.expire(redisKey(conversationId), CONVERSATION_TTL_SECONDS);
      }
    } else {
      raw = await redisClient.get(redisKey(conversationId));
      if (raw) await redisClient.expire(redisKey(conversationId), CONVERSATION_TTL_SECONDS);
    }

    if (!raw) return null;

    // Validate parsed Redis data with Zod — treat corrupt data as a cache miss
    const parsed = conversationSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      logEvent("warn", "conversationStore.invalid_redis_data", {
        conversationId,
        errors: parsed.error.flatten(),
      });
      return null; // Treat corrupt data as cache miss
    }
    return parsed.data;
  }

  private async _saveToRedis(convo: Conversation): Promise<void> {
    await redisClient.set(redisKey(convo.id), JSON.stringify(convo), {
      EX: CONVERSATION_TTL_SECONDS,
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton — production code uses these; swap implementation here for Redis.
// ---------------------------------------------------------------------------
const conversationStore: IConversationStore = new InMemoryConversationStore();
export { conversationStore };

// ---------------------------------------------------------------------------
// Backward-compatible free function exports — no callers need to change.
// ---------------------------------------------------------------------------
export const getOrCreate = conversationStore.getOrCreate.bind(conversationStore);
export const appendMessage = conversationStore.appendMessage.bind(conversationStore);
export const getWindowedHistory = conversationStore.getWindowedHistory.bind(conversationStore);
