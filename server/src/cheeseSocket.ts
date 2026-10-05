import type { Server } from "socket.io";
import { CheeseManager, type CheeseRoom } from "./CheeseManager.js";

export function attachCheese(io: Server, gm = new CheeseManager()) {
  const ns = io.of("/cheese");
  const publish = (room: CheeseRoom) => {
    for (const p of room.players) if (p.socketId) ns.to(p.socketId).emit("state", gm.snapshot(room, p));
  };
  ns.on("connection", socket => {
    let count = 0, windowStart = Date.now();
    socket.on("action", (request, ack) => {
      if (typeof ack !== "function") return;
      try {
        if (Date.now() - windowStart >= 1000) { count = 0; windowStart = Date.now(); }
        if (++count > 25) throw Error("ส่งคำสั่งเร็วเกินไป");
        if (!request || typeof request !== "object" || typeof request.event !== "string") throw Error("คำสั่งไม่ถูกต้อง");
        const data = request.data ?? {};
        if (!data || typeof data !== "object" || Array.isArray(data)) throw Error("ข้อมูลไม่ถูกต้อง");
        if (["create", "join", "rejoin"].includes(request.event)) {
          const found = request.event === "create" ? gm.create(socket.id, data) : request.event === "join" ? gm.join(socket.id, data) : gm.rejoin(socket.id, data);
          if ("previousSocketId" in found && typeof found.previousSocketId === "string") {
            ns.sockets.get(found.previousSocketId)?.emit("superseded");
            ns.sockets.get(found.previousSocketId)?.disconnect(true);
          }
          ack({ ok: true, session: gm.credentials(found.room, found.player) }); publish(found.room);
        } else if (request.event === "leave") {
          const room = gm.leave(socket.id); ack({ ok: true }); socket.emit("state", null); publish(room);
        } else {
          let removed: string | null = null;
          if (["kick", "replace_bot"].includes(request.event)) removed = gm.auth(socket.id).room.players.find(p => p.id === data.targetId)?.socketId ?? null;
          const room = gm.action(socket.id, request.event, data);
          ack({ ok: true });
          if (removed) ns.to(removed).emit("removed", "เจ้าของห้องนำคุณออกจากห้องแล้ว");
          publish(room);
        }
      } catch (error) { ack({ ok: false, error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" }); }
    });
    socket.on("disconnect", () => { const room = gm.disconnect(socket.id); if (room) publish(room); });
  });
  const timer = setInterval(() => gm.tick().forEach(publish), 250);
  timer.unref(); io.httpServer?.once("close", () => clearInterval(timer));
  return gm;
}
