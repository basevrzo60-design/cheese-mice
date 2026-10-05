import { test } from "node:test";
import assert from "node:assert/strict";
import { CheeseManager } from "./CheeseManager.js";
import type { CheeseMode } from "../../shared/cheese.js";

function setup(mode: CheeseMode = "manual", count = 6) {
  let time = 1000;
  const gm = new CheeseManager(() => 0, () => time);
  const { room } = gm.create("s0", { playerName: "P0", roomName: "Test", capacity: count, mode });
  for (let i = 1; i < count; i++) gm.join(`s${i}`, { code: room.code, playerName: `P${i}` });
  for (let i = 0; i < count; i++) gm.action(`s${i}`, "ready");
  return { gm, room, advanceTime: (ms: number) => { time += ms; } };
}
function start(g: ReturnType<typeof setup>) {
  const { gm, room } = g; gm.action("s0", "start");
  for (let i = 0; i < room.players.length; i++) {
    if (!room.players[i].role) gm.action(`s${i}`, "pick", { index: i });
    gm.action(`s${i}`, "confirm");
  }
  if (room.mode === "manual") gm.action("s0", "next");
  for (let i = 0; i < room.players.length; i++) gm.action(`s${i}`, "roll");
  if (room.mode === "manual") gm.action("s0", "next");
}
function morning(g: ReturnType<typeof setup>) {
  start(g); const { gm, room } = g;
  for (let h = 1; h <= 6; h++) gm.action("s0", "next");
  const thief = room.players.find(p => p.role === "thief")!;
  const helpers = room.players.filter(p => p !== thief).slice(0, 2);
  gm.action(thief.socketId!, "recruit", { ids: helpers.map(p => p.id) });
  return { thief, helpers };
}

test("mode 1 uses one sealed card per player, requires readiness, and supports no timer", () => {
  const g = setup("timed", 4); const { gm, room } = g;
  assert.throws(() => gm.action("s1", "timer", { seconds: 0 }));
  gm.action("s0", "timer", { seconds: 0 }); gm.action("s0", "start");
  assert.equal(room.deck.length, 4); assert.equal(room.deck.filter(r => r === "thief").length, 1);
  assert.throws(() => gm.action("s0", "confirm"));
  gm.action("s0", "pick", { index: 0 });
  assert.throws(() => gm.action("s1", "pick", { index: 0 }));
  assert.throws(() => gm.action("s0", "pick", { index: 1 }));
  for (let i = 0; i < 4; i++) { if (i) gm.action(`s${i}`, "pick", { index: i }); gm.action(`s${i}`, "confirm"); }
  assert.equal(room.phase, "roll"); assert.ok(room.players.every(p => p.hour === null));
  for (let i = 0; i < 4; i++) gm.action(`s${i}`, "roll");
  assert.equal(room.phase, "night"); assert.equal(room.deadline, null);
  for (let i = 0; i < 4; i++) gm.action(`s${i}`, "night_done");
  assert.equal(room.phase, "recruit", "all empty hours advance without hanging");
});

test("mode 2 randomly assigns roles, rolls once, has no deadline and only host advances", () => {
  const g = setup(); start(g); const { gm, room } = g;
  assert.equal(room.players.filter(p => p.role === "thief").length, 1);
  assert.throws(() => gm.action("s0", "roll"));
  assert.throws(() => gm.action("s1", "next"));
  assert.equal(room.hour, 1); assert.equal(room.deadline, null);
  g.advanceTime(1000000); assert.equal(gm.tick().length, 0); assert.equal(room.hour, 1);
  gm.action("s0", "next"); assert.equal(room.hour, 2);
});

test("timed mode pauses and resumes exact remaining countdown with same private seat", () => {
  const g = setup("timed"); start(g); const { gm, room } = g;
  const p = room.players[0], creds = gm.credentials(room, p), role = p.role;
  g.advanceTime(10000); gm.disconnect("s0");
  assert.equal(gm.paused(room), true); assert.equal(room.remainingMs, 20000); assert.equal(room.deadline, null);
  assert.equal(room.hostId, room.players[1].id);
  g.advanceTime(90000); gm.tick(); assert.equal(room.hour, 1);
  assert.throws(() => gm.rejoin("bad", { ...creds, token: "x".repeat(36) }));
  gm.rejoin("new", creds); assert.equal(p.role, role); assert.equal(room.deadline, 121000);
  g.advanceTime(19999); gm.tick(); assert.equal(room.hour, 1);
  g.advanceTime(1); gm.tick(); assert.equal(room.hour, 2);
});

test("snapshots and actions keep role, dice, tokens, peek and theft private", () => {
  const g = setup(); start(g); const { gm, room } = g;
  room.players.forEach((p, i) => p.hour = i === 0 ? 1 : 2);
  const [solo, other] = room.players;
  gm.action("s0", "peek", { targetId: other.id });
  assert.throws(() => gm.action("s0", "peek", { targetId: room.players[2].id }));
  assert.throws(() => gm.action("s1", "peek", { targetId: solo.id }));
  const privateView = gm.snapshot(room, solo), publicView = gm.snapshot(room, other);
  assert.equal(privateView.me.peek!.hour, 2); assert.equal(publicView.me.peek, null);
  assert.deepEqual(publicView.me.companions, []);
  for (const row of publicView.players) assert.deepEqual(Object.keys(row).sort(), ["bot", "connected", "id", "name", "ready"]);
  assert.ok(!JSON.stringify(publicView).includes(solo.token));
  assert.equal(publicView.result, null);
  gm.action("s0", "next");
  assert.equal(gm.snapshot(room, other).me.companions.length, 4);
  assert.throws(() => gm.action("s1", "peek", { targetId: solo.id }));
  assert.throws(() => gm.action("s1", "steal"));
});

test("all roles vote once; all ballots count and result waits for everyone", () => {
  for (const outcome of ["thief", "henchman", "mouse", "tie"]) {
    const g = setup(); const { thief } = morning(g); const { gm, room } = g;
    assert.equal(room.players.filter(p => p.role === "henchman").length, 2);
    const mouse = room.players.find(p => p.role === "mouse")!;
    assert.deepEqual(gm.snapshot(room, mouse).me.team, []);
    assert.equal(gm.snapshot(room, thief).me.team.length, 3);
    gm.action("s0", "next");
    assert.ok(room.players.every(p => gm.snapshot(room, p).me.canVote));
    const voters = room.players;
    const target = room.players.find(p => p.role === outcome);
    voters.forEach((p, i) => {
      gm.action(p.socketId!, "vote", { targetId: outcome === "tie" ? room.players[i].id : target!.id });
      if (i < voters.length - 1) {
        assert.equal(room.phase, "vote");
        assert.equal(room.result, null);
        assert.equal(gm.snapshot(room, p).me.canVote, false);
        assert.throws(() => gm.action(p.socketId!, "vote", { targetId: mouse.id }));
      }
    });
    assert.equal(room.result!.players.reduce((sum, p) => sum + p.votes, 0), room.players.length);
    assert.equal(room.result!.winner, outcome === "thief" ? "mice" : "thieves");
    assert.equal(room.result!.tied, outcome === "tie");
    gm.action("s0", "restart"); assert.equal(room.phase, "lobby"); assert.equal(room.result, null);
  }
});

test("lost players can become bots without changing seat or role; old tokens are revoked", () => {
  const g = setup(); start(g); const { gm, room } = g;
  const p = room.players[2], creds = gm.credentials(room, p), role = p.role, id = p.id;
  gm.disconnect("s2"); gm.action("s0", "replace_bot", { targetId: p.id });
  assert.equal(gm.paused(room), false); assert.equal(p.bot, true); assert.equal(p.role, role); assert.equal(p.id, id);
  assert.throws(() => gm.rejoin("old", creds));
  assert.throws(() => gm.action("s1", "kick", { targetId: room.players[0].id }));
  const thief = room.players.find(p => p.role === "thief")!;
  gm.action("s0", "kick", { targetId: thief.id });
  assert.equal(room.players.length, 6); assert.equal(thief.bot, true);
  for (let i = 0; i < 6; i++) gm.action("s0", "next");
  assert.equal(room.phase, "meeting", "bot thief recruits automatically");
});

test("lobby bots fill empty seats, and host can remove connected players", () => {
  const gm = new CheeseManager();
  const { room } = gm.create("host", { playerName: "Host", roomName: "Bots", capacity: 4, mode: "manual" });
  for (let i = 0; i < 3; i++) gm.action("host", "add_bot");
  assert.throws(() => gm.action("host", "add_bot"));
  gm.action("host", "ready"); gm.action("host", "start");
  assert.equal(room.players.filter(p => p.confirmed).length, 3);
});
