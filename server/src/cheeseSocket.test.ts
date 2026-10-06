import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { attachCheese } from "./cheeseSocket.js";
import type { CheeseView } from "../../shared/cheese.js";

test("mode 2 real clients receive admin-only secrets and saved henchman updates", { timeout: 20000 }, async () => {
  const http = createServer(), io = new Server(http);
  attachCheese(io);
  await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
  const port = (http.address() as { port: number }).port;
  const clients: Socket[] = [], views: (CheeseView | null)[] = [];
  const until = async (predicate: () => boolean) => {
    const end = Date.now() + 4000;
    while (!predicate()) {
      if (Date.now() > end) throw Error("state timeout");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
  const action = (index: number, event: string, data: object = {}) =>
    new Promise<{ ok: boolean; session?: { code: string } }>((resolve, reject) =>
      clients[index].timeout(4000).emit("action", { event, data }, (error: Error | null, reply: { ok: boolean; session?: { code: string } }) => error ? reject(error) : resolve(reply)),
    );
  try {
    for (let i = 0; i < 4; i++) {
      const client = connect(`http://127.0.0.1:${port}/cheese`, { forceNew: true, reconnection: false });
      clients.push(client);
      client.on("state", state => { views[i] = state; });
      await new Promise<void>(resolve => client.once("connect", resolve));
    }
    const created = await action(0, "create", { playerName: "Host", roomName: "Socket room", mode: "manual", capacity: 4 });
    for (let i = 1; i < 4; i++)
      assert.equal((await action(i, "join", { playerName: `P${i}`, code: created.session!.code })).ok, true);
    for (let i = 0; i < 4; i++) await action(i, "ready");
    await action(0, "start");
    await until(() => views.every(view => view?.phase === "reveal"));
    assert.ok(views.every(view => view!.players.every(player => !("role" in player) && !("hour" in player))));
    assert.ok(views[0]!.admin);
    assert.ok(views.slice(1).every(view => view!.admin === null));
    assert.equal(views[0]!.me.role, null);
    for (let i = 1; i < 4; i++) await action(i, "confirm");
    await until(() => views.every(view => view?.phase === "roll"));
    for (let i = 1; i < 4; i++) await action(i, "roll");
    await until(() => views.every(view => view?.phase === "meeting"));
    assert.ok(views[0]!.admin!.players.every(p => p.hour !== null));
    const helper = views[0]!.admin!.players.find(p => p.role === "mouse")!;
    const helperIndex = views.findIndex(v => v?.me.id === helper.id);
    assert.equal((await action(1, "admin_roles", { ids: [helper.id] })).ok, false);
    assert.equal((await action(0, "admin_roles", { ids: [helper.id] })).ok, true);
    await until(() => views[helperIndex]?.me.role === "henchman");
    assert.equal((await action(0, "admin_roles", { ids: [] })).ok, true);
    await until(() => views[helperIndex]?.me.role === "mouse");
    assert.equal((await action(0, "open_vote")).ok, true);
    await until(() => views.every(view => view?.phase === "vote"));
    const target = views[0]!.admin!.players.find(p => p.role === "thief")!.id;
    assert.equal((await action(0, "vote", { targetId: target })).ok, false);
    for (let i = 1; i < 4; i++) await action(i, "vote", { targetId: target });
    await until(() => views.every(view => view?.phase === "result"));
  } finally {
    clients.forEach(client => client.disconnect());
    await new Promise<void>(resolve => io.close(() => resolve()));
  }
});
