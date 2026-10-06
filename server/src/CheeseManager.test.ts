import { test } from "node:test";
import assert from "node:assert/strict";
import { CheeseManager } from "./CheeseManager.js";
import { henchmenFor, type CheeseMode } from "../../shared/cheese.js";

function setup(mode: CheeseMode, count = 4) {
  const gm = new CheeseManager(() => 0, () => 1000);
  const { room } = gm.create("s0", {
    playerName: "P0", roomName: "Test", capacity: count, mode,
  });
  for (let i = 1; i < count; i++)
    gm.join(`s${i}`, { code: room.code, playerName: `P${i}` });
  for (let i = 0; i < count; i++) gm.action(`s${i}`, "ready");
  gm.action("s0", "start");
  return { gm, room };
}

function revealAndRoll(g: ReturnType<typeof setup>) {
  const { gm, room } = g;
  for (let i = 0; i < room.players.length; i++) {
    if (!room.players[i].role) gm.action(`s${i}`, "pick", { index: i });
    gm.action(`s${i}`, "confirm");
  }
  assert.equal(room.phase, "roll");
  for (let i = 0; i < room.players.length; i++) gm.action(`s${i}`, "roll");
}

test("henchmen scale with the player count", () => {
  assert.deepEqual([4, 5, 6, 7, 8, 9, 10, 11, 12].map(henchmenFor), [1, 1, 1, 2, 2, 2, 3, 3, 3]);
});

test("mode 1 keeps a peek visible until Ready and waits for everyone awake", () => {
  const g = setup("timed");
  revealAndRoll(g);
  const { gm, room } = g;
  const [solo, firstCompanion, secondCompanion, later] = room.players;
  Object.assign(solo, { hour: 1 });
  Object.assign(firstCompanion, { hour: 2 });
  Object.assign(secondCompanion, { hour: 2 });
  Object.assign(later, { hour: 4 });
  room.hour = 1;

  gm.action("s0", "peek", { targetId: firstCompanion.id });
  assert.deepEqual(gm.snapshot(room, solo).me.peek, { id: firstCompanion.id, hour: 2 });
  assert.equal(room.hour, 1, "viewing a time does not advance the night");

  gm.action("s0", "night_done");
  assert.equal(room.hour, 2, "Ready advances a solo wake");
  gm.action("s1", "night_done");
  assert.equal(room.hour, 2, "one of several awake players cannot advance alone");
  gm.action("s2", "night_done");
  assert.equal(room.hour, 4, "all awake players advance together and empty hours are skipped");
  assert.equal(room.deadline, null, "the night does not auto-advance on a timer");
});

test("mode 2 goes from roles to rolled times directly to voting", () => {
  const g = setup("manual");
  revealAndRoll(g);
  const { gm, room } = g;
  assert.equal(room.phase, "vote");
  assert.equal(room.players.filter(p => p.role === "thief").length, 1);
  assert.equal(room.players.filter(p => p.role === "henchman").length, 0);
  assert.throws(() => gm.action("s0", "next"));
  assert.throws(() => gm.action("s0", "recruit", { ids: [] }));
});

test("mode 1 requires the scaled number of henchmen", () => {
  const g = setup("timed", 6);
  revealAndRoll(g);
  const { gm, room } = g;
  room.players.forEach(p => { p.hour = 1; });
  room.hour = 1;
  for (let i = 0; i < room.players.length; i++) gm.action(`s${i}`, "night_done");
  assert.equal(room.phase, "recruit");
  const thief = room.players.find(p => p.role === "thief")!;
  const helper = room.players.find(p => p.role === "mouse")!;
  assert.throws(() => gm.action(thief.socketId!, "recruit", { ids: [] }));
  gm.action(thief.socketId!, "recruit", { ids: [helper.id] });
  assert.equal(room.players.filter(p => p.role === "henchman").length, 1);
  assert.equal(room.phase, "meeting");
});

test("snapshots keep other players' roles and rolled times private", () => {
  const g = setup("timed");
  revealAndRoll(g);
  const { gm, room } = g;
  const view = gm.snapshot(room, room.players[1]);
  for (const player of view.players)
    assert.deepEqual(Object.keys(player).sort(), ["bot", "connected", "id", "name", "ready"]);
  assert.ok(!JSON.stringify(view).includes(room.players[0].token));
  assert.equal(view.result, null);
});
