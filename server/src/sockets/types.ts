// Re-export all socket types from the shared package.
// This file exists for backward compatibility during the rewrite.
export type {
  RoomPhase,
  PlayerPayload,
  RoomStatePayload,
  ChatMessagePayload,
  ServerToClientEvents,
  ClientToServerEvents,
  SocketData,
} from "@dnd-adventures/shared-types";
