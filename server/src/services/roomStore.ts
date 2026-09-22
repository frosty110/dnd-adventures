import { customAlphabet } from "nanoid";
import type { RoomPhase, RoomStatePayload, PlayerPayload } from "@dnd-adventures/shared-types";

export type { RoomPhase };

export type Player = {
  socketId: string;
  displayName: string;
  characterClass: string;
  gender: string;
  pronouns: string;
  connected: boolean;
  ready: boolean;
  submittedAction: string | null;
  idle: boolean;
};

export type Room = {
  code: string;
  conversationId: string;
  phase: RoomPhase;
  players: Map<string, Player>;
  timerStartedAt: number | null;
  timerHandle: ReturnType<typeof setTimeout> | null;
  // Accumulates the DM stream text — used to catch up late-joiners
  currentDmText: string;
};

// Alphabet excludes I and O to avoid visual confusion with 1 and 0
const genCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

// ---------------------------------------------------------------------------
// Interface — callers program against this; swap to a Redis-backed store
// by replacing the singleton below.
// ---------------------------------------------------------------------------
export interface IRoomStore {
  generateUniqueRoomCode(): string;
  createRoom(code: string, conversationId: string): Room;
  getRoom(code: string): Room | undefined;
  deleteRoom(code: string): void;
  addPlayer(code: string, player: Player): boolean;
  removePlayer(code: string, socketId: string): void;
  markPlayerDisconnected(code: string, socketId: string): void;
  markPlayerReconnected(code: string, socketId: string): void;
  markPlayerIdle(code: string, socketId: string): void;
  markPlayerActive(code: string, socketId: string): void;
  markPlayerReady(code: string, socketId: string): void;
  submitAction(code: string, socketId: string, action: string): boolean;
  unsubmitAction(code: string, socketId: string): boolean;
  allActionsSubmitted(code: string): boolean;
  resetActions(code: string): void;
  getRoomStatePayload(code: string): RoomStatePayload | null;
  getConnectedPlayerCount(code: string): number;
  getAllReadyCount(code: string): number;
  getActiveRoomCodes(limit?: number): string[];
}

// ---------------------------------------------------------------------------
// InMemoryRoomStore — exported so tests can instantiate isolated instances;
// use the singleton (roomStore) for production code.
// ---------------------------------------------------------------------------
export class InMemoryRoomStore implements IRoomStore {
  private rooms = new Map<string, Room>();

  /**
   * Generate a unique 6-character room code that doesn't already exist in the store.
   */
  generateUniqueRoomCode(): string {
    let code: string;
    do {
      code = genCode();
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Create a new room and add it to the store.
   */
  createRoom(code: string, conversationId: string): Room {
    const room: Room = {
      code,
      conversationId,
      phase: "lobby",
      players: new Map(),
      timerStartedAt: null,
      timerHandle: null,
      currentDmText: "",
    };
    this.rooms.set(code, room);
    return room;
  }

  /**
   * Retrieve a room by its code.
   */
  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  /**
   * Delete a room, clearing any pending timers first.
   */
  deleteRoom(code: string): void {
    const room = this.rooms.get(code);
    if (room?.timerHandle !== null && room?.timerHandle !== undefined) {
      clearTimeout(room.timerHandle);
    }
    this.rooms.delete(code);
  }

  /**
   * Add a player to a room. Returns false if the room doesn't exist or is full (4 players max).
   */
  addPlayer(code: string, player: Player): boolean {
    const room = this.rooms.get(code);
    if (!room || room.players.size >= 4) {
      return false;
    }
    room.players.set(player.socketId, player);
    return true;
  }

  /**
   * Remove a player from a room's player map entirely.
   */
  removePlayer(code: string, socketId: string): void {
    const room = this.rooms.get(code);
    room?.players.delete(socketId);
  }

  /**
   * Mark a player as disconnected (connected = false) rather than removing them.
   */
  markPlayerDisconnected(code: string, socketId: string): void {
    const room = this.rooms.get(code);
    const player = room?.players.get(socketId);
    if (player) {
      player.connected = false;
    }
  }

  /**
   * Mark a player as reconnected (connected = true).
   */
  markPlayerReconnected(code: string, socketId: string): void {
    const room = this.rooms.get(code);
    const player = room?.players.get(socketId);
    if (player) {
      player.connected = true;
    }
  }

  /**
   * Mark a player as idle.
   */
  markPlayerIdle(code: string, socketId: string): void {
    const room = this.rooms.get(code);
    const player = room?.players.get(socketId);
    if (player) {
      player.idle = true;
    }
  }

  /**
   * Mark a player as active (not idle).
   */
  markPlayerActive(code: string, socketId: string): void {
    const room = this.rooms.get(code);
    const player = room?.players.get(socketId);
    if (player) {
      player.idle = false;
    }
  }

  /**
   * Mark a player as ready in the lobby.
   */
  markPlayerReady(code: string, socketId: string): void {
    const room = this.rooms.get(code);
    const player = room?.players.get(socketId);
    if (player) {
      player.ready = true;
    }
  }

  /**
   * Record a player's submitted turn action. Returns true if successful.
   */
  submitAction(code: string, socketId: string, action: string): boolean {
    const room = this.rooms.get(code);
    const player = room?.players.get(socketId);
    if (!player) {
      return false;
    }
    player.submittedAction = action;
    return true;
  }

  /**
   * Clear a player's submitted action (unsubmit / edit). Returns true if successful.
   */
  unsubmitAction(code: string, socketId: string): boolean {
    const room = this.rooms.get(code);
    const player = room?.players.get(socketId);
    if (!player) {
      return false;
    }
    player.submittedAction = null;
    return true;
  }

  /**
   * Returns true if every currently-connected player has submitted an action.
   */
  allActionsSubmitted(code: string): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;
    for (const player of room.players.values()) {
      if (player.connected && player.submittedAction === null) {
        return false;
      }
    }
    return true;
  }

  /**
   * Reset all players' submitted actions to null (start of new turn).
   */
  resetActions(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    for (const player of room.players.values()) {
      player.submittedAction = null;
    }
  }

  /**
   * Convert the room to a serializable payload. Action text is hidden — only the boolean flag is sent.
   * Returns null if the room does not exist.
   */
  getRoomStatePayload(code: string): RoomStatePayload | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const players: PlayerPayload[] = Array.from(room.players.values()).map((p) => ({
      socketId: p.socketId,
      displayName: p.displayName,
      characterClass: p.characterClass,
      gender: p.gender,
      pronouns: p.pronouns,
      connected: p.connected,
      ready: p.ready,
      submittedAction: p.submittedAction !== null, // hide action text
      idle: p.idle,
    }));

    return {
      code: room.code,
      phase: room.phase,
      players,
    };
  }

  /**
   * Returns how many players are currently connected to the room.
   */
  getConnectedPlayerCount(code: string): number {
    const room = this.rooms.get(code);
    if (!room) return 0;
    let count = 0;
    for (const player of room.players.values()) {
      if (player.connected) count++;
    }
    return count;
  }

  /**
   * Returns how many players have set ready = true.
   */
  getAllReadyCount(code: string): number {
    const room = this.rooms.get(code);
    if (!room) return 0;
    let count = 0;
    for (const player of room.players.values()) {
      if (player.ready) count++;
    }
    return count;
  }

  /**
   * Return up to `limit` active room codes (for debug logging).
   */
  getActiveRoomCodes(limit = 5): string[] {
    return Array.from(this.rooms.keys()).slice(0, limit);
  }
}

// ---------------------------------------------------------------------------
// Singleton — production code uses these; swap implementation here for Redis.
// ---------------------------------------------------------------------------
const roomStore: IRoomStore = new InMemoryRoomStore();
export { roomStore };

// ---------------------------------------------------------------------------
// Backward-compatible free function exports — no callers need to change.
// ---------------------------------------------------------------------------
export const generateUniqueRoomCode = roomStore.generateUniqueRoomCode.bind(roomStore);
export const createRoom = roomStore.createRoom.bind(roomStore);
export const getRoom = roomStore.getRoom.bind(roomStore);
export const deleteRoom = roomStore.deleteRoom.bind(roomStore);
export const addPlayer = roomStore.addPlayer.bind(roomStore);
export const removePlayer = roomStore.removePlayer.bind(roomStore);
export const markPlayerDisconnected = roomStore.markPlayerDisconnected.bind(roomStore);
export const markPlayerReconnected = roomStore.markPlayerReconnected.bind(roomStore);
export const markPlayerIdle = roomStore.markPlayerIdle.bind(roomStore);
export const markPlayerActive = roomStore.markPlayerActive.bind(roomStore);
export const markPlayerReady = roomStore.markPlayerReady.bind(roomStore);
export const submitAction = roomStore.submitAction.bind(roomStore);
export const unsubmitAction = roomStore.unsubmitAction.bind(roomStore);
export const allActionsSubmitted = roomStore.allActionsSubmitted.bind(roomStore);
export const resetActions = roomStore.resetActions.bind(roomStore);
export const getRoomStatePayload = roomStore.getRoomStatePayload.bind(roomStore);
export const getConnectedPlayerCount = roomStore.getConnectedPlayerCount.bind(roomStore);
export const getAllReadyCount = roomStore.getAllReadyCount.bind(roomStore);
export const getActiveRoomCodes = roomStore.getActiveRoomCodes.bind(roomStore);
