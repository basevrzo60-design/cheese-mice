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
    if (room.mode === "manual" && room.players[i].id === room.hostId) continue;
    if (!room.players[i].role) gm.action(`s${i}`, "pick", { index: i });
    gm.action(`s${i}`, "confirm");
  }
  assert.equal(room.phase, "roll");
  for (let i = room.mode === "manual" ? 1 : 0; i < room.players.length; i++) gm.action(`s${i}`, "roll");
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

test("mode 2 admin sees all roles and times but cannot play or be voted for", () => {
  const g = setup("manual", 6);
  assert.equal(g.room.players[0].role, null);
  assert.throws(() => g.gm.action("s0", "pick", { index: 0 }));
  assert.throws(() => g.gm.action("s0", "confirm"));
  revealAndRoll(g);
  const { gm, room } = g;
  assert.equal(room.phase, "meeting");
  assert.equal(room.players[0].hour, null);
  assert.throws(() => gm.action("s0", "roll"));
  assert.equal(room.players.filter(p => p.role === "thief").length, 1);
  const admin = gm.snapshot(room, room.players[0]);
  assert.equal(admin.participantCount, 5);
  assert.equal(admin.admin!.players.length, 5);
  assert.ok(admin.admin!.players.every(p => p.role && p.hour !== null));
  const other = gm.snapshot(room, room.players[1]);
  assert.equal(other.admin, null);
  assert.ok(other.players.every(p => !("role" in p) && !("hour" in p)));
  assert.equal(admin.me.canVote, false);
  assert.deepEqual(admin.me.team, []);
  assert.throws(() => gm.action("s0", "open_vote"), /บันทึก/);
  gm.action("s0", "admin_roles", { ids: [] });
  gm.action("s0", "open_vote");
  assert.throws(() => gm.action("s0", "vote", { targetId: room.players[1].id }));
  assert.throws(() => gm.action("s1", "vote", { targetId: room.hostId }));
  const thief = room.players.find(p => p.role === "thief")!;
  for (let i = 1; i < 6; i++) gm.action(`s${i}`, "vote", { targetId: thief.id });
  assert.equal(room.phase, "result");
  assert.equal(room.result!.winner, "mice");
  assert.equal(room.result!.players.length, 5);
  assert.ok(room.result!.players.every(p => p.id !== room.hostId));
  gm.action("s0", "restart");
  assert.equal(room.rolesSaved, false);
  assert.ok(room.players.every(p => p.role === null && p.hour === null));
});

test("mode 2 admin can save zero, many, and edited henchmen; invalid edits are atomic", () => {
  const g = setup("manual", 6);
  revealAndRoll(g);
  const { gm, room } = g;
  const thief = room.players.find(p => p.role === "thief")!;
  const mice = room.players.filter(p => p.role === "mouse");
  assert.throws(() => gm.action("s1", "admin_roles", { ids: [] }));
  for (const ids of [[room.hostId], [thief.id], ["unknown"], [mice[0].id, mice[0].id]])
    assert.throws(() => gm.action("s0", "admin_roles", { ids }));
  gm.action("s0", "admin_roles", { ids: mice.map(p => p.id) });
  assert.equal(gm.snapshot(room, room.players[0]).henchmenCount, 4);
  assert.equal(room.rolesSaved, true);
  assert.throws(() => gm.action("s0", "admin_roles", { ids: [mice[0].id, thief.id] }));
  assert.ok(mice.every(p => p.role === "henchman"));
  gm.action("s0", "admin_roles", { ids: [mice[1].id] });
  assert.equal(mice[0].role, "mouse");
  assert.equal(mice[1].role, "henchman");
  gm.action("s0", "admin_roles", { ids: [] });
  assert.ok(mice.every(p => p.role === "mouse"));
  gm.action("s0", "open_vote");
  assert.throws(() => gm.action("s0", "admin_roles", { ids: [mice[0].id] }));
});

test("mode 2 keeps the admin seat private across disconnect and rejoin", () => {
  const g = setup("manual");
  const { gm, room } = g;
  const admin = room.players[0];
  const credentials = gm.credentials(room, admin);
  gm.disconnect("s0");
  assert.equal(room.hostId, admin.id);
  assert.equal(gm.paused(room), true);
  assert.equal(gm.snapshot(room, room.players[1]).admin, null);
  gm.rejoin("admin-new", credentials);
  assert.equal(gm.paused(room), false);
  assert.ok(gm.snapshot(room, admin).admin);
});

test("mode 2 bots skip the admin and wait for saved roles before voting", () => {
  const gm = new CheeseManager(() => 0);
  const { room } = gm.create("admin", { playerName: "Admin", roomName: "Bots", capacity: 4, mode: "manual" });
  for (let i = 0; i < 3; i++) gm.action("admin", "add_bot");
  gm.action("admin", "start");
  assert.equal(room.phase, "meeting");
  assert.equal(room.players[0].role, null);
  gm.action("admin", "admin_roles", { ids: [] });
  gm.action("admin", "open_vote");
  assert.equal(room.phase, "result");
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

test("theft is visible to awake witnesses and later players but hidden from sleepers", () => {
  const g = setup("timed");
  revealAndRoll(g);
  const { gm, room } = g;
  const [early, thief, witness, later] = room.players;
  room.players.forEach(p => { p.role = "mouse"; });
  thief.role = "thief";
  [early.hour, thief.hour, witness.hour, later.hour] = [1, 2, 2, 4];
  room.hour = 1;
  assert.equal(gm.snapshot(room, early).me.tableCheesePresent, true);
  assert.equal(gm.snapshot(room, later).me.tableCheesePresent, null);
  gm.action("s0", "night_done");
  assert.equal(gm.snapshot(room, witness).me.tableCheesePresent, true);
  assert.equal(gm.snapshot(room, witness).me.witnessedTheft, false);
  gm.action("s1", "steal");
  for (const p of [thief, witness]) {
    assert.equal(gm.snapshot(room, p).me.tableCheesePresent, false);
    assert.equal(gm.snapshot(room, p).me.witnessedTheft, true);
  }
  assert.equal(gm.snapshot(room, witness).me.cheeseStolen, false);
  for (const p of [early, later]) {
    assert.equal(gm.snapshot(room, p).me.tableCheesePresent, null);
    assert.equal(gm.snapshot(room, p).me.witnessedTheft, false);
  }
  assert.throws(() => gm.action("s2", "steal"));
  assert.throws(() => gm.action("s1", "steal"));
  gm.action("s1", "night_done");
  gm.action("s2", "night_done");
  assert.equal(room.hour, 4);
  assert.equal(gm.snapshot(room, later).me.tableCheesePresent, false);
  assert.equal(gm.snapshot(room, later).me.witnessedTheft, false);
  assert.equal(gm.snapshot(room, early).me.tableCheesePresent, null);
  gm.action("s3", "night_done");
  assert.equal(gm.snapshot(room, later).me.tableCheesePresent, false);
  room.phase = "result";
  gm.action("s0", "restart");
  assert.equal(gm.snapshot(room, early).me.tableCheesePresent, true);
  assert.equal(gm.snapshot(room, witness).me.witnessedTheft, false);
});

test("a bot thief also removes cheese and notifies the human waking alongside it", () => {
  const g = setup("timed");
  revealAndRoll(g);
  const { gm, room } = g;
  room.players.forEach(p => { p.role = "mouse"; p.hour = 4; });
  Object.assign(room.players[1], { role: "thief", bot: true, socketId: null, hour: 2 });
  room.players[2].hour = 2;
  room.hour = 2;
  gm.settle(room);
  assert.equal(room.hour, 2);
  assert.equal(gm.snapshot(room, room.players[2]).me.witnessedTheft, true);
  assert.equal(gm.snapshot(room, room.players[2]).me.tableCheesePresent, false);
  assert.equal(gm.snapshot(room, room.players[0]).me.tableCheesePresent, null);
});

for (const mode of ["timed", "manual"] as const) {
  test(`room chat in ${mode} mode is isolated and uses the authenticated sender`, () => {
    let now = 1000;
    const gm = new CheeseManager(() => 0, () => now);
    const { room, player } = gm.create("host", { playerName: "Host", roomName: "Chat", capacity: 4, mode });
    const member = gm.join("member", { code: room.code, playerName: "Member" }).player;
    const other = gm.create("other", { playerName: "Other", roomName: "Other room", capacity: 4, mode });
    assert.throws(() => gm.action("stranger", "chat", { text: "Hello" }));
    gm.action("host", "chat", { text: "  สวัสดีทุกคน  ", name: "Impostor", playerId: member.id });
    const message = gm.snapshot(room, member).chat[0];
    assert.equal(message.text, "สวัสดีทุกคน");
    assert.equal(message.name, "Host");
    assert.equal(message.playerId, player.id);
    assert.deepEqual(Object.keys(message).sort(), ["id", "name", "playerId", "sentAt", "text"]);
    assert.deepEqual(gm.snapshot(other.room, other.player).chat, []);
    assert.throws(() => gm.action("host", "chat", { text: "Spam" }), /เร็ว/);
    assert.throws(() => gm.action("member", "chat", { text: "  " }));
    assert.throws(() => gm.action("member", "chat", { text: "a".repeat(501) }));
    now += 700;
    gm.action("member", "chat", { text: "<script>alert('test')</script>" });
    assert.equal(room.chat[1].text, "<script>alert('test')</script>", "chat is plain text, not markup");
    const credentials = gm.credentials(room, member);
    gm.disconnect("member"); gm.rejoin("member-new", credentials);
    assert.equal(gm.snapshot(room, member).chat.length, 2);
    for (let i = 0; i < 105; i++) { now += 700; gm.action("host", "chat", { text: `Message ${i}` }); }
    assert.equal(room.chat.length, 100);
    assert.equal(room.chat[0].text, "Message 5");
    assert.equal(room.chat.at(-1)!.text, "Message 104");
  });
}

test("chat remains available while paused and never settles or advances the game", () => {
  const { gm, room } = setup("manual");
  gm.disconnect("s1");
  const phase = room.phase;
  gm.action("s0", "chat", { text: "รอเพื่อนกลับมา" });
  assert.equal(room.phase, phase);
  assert.equal(gm.paused(room), true);
  assert.equal(room.chat[0].text, "รอเพื่อนกลับมา");
});
