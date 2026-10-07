import { randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { henchmenFor, type CheeseMode, type CheesePhase, type CheeseRole, type CheeseView } from "../../shared/cheese.js";

type Player = {
  id: string; token: string; socketId: string | null; name: string; bot: boolean;
  ready: boolean; role: CheeseRole | null; card: number | null; hour: number | null;
  confirmed: boolean; nightDone: boolean; peek: { id: string; hour: number } | null;
  cheeseStolen: boolean; vote: string | null;
};
export type CheeseRoom = {
  code: string; name: string; capacity: number; mode: CheeseMode; hostId: string;
  phase: CheesePhase; players: Player[]; deck: CheeseRole[]; hour: number;
  timerSeconds: number; deadline: number | null; remainingMs: number | null;
  lastActive: number; result: CheeseView["result"];
  rolesSaved: boolean;
};

export class CheeseManager {
  rooms = new Map<string, CheeseRoom>();
  constructor(private rng: (max: number) => number = randomInt, private now: () => number = Date.now) {}
  private text(value: unknown, max: number) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw Error("กรอกข้อมูลให้ถูกต้อง");
    return value.trim();
  }
  private person(name: string, socketId: string | null, bot = false): Player {
    return { id: randomUUID(), token: randomUUID(), socketId, name, bot, ready: bot,
      role: null, card: null, hour: null, confirmed: false, nightDone: false, peek: null, cheeseStolen: false, vote: null };
  }
  private free(socketId: string) {
    for (const room of this.rooms.values()) if (room.players.some(p => p.socketId === socketId)) throw Error("คุณอยู่ในห้องแล้ว");
  }
  auth(socketId: string) {
    for (const room of this.rooms.values()) {
      const player = room.players.find(p => p.socketId === socketId);
      if (player) return { room, player };
    }
    throw Error("กรุณาเข้าห้องก่อน");
  }
  credentials(room: CheeseRoom, p: Player) { return { code: room.code, id: p.id, token: p.token }; }
  create(socketId: string, data: Record<string, unknown>) {
    this.free(socketId);
    if (!Number.isInteger(data.capacity) || Number(data.capacity) < 4 || Number(data.capacity) > 12) throw Error("ห้องรองรับ 4–12 คน");
    if (data.mode !== "timed" && data.mode !== "manual") throw Error("เลือกโหมดเกม");
    const player = this.person(this.text(data.playerName, 24), socketId);
    const name = this.text(data.roomName, 40);
    let code: string;
    do { code = String(randomInt(100000, 1000000)); } while (this.rooms.has(code));
    const room: CheeseRoom = { code, name, capacity: Number(data.capacity), mode: data.mode as CheeseMode,
      hostId: player.id, players: [player], phase: "lobby", deck: [], hour: 0,
      timerSeconds: data.mode === "timed" ? 30 : 0, deadline: null, remainingMs: null, lastActive: this.now(), result: null, rolesSaved: false };
    this.rooms.set(code, room);
    return { room, player };
  }
  join(socketId: string, data: Record<string, unknown>) {
    this.free(socketId);
    const room = this.rooms.get(this.text(data.code, 6));
    if (!room) throw Error("ไม่พบห้อง");
    if (room.phase !== "lobby") throw Error("เกมเริ่มแล้ว ใช้ปุ่มคืนที่นั่งเดิม");
    if (room.players.length >= room.capacity) throw Error("ห้องเต็ม");
    const name = this.text(data.playerName, 24);
    if (room.players.some(p => p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw Error("ชื่อซ้ำในห้อง");
    const player = this.person(name, socketId);
    room.players.push(player); room.lastActive = this.now();
    return { room, player };
  }
  rejoin(socketId: string, data: Record<string, unknown>) {
    const room = this.rooms.get(String(data.code));
    const player = room?.players.find(p => p.id === data.id && !p.bot);
    if (!room || !player || typeof data.token !== "string" || Buffer.byteLength(data.token) !== Buffer.byteLength(player.token)
      || !timingSafeEqual(Buffer.from(data.token), Buffer.from(player.token))) throw Error("คืนที่นั่งไม่ได้ ห้องถูกปิดหรือที่นั่งถูกแทนด้วยบอทแล้ว");
    if (player.socketId === socketId) return { room, player, previousSocketId: null };
    this.free(socketId);
    const previousSocketId = player.socketId;
    player.socketId = socketId;
    this.assignHost(room); this.resume(room); room.lastActive = this.now();
    return { room, player, previousSocketId };
  }
  private assignHost(room: CheeseRoom) {
    // Keep the moderator's seat and private access stable until the round ends.
    if (room.mode === "manual" && !["lobby", "result"].includes(room.phase)) return;
    if (!room.players.some(p => p.id === room.hostId && p.socketId && !p.bot)) {
      room.hostId = room.players.find(p => p.socketId && !p.bot)?.id ?? room.hostId;
    }
  }
  paused(room: CheeseRoom) {
    return !["lobby", "result"].includes(room.phase) && room.players.some(p => !p.bot && !p.socketId);
  }
  private resume(room: CheeseRoom) {
    if (!this.paused(room) && room.remainingMs !== null) {
      room.deadline = this.now() + room.remainingMs; room.remainingMs = null;
    }
  }
  disconnect(socketId: string) {
    let found;
    try { found = this.auth(socketId); } catch { return null; }
    const { room, player } = found;
    player.socketId = null;
    if (room.deadline !== null) { room.remainingMs = Math.max(0, room.deadline - this.now()); room.deadline = null; }
    this.assignHost(room); room.lastActive = this.now();
    return room;
  }
  leave(socketId: string) {
    const { room, player } = this.auth(socketId);
    if (!["lobby", "result"].includes(room.phase)) throw Error("ระหว่างเกมให้เจ้าของห้องแทนที่ด้วยบอทก่อน");
    room.players = room.players.filter(p => p !== player);
    this.assignHost(room);
    if (!room.players.some(p => !p.bot)) this.rooms.delete(room.code);
    return room;
  }
  private setPhase(room: CheeseRoom, phase: CheesePhase) {
    room.phase = phase; room.remainingMs = null;
    room.deadline = null;
    if (phase === "night") room.players.forEach(p => p.nightDone = false);
  }
  private draw(room: CheeseRoom, p: Player, index: number) {
    if (p.card !== null || !Number.isInteger(index) || index < 0 || index >= room.deck.length
      || room.players.some(q => q.card === index)) throw Error("การ์ดถูกเลือกแล้ว");
    p.card = index; p.role = room.deck[index];
  }
  private advanceNight(room: CheeseRoom) {
    do {
      if (room.hour === 6) { this.setPhase(room, "recruit"); return; }
      room.hour++; this.setPhase(room, "night");
    } while (!room.players.some(p => p.hour === room.hour));
  }
  private finish(room: CheeseRoom) {
    const voters = this.participants(room);
    const rows = voters.map(p => ({ id: p.id, role: p.role!, hour: p.hour!, votes: voters.filter(v => v.vote === p.id).length }));
    const max = Math.max(...rows.map(p => p.votes));
    const top = rows.filter(p => p.votes === max);
    room.result = { winner: top.length === 1 && top[0].role === "thief" ? "mice" : "thieves",
      accused: top.length === 1 ? top[0].id : null, tied: top.length !== 1, players: rows };
    this.setPhase(room, "result");
  }
  private recruit(room: CheeseRoom, p: Player, ids: unknown) {
    if (p.role !== "thief") throw Error("เฉพาะหนูโจร");
    const count = henchmenFor(room.players.length);
    if (!Array.isArray(ids) || ids.length !== count || new Set(ids).size !== count
      || ids.some(id => !room.players.some(q => q.id === id && q.role === "mouse"))) throw Error(`เลือกหนูธรรมดา ${count} คนที่ไม่ซ้ำกัน`);
    room.players.forEach(q => { if (ids.includes(q.id)) q.role = "henchman"; });
    this.setPhase(room, "meeting");
  }
  action(socketId: string, event: string, data: Record<string, unknown> = {}) {
    const { room, player: p } = this.auth(socketId);
    const host = () => { if (room.hostId !== p.id) throw Error("เฉพาะเจ้าของห้อง"); };
    const phase = (value: CheesePhase) => { if (room.phase !== value) throw Error("ยังไม่ใช่ขั้นตอนนี้"); };
    const participant = () => { if (room.mode === "manual" && p.id === room.hostId) throw Error("แอดมินไม่ได้รับบทบาท ทอยเวลา หรือโหวต"); };
    const awake = () => { phase("night"); if (p.hour !== room.hour || p.nightDone) throw Error("ยังไม่ใช่เวลาตื่นของคุณ หรือคุณจบขั้นตอนแล้ว"); };
    if (this.paused(room) && !["kick", "replace_bot"].includes(event)) throw Error("เกมหยุดรอผู้เล่นกลับมา เจ้าของห้องสามารถแทนที่ด้วยบอทได้");
    switch (event) {
      case "timer": host(); phase("lobby");
        if (room.mode !== "timed" || !Number.isInteger(data.seconds) || Number(data.seconds) < 0 || Number(data.seconds) > 600
          || Number(data.seconds) > 0 && Number(data.seconds) < 10) throw Error("ตั้งเวลา 10–600 วินาที หรือ 0 เพื่อปิดเวลา");
        room.timerSeconds = Number(data.seconds); break;
      case "ready": phase("lobby"); p.ready = !p.ready; break;
      case "add_bot": {
        host(); phase("lobby"); if (room.players.length >= room.capacity) throw Error("ห้องเต็ม");
        let n = 1; while (room.players.some(q => q.name === `บอท ${n}`)) n++;
        room.players.push(this.person(`บอท ${n}`, null, true)); break;
      }
      case "kick": case "replace_bot": {
        host(); const target = room.players.find(q => q.id === data.targetId && q !== p);
        if (!target) throw Error("เลือกผู้เล่นคนอื่น");
        if (event === "replace_bot" && (target.socketId || target.bot)) throw Error("แทนที่ได้เฉพาะผู้เล่นที่หลุด");
        target.socketId = null; target.token = randomUUID();
        if (["lobby", "result"].includes(room.phase)) room.players = room.players.filter(q => q !== target);
        else { target.bot = true; target.name = `${target.name} (บอท)`; target.ready = true; }
        this.resume(room); break;
      }
      case "start": {
        host(); phase("lobby");
        if (room.players.length < 4 || this.participants(room).some(q => !q.ready) || room.players.some(q => !q.bot && !q.socketId)) throw Error("อย่างน้อย 4 ที่นั่ง และผู้เล่นทุกคนต้องพร้อม");
        room.deck = this.participants(room).map((_, i) => i === 0 ? "thief" : "mouse");
        for (let i = room.deck.length - 1; i > 0; i--) { const j = this.rng(i + 1); [room.deck[i], room.deck[j]] = [room.deck[j], room.deck[i]]; }
        room.players.forEach(q => Object.assign(q, { role: null, card: null, hour: null, confirmed: false,
          nightDone: false, peek: null, cheeseStolen: false, vote: null }));
        if (room.mode === "manual") this.participants(room).forEach((q, i) => this.draw(room, q, i));
        room.hour = 0; room.result = null; room.rolesSaved = false; this.setPhase(room, "reveal"); break;
      }
      case "pick": participant(); phase("reveal"); this.draw(room, p, Number(data.index)); break;
      case "confirm": participant(); phase("reveal"); if (!p.role) throw Error("เลือกการ์ดก่อน"); p.confirmed = true; break;
      case "roll": participant(); phase("roll"); if (p.hour !== null) throw Error("ทอยไปแล้ว"); p.hour = this.rng(6) + 1; break;
      case "peek": {
        awake(); if (room.players.filter(q => q.hour === room.hour).length !== 1 || p.peek) throw Error("ดูเวลาได้ 1 คน เฉพาะเมื่อตื่นคนเดียว");
        const target = room.players.find(q => q.id === data.targetId && q !== p);
        if (!target || target.hour === null) throw Error("เลือกผู้เล่นคนอื่น");
        p.peek = { id: target.id, hour: target.hour }; break;
      }
      case "steal": awake(); if (p.role !== "thief" || p.cheeseStolen) throw Error("เฉพาะหนูโจรที่ยังไม่ได้ขโมยชีส"); p.cheeseStolen = true; break;
      case "night_done": awake(); p.nightDone = true; break;
      case "recruit": phase("recruit"); this.recruit(room, p, data.ids); break;
      case "next": {
        host();
        if (room.mode !== "manual") throw Error("เมนูนี้สำหรับโหมด 2");
        throw Error("โหมด 2 จะเปลี่ยนไปยังขั้นตอนถัดไปเมื่อทุกคนพร้อม");
      }
      case "admin_roles": {
        host();
        if (room.mode !== "manual" || !["reveal", "roll", "meeting"].includes(room.phase)) throw Error("แก้ลูกสมุนได้เฉพาะโหมด 2 ก่อนเปิดโหวต");
        const ids = data.ids;
        const players = this.participants(room);
        if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !players.some(q => q.id === id && q.role && q.role !== "thief"))) throw Error("เลือกลูกสมุนจากผู้เล่นที่ไม่ใช่หนูโจร");
        players.forEach(q => { if (q.role !== "thief") q.role = ids.includes(q.id) ? "henchman" : "mouse"; });
        room.rolesSaved = true; break;
      }
      case "open_vote": host(); phase("meeting");
        if (room.mode === "manual" && !room.rolesSaved) throw Error("บันทึกลูกสมุนก่อนเปิดโหวต");
        this.setPhase(room, "vote"); break;
      case "vote": participant(); phase("vote");
        if (p.vote) throw Error("คุณลงคะแนนแล้ว");
        if (!this.participants(room).some(q => q.id === data.targetId)) throw Error("เลือกผู้ต้องสงสัย");
        p.vote = String(data.targetId); break;
      case "restart": host(); phase("result"); this.setPhase(room, "lobby"); room.result = null; room.deck = []; room.hour = 0; room.rolesSaved = false;
        room.players.forEach(q => Object.assign(q, { ready: q.bot, role: null, hour: null, card: null, confirmed: false, vote: null, peek: null, cheeseStolen: false })); break;
      default: throw Error("ไม่รู้จักคำสั่ง");
    }
    room.lastActive = this.now(); this.settle(room);
    return room;
  }
  settle(room: CheeseRoom) {
    if (this.paused(room)) return;
    for (let turn = 0; turn < 16; turn++) {
      const phase = room.phase, hour = room.hour;
      for (const p of this.participants(room).filter(q => q.bot)) {
        if (phase === "reveal") {
          if (!p.role) this.draw(room, p, room.deck.findIndex((_, i) => !room.players.some(q => q.card === i)));
          p.confirmed = true;
        } else if (phase === "roll" && p.hour === null) p.hour = this.rng(6) + 1;
        else if (phase === "night" && p.hour === room.hour) {
          if (p.role === "thief") p.cheeseStolen = true;
          if (room.players.filter(q => q.hour === room.hour).length === 1 && !p.peek) {
            const targets = room.players.filter(q => q !== p); const target = targets[this.rng(targets.length)];
            p.peek = { id: target.id, hour: target.hour! };
          }
          p.nightDone = true;
        } else if (phase === "recruit" && p.role === "thief") {
          const pool = room.players.filter(q => q.role === "mouse");
          const ids = Array.from({ length: henchmenFor(room.players.length) }, () =>
            pool.splice(this.rng(pool.length), 1)[0].id,
          );
          this.recruit(room, p, ids);
        } else if (phase === "vote" && !p.vote) {
          const pool = room.players.filter(q => q !== p); p.vote = pool[this.rng(pool.length)].id;
        }
      }
      if (room.mode === "timed") {
        if (room.phase === "reveal" && room.players.every(p => p.confirmed)) this.setPhase(room, "roll");
        else if (room.phase === "roll" && room.players.every(p => p.hour !== null)) { room.hour = 0; this.advanceNight(room); }
        else if (room.phase === "night") {
          const awake = room.players.filter(p => p.hour === room.hour);
          if (awake.length && awake.every(p => p.nightDone)) this.advanceNight(room);
        }
      } else if (room.mode === "manual") {
        if (room.phase === "reveal" && this.participants(room).every(p => p.confirmed)) this.setPhase(room, "roll");
        else if (room.phase === "roll" && this.participants(room).every(p => p.hour !== null)) this.setPhase(room, "meeting");
      }
      if (room.phase === "vote" && this.participants(room).every(p => p.vote)) this.finish(room);
      if (room.phase === phase && room.hour === hour) break;
    }
  }
  tick() {
    const changed: CheeseRoom[] = [];
    for (const room of this.rooms.values()) {
      if (!room.players.some(p => p.socketId) && this.now() - room.lastActive > 86400000) { this.rooms.delete(room.code); continue; }
      if (!this.paused(room) && room.deadline !== null && room.deadline <= this.now()) {
        if (room.phase === "night") this.advanceNight(room);
        else if (room.phase === "meeting") this.setPhase(room, "vote");
        this.settle(room); changed.push(room);
      }
    }
    return changed;
  }
  private participants(room: CheeseRoom) {
    return room.players.filter(p => room.mode !== "manual" || p.id !== room.hostId);
  }
  snapshot(room: CheeseRoom, p: Player): CheeseView {
    const players = this.participants(room);
    const isAdmin = room.mode === "manual" && room.hostId === p.id;
    const awake = room.phase === "night" && p.hour === room.hour;
    const companions = awake ? room.players.filter(q => q !== p && q.hour === room.hour).map(q => q.id) : [];
    const recruited = ["meeting", "vote", "result"].includes(room.phase);
    const thief = room.players.find(q => q.cheeseStolen);
    // Sleeping players must not learn when the cheese disappears.
    const tableCheesePresent = room.phase === "night" && !awake ? null : !thief;
    const witnessedTheft = awake && !!thief && thief.hour === p.hour;
    return { code: room.code, name: room.name, capacity: room.capacity, mode: room.mode, hostId: room.hostId,
      phase: room.phase, hour: room.hour, deadline: room.deadline, timerSeconds: room.timerSeconds, paused: this.paused(room),
      players: room.players.map(q => ({ id: q.id, name: q.name, connected: q.bot || !!q.socketId, ready: q.ready, bot: q.bot })),
      confirmedCount: players.filter(q => q.confirmed).length, voteCount: players.filter(q => q.vote).length,
      participantCount: players.length,
      admin: isAdmin ? { rolesSaved: room.rolesSaved, players: players.map(q => ({ id: q.id, role: q.role, hour: q.hour, confirmed: q.confirmed, vote: q.vote })) } : null,
      henchmenCount: room.mode === "manual" ? players.filter(q => q.role === "henchman").length : henchmenFor(room.players.length), cards: room.deck.map((_, index) => ({ index, taken: room.players.some(q => q.card === index) })),
      me: { id: p.id, role: p.role, hour: p.hour, confirmed: p.confirmed, rolled: p.hour !== null, awake, companions,
        canPeek: awake && companions.length === 0 && !p.peek && !p.nightDone, peek: p.peek, cheeseStolen: p.cheeseStolen,
        tableCheesePresent, witnessedTheft,
        nightDone: p.nightDone, team: recruited && p.role && p.role !== "mouse" ? players.filter(q => q.role && q.role !== "mouse").map(q => q.id) : [],
        voted: !!p.vote, canVote: !isAdmin && room.phase === "vote" && !p.vote }, result: room.result };
  }
}
