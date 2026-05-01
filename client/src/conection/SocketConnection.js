import { atom } from "jotai";

class WebSocketAdapter {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.ws = null;
    this.connected = false;
    this.id = null;
    this.auth = {};
    this.listeners = new Map();
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(callback);
    return this;
  }

  off(eventName, callback) {
    const handlers = this.listeners.get(eventName);
    if (!handlers) return this;
    handlers.delete(callback);
    if (handlers.size === 0) {
      this.listeners.delete(eventName);
    }
    return this;
  }

  dispatch(eventName, payload) {
    const handlers = this.listeners.get(eventName);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (error) {
        console.error("Socket listener error (" + eventName + "):", error);
      }
    }
  }

  buildUrl() {
    const params = new URLSearchParams();

    if (this.auth && this.auth.name) params.set("name", String(this.auth.name));
    if (this.auth && this.auth.team) params.set("team", String(this.auth.team));

    const query = params.toString();
    let url = this.baseUrl;

    if (url.startsWith("http://")) url = "ws://" + url.slice("http://".length);
    if (url.startsWith("https://")) url = "wss://" + url.slice("https://".length);

    if (url.startsWith("/")) {
      const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
      url = protocol + window.location.host + url;
    }

    if (query.length > 0) {
      url += (url.includes("?") ? "&" : "?") + query;
    }

    return url;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = this.buildUrl();
    this.ws = new WebSocket(url);

    this.ws.addEventListener("open", () => {
      this.connected = true;
      this.dispatch("connect");
    });

    this.ws.addEventListener("close", (event) => {
      this.connected = false;
      this.ws = null;
      this.dispatch("disconnect", event.reason || "closed (" + event.code + ")");
    });

    this.ws.addEventListener("error", (event) => {
      this.dispatch("error", event);
    });

    this.ws.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        console.warn("Mensaje WS no JSON:", event.data);
        return;
      }

      const type = message && message.message_type;

      if (type === "welcome") {
        const normalizedId = message.player_identifier || message.id || null;
        if (normalizedId) this.id = normalizedId;

        this.dispatch("welcome", {
          ...message,
          id: normalizedId,
          player_identifier: normalizedId,
        });

        if (Array.isArray(message.characters)) this.dispatch("characters", message.characters);
        if (message.map !== undefined) this.dispatch("map", message.map);
        return;
      }

      if (type === "game_state") {
        this.dispatch("game_state", message);
        if (Array.isArray(message.characters)) this.dispatch("characters", message.characters);
        if (message.map !== undefined) this.dispatch("map", message.map);
        return;
      }

      if (typeof type === "string" && type.length > 0) {
        this.dispatch(type, message.payload !== undefined ? message.payload : message);
      }

      this.dispatch("message", message);
    });
  }

disconnect(code = 1000, reason = "client disconnect") {
  if (!this.ws) return;

  if (this.ws.readyState !== WebSocket.OPEN) {
    return;
  }

  this.ws.close(code, reason);
}

  emit(eventName, payload = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(
      JSON.stringify({
        message_type: eventName,
        payload,
      })
    );
    return true;
  }

  send(payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    const text = typeof payload === "string" ? payload : JSON.stringify(payload);
    this.ws.send(text);
    return true;
  }
}

export const Socket = new WebSocketAdapter("ws://localhost:3001/game-connection");

export const characterAtom = atom([]);
export const myIdAtom = atom(null);
export const mapAtom = atom(null);
export const wallsAtom = atom([]);