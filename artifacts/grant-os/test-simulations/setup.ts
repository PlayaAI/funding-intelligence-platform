import WebSocket from "ws";

if (typeof globalThis !== "undefined" && !globalThis.WebSocket) {
  (globalThis as any).WebSocket = WebSocket;
}
