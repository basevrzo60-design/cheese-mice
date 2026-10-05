import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { attachCheese } from "./cheeseSocket.js";
import type { CheeseView } from "../../shared/cheese.js";

test("real clients receive private states, reconnect, replace a lost seat and finish a game", { timeout: 20000 }, async () => {
  const http = createServer(), io = new Server(http), gm = attachCheese(io);
  await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
  const port = (http.address() as { port: number }).port;
  const clients: Socket[] = [], views: (CheeseView | null)[] = [];
  const until = async (predicate: () => boolean) => {
    const end = Date.now() + 4000;
    while (!predicate()) { if (Date.now() > end) throw Error("state timeout"); await new Promise(r => setTimeout(r, 10)); }
  };
  const act = (i: number, event: string, data: object = {}) => new Promise<{ ok: boolean; session?: { code: string; id: string; token: string } }>((resolve, reject) => clients[i].timeout(4000).emit("action", { event, data }, (err: Error | null, reply: never) => err ? reject(err) : resolve(reply)));
  try {
    for (let i = 0; i < 4; i++) {
      const socket = connect(`http://127.0.0.1:${port}/cheese`, { forceNew: true, reconnection: false }); clients.push(socket);
      socket.on("state", state => views[i] = state);
      await new Promise<void>(resolve => socket.once("connect", resolve));
    }
    const made = await act(0, "create", { playerName: "Host", roomName: "Socket room", mode: "manual", capacity: 4 });
    const code = made.session!.code;
    for (let i = 1; i < 4; i++) assert.equal((await act(i, "join", { playerName: `P${i}`, code })).ok, true);
    for (let i = 0; i < 4; i++) await act(i, "ready");
    await act(0, "start"); await until(() => views.every(v => v?.phase === "reveal"));
    assert.ok(views.every(v => v!.players.every(p => !("role" in p) && !("token" in p))));
    for (let i = 0; i < 4; i++) await act(i, "confirm");
    await act(0, "next"); await until(() => views.every(v => v?.phase === "roll"));
    for (let i = 0; i < 4; i++) await act(i, "roll");
    await act(0, "next"); await until(() => views.every(v => v?.phase === "night"));
    clients[0].disconnect(); await until(() => views[1]?.paused === true);
    const room = gm.rooms.get(code)!;
    clients[0].connect(); await new Promise<void>(resolve => clients[0].once("connect", resolve));
    assert.equal((await act(0, "rejoin", made.session!)).ok, true);
    await until(() => views.every(v => v?.paused === false));
    const hostIndex = views.findIndex(v => v?.me.id === room.hostId);
    for (let i = 0; i < 6; i++) assert.equal((await act(hostIndex, "next")).ok, true);
    await until(() => views.every(v => v?.phase === "recruit"));
    const thiefIndex = views.findIndex(v => v?.me.role === "thief");
    const ids = room.players.filter(p => p.role === "mouse").slice(0, 2).map(p => p.id);
    await act(thiefIndex, "recruit", { ids }); await until(() => views.every(v => v?.phase === "meeting"));
    await act(hostIndex, "open_vote"); await until(() => views.every(v => v?.phase === "vote"));
    assert.ok(views.every(v => v?.me.canVote));
    const targetId = views[thiefIndex]!.me.id;
    for (let i = 0; i < 4; i++) {
      assert.equal((await act(i, "vote", { targetId })).ok, true);
      if (i < 3) assert.equal(room.phase, "vote");
    }
    await until(() => views.every(v => v?.phase === "result"));
    assert.equal(views[0]!.result!.winner, "mice");
    assert.equal((await act(hostIndex, "restart")).ok, true);
    await until(() => views.every(v => v?.phase === "lobby"));
    const victimIndex = (hostIndex + 1) % 4;
    const removed = new Promise<void>(resolve => clients[victimIndex].once("removed", () => resolve()));
    await act(hostIndex, "kick", { targetId: views[victimIndex]!.me.id }); await removed;
    await until(() => views[hostIndex]!.players.length === 3);
  } finally { clients.forEach(c => c.disconnect()); await new Promise<void>(resolve => io.close(() => resolve())); }
});
