import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Sun, Dumbbell, Target, Settings, Check, Plus, Minus, Trash2, Play, Pause, RotateCcw,
  Download, Upload, X, Timer, ChevronDown, ChevronUp, Pencil, Zap, Volume2, VolumeX
} from 'lucide-react';

/* ============================================================================
   КОНСТАНТЫ И УТИЛИТЫ
   ========================================================================== */
const STORAGE_KEY = 'm_protocol_state_v1';
const CFG_KEY = 'm_protocol_supabase_cfg';
const TABLE = 'tracker_state';
const BIRTHDAY = '2026-12-16';
const WATER_GOAL = 2000;

const HABITS = [
  { k: 'protein', t: 'Белок 3/3' },
  { k: 'dessert', t: 'Правило десерта' },
  { k: 'water', t: 'Вода 2 л' },
  { k: 'clean', t: 'Чистый вечер' }
];

const pad = (n) => String(n).padStart(2, '0');
const ds = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ds(d); };
const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 86400000);
const fmtLong = (s) => parse(s).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = (s) => parse(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
const fmtFull = (s) => parse(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
const uid = () => Math.random().toString(36).slice(2, 10);
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const mmss = (sec) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;

const card = 'rounded-2xl bg-card border border-line p-4';
const lbl = 'text-[11px] uppercase tracking-widest text-zinc-500';
const mono = 'font-mono tabular-nums';
const btn = 'rounded-xl border border-line bg-[#18181b] hover:bg-[#1f1f22] text-zinc-200 text-xs font-medium transition';
const btnP = 'rounded-xl bg-zinc-50 hover:bg-white text-zinc-950 text-xs font-semibold transition';
const inp = 'w-full bg-base border border-line rounded-lg px-2.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500';
const inpM = `${inp} ${mono}`;

const beep = () => {
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    const ctx = new C();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.15;
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.18);
    });
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  } catch { /* noop */ }
};

/* ============================================================================
   ПРОГРАММА ТРЕНИРОВОК
   ========================================================================== */
const DEFAULT_PROGRAM = [
  {
    id: 'day1', short: 'Пн · Ноги, грудь', title: 'День 1 — Ноги и Грудь',
    exercises: [
      { id: 'd1e1', name: 'Присед со штангой', target: '4×10' },
      { id: 'd1e2', name: 'Жим ногами', target: '4×12' },
      { id: 'd1e3', name: 'Сгибания по одной ноге', target: '4×10' },
      { id: 'd1e4', name: 'Жим штанги под углом', target: '4×8' },
      { id: 'd1e5', name: 'Жим гантелей горизонтально', target: '4×6' },
      { id: 'd1e6', name: 'Разводка с гантелями 30°', target: '4×10' }
    ]
  },
  {
    id: 'day2', short: 'Ср · Спина, бицепс бедра', title: 'День 2 — Спина и Бицепс бедра',
    exercises: [
      { id: 'd2e1', name: 'Гиперэкстензии', target: '4×10' },
      { id: 'd2e2', name: 'Румынская тяга', target: '4×8' },
      { id: 'd2e3', name: 'Тяга гантелей лёжа вниз лицом', target: '4×10' },
      { id: 'd2e4', name: 'Тяга верхнего хаммера обратным хватом', target: '4×10' },
      { id: 'd2e5', name: 'Верхняя тяга широким хватом', target: '4×10' },
      { id: 'd2e6', name: 'Тяга нижнего хаммера обратным хватом', target: '4×10' },
      { id: 'd2e7', name: 'Шраги', target: '4×12' }
    ]
  },
  {
    id: 'day3', short: 'Сб · Плечи, руки', title: 'День 3 — Плечи и Руки',
    exercises: [
      { id: 'd3e1', name: 'Разводка гантелей на заднюю дельту', target: '4×10' },
      { id: 'd3e2', name: 'Жим гантелей сидя', target: '4×8' },
      { id: 'd3e3', name: 'Жим в хаммере на плечи', target: '4×12' },
      { id: 'd3e4', name: 'Разводка стоя', target: '4×10' },
      { id: 'd3e5', name: 'Суперсет: Молотки + Французский жим с гантелями', target: '4×10 + 4×10', isSuperset: true, partA: 'Сгибания рук молотки', partB: 'Французский жим' },
      { id: 'd3e6', name: 'Суперсет: Сгибания + Разгибания рук в кроссовере', target: '4×10 + 4×10', isSuperset: true, partA: 'Сгибания в кроссовере', partB: 'Разгибания в кроссовере' }
    ]
  }
];
const PLAN_DOW = { 1: 'day1', 3: 'day2', 6: 'day3' }; // getDay(): Пн=1, Ср=3, Сб=6
const DOW_NAME = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/* ============================================================================
   СТЕЙТ
   ========================================================================== */
const EMPTY_LOG = { protein: 0, dessert: false, waterMl: 0, clean: false, tasks: [] };

const defaultState = () => ({
  v: 1,
  updatedAt: 0,
  startDate: ds(),
  sos: 'Вспомни то чувство, когда ты идешь домой по снегу после жесткой тренировки, мышцы гудят, а ты победил свою лень. Съешь сначала нормальный белок. Договорись с собой просто дойти до зала и сделать разминку.',
  logs: {},
  program: DEFAULT_PROGRAM,
  draft: null,
  history: [],
  height: 166,
  body: [{ id: 'b0', date: ds(), weight: 65.0, fat: 23.5 }],
  pull: { max: 0, log: [] }
});

const normalize = (s) => {
  const d = defaultState();
  const o = { ...d, ...(s || {}) };
  o.pull = { ...d.pull, ...(o.pull || {}) };
  if (!Array.isArray(o.body) || !o.body.length) o.body = d.body;
  if (!Array.isArray(o.program) || !o.program.length) o.program = d.program;
  if (!Array.isArray(o.history)) o.history = [];
  if (!o.logs || typeof o.logs !== 'object') o.logs = {};
  return o;
};

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* noop */ }
  return defaultState();
};

const loadCfg = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
    return {
      url: raw.url || import.meta.env.VITE_SUPABASE_URL || '',
      key: raw.key || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    };
  } catch {
    return { url: import.meta.env.VITE_SUPABASE_URL || '', key: import.meta.env.VITE_SUPABASE_ANON_KEY || '' };
  }
};

/* ============================================================================
   ЛОГИКА ПРИВЫЧЕК И СТАТИСТИКИ
   ========================================================================== */
const habitDone = (l, k) => {
  if (!l) return false;
  if (k === 'protein') return (l.protein || 0) >= 3;
  if (k === 'dessert') return !!l.dessert;
  if (k === 'water') return (l.waterMl || 0) >= WATER_GOAL;
  return !!l.clean;
};
const dayPct = (l) => HABITS.filter((h) => habitDone(l, h.k)).length * 25;

const setTon = (ex, s) => (parseFloat(s.w) || 0) * (parseFloat(s.r) || 0) + (ex.isSuperset ? (parseFloat(s.wB) || 0) * (parseFloat(s.rB) || 0) : 0);
const tonnageOf = (exs) => exs.reduce((a, e) => a + e.sets.filter((s) => s.type === 'R' && s.done).reduce((b, s) => b + setTon(e, s), 0), 0);

function streaks(state) {
  const today = ds();
  let run = 0, best = 0, full = 0, d = state.startDate;
  while (d <= today) {
    const p = dayPct(state.logs[d]);
    if (p === 100) full++;
    if (p >= 75) { run++; best = Math.max(best, run); }
    else if (d !== today) run = 0;
    d = addDays(d, 1);
  }
  return { cur: run, best, full };
}

function periodStats(state, days) {
  const today = ds();
  let from = addDays(today, -(days - 1));
  if (from < state.startDate) from = state.startDate;
  const n = Math.max(1, diffDays(today, from) + 1);
  const per = { protein: 0, dessert: 0, water: 0, clean: 0 };
  let ml = 0;
  for (let i = 0; i < n; i++) {
    const l = state.logs[addDays(from, i)];
    if (!l) continue;
    HABITS.forEach((h) => { if (habitDone(l, h.k)) per[h.k]++; });
    ml += l.waterMl || 0;
  }
  const w = state.history.filter((h) => h.date >= from && h.date <= today);
  const total = Object.values(per).reduce((a, b) => a + b, 0);
  return {
    n, per, ml, workouts: w.length,
    ton: w.reduce((a, h) => a + h.tonnage, 0),
    km: w.reduce((a, h) => a + (h.cardio ? h.cardio.dist : 0), 0),
    disc: Math.round((total / (n * 4)) * 100)
  };
}

function lifetime(state) {
  let habits = 0, ml = 0;
  Object.values(state.logs).forEach((l) => {
    habits += HABITS.filter((h) => habitDone(l, h.k)).length;
    ml += l.waterMl || 0;
  });
  const xp = habits * 10 + state.history.length * 50;
  const level = Math.floor(xp / 300) + 1;
  return {
    habits, ml, xp, level, into: xp % 300,
    workouts: state.history.length,
    ton: state.history.reduce((a, h) => a + h.tonnage, 0),
    km: state.history.reduce((a, h) => a + (h.cardio ? h.cardio.dist : 0), 0),
    sets: state.history.reduce((a, h) => a + h.exercises.reduce((b, e) => b + e.sets.length, 0), 0),
    days: Math.max(1, diffDays(ds(), state.startDate) + 1)
  };
}
const RANKS = [[1, 'Старт'], [3, 'База'], [5, 'Режим'], [8, 'Стабильность'], [12, 'Железо'], [17, 'Мастер'], [23, 'Легенда']];
const rankOf = (lvl) => RANKS.filter((r) => lvl >= r[0]).pop()[1];

function records(history) {
  const best = {};
  history.forEach((h) => h.exercises.forEach((e) => {
    if (e.isSuperset) return;
    e.sets.forEach((s) => {
      if (s.type !== 'R') return;
      const w = parseFloat(s.w) || 0, r = parseFloat(s.r) || 0;
      if (!w || !r) return;
      const b = best[e.name];
      if (!b || w > b.w || (w === b.w && r > b.r)) best[e.name] = { w, r, date: h.date };
    });
  }));
  return Object.entries(best).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.w - a.w);
}

function lastWorkout(history, dayId) {
  return history.filter((h) => h.dayId === dayId).sort((a, b) => b.ts - a.ts)[0] || null;
}

function hintFor(ex, last) {
  const le = last && last.exercises.find((e) => e.id === ex.id);
  if (!le) return null;
  const ws = le.sets.filter((s) => s.type === 'R' && s.done);
  if (!ws.length) return null;
  const tReps = parseInt((ex.target.split('×')[1] || '10'), 10) || 10;
  const one = (wk, rk) => {
    const arr = ws.map((s) => ({ w: parseFloat(s[wk]) || 0, r: parseFloat(s[rk]) || 0 })).filter((s) => s.r > 0);
    if (!arr.length) return null;
    const top = arr.reduce((a, b) => (b.w > a.w || (b.w === a.w && b.r > a.r) ? b : a));
    const minR = Math.min(...arr.filter((s) => s.w === top.w).map((s) => s.r));
    return {
      prev: arr.map((s) => `${s.w}×${s.r}`).join(' · '),
      goal: minR >= tReps ? `${r1(top.w + 2.5)} кг × ${tReps}` : `${top.w} кг × ${Math.min(minR + 1, tReps)}+`
    };
  };
  return { a: one('w', 'r'), b: ex.isSuperset ? one('wB', 'rB') : null, note: le.note, date: last.date };
}

function mkSets(ex, last) {
  const n = parseInt(ex.target, 10) || 4;
  const le = last && last.exercises.find((e) => e.id === ex.id);
  const ws = le ? le.sets.filter((s) => s.type === 'R') : [];
  return Array.from({ length: n }, (_, i) => {
    const p = ws[i] || ws[ws.length - 1];
    return { id: uid(), type: 'R', done: false, w: p ? String(p.w || '') : '', r: '', wB: p && ex.isSuperset ? String(p.wB || '') : '', rB: '' };
  });
}

/* ============================================================================
   МЕЛКИЕ UI-КОМПОНЕНТЫ
   ========================================================================== */
const Box = ({ checked, size = 'w-5 h-5' }) => (
  <span className={`${size} rounded-md border flex items-center justify-center shrink-0 ${checked ? 'bg-zinc-50 border-zinc-50' : 'border-zinc-600'}`}>
    {checked && <Check className="w-3.5 h-3.5 text-zinc-950" />}
  </span>
);

function CheckRow({ checked, onToggle, title, badge }) {
  return (
    <button onClick={onToggle} className="w-full flex items-start gap-3 text-left py-2">
      <span className="mt-0.5"><Box checked={checked} /></span>
      <span className="flex-1 text-sm text-zinc-200 leading-snug">
        {title}
        {badge && <span className="block mt-1.5">{badge}</span>}
      </span>
    </button>
  );
}

function Tilt({ missed, done }) {
  if (!missed) return null;
  return done
    ? <span className={`${mono} text-[10px] text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5`}>[ВОССТАНОВЛЕНО]</span>
    : <span className={`${mono} text-[10px] font-bold bg-zinc-50 text-zinc-950 rounded px-1.5 py-0.5`}>[УДЕРЖАНИЕ: ПРОПУСК ВЧЕРА]</span>;
}

function Segments({ n, value, onChange }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: n }, (_, i) => (
        <button
          key={i}
          onClick={() => onChange(value === i + 1 ? i : i + 1)}
          className={`flex-1 h-9 rounded-lg border transition ${i < value ? 'bg-zinc-50 border-zinc-50' : 'bg-base border-line hover:border-zinc-600'}`}
        />
      ))}
    </div>
  );
}

function Bar({ pct }) {
  return (
    <div className="h-1.5 rounded-full bg-[#1f1f22] overflow-hidden">
      <div className="h-full bg-zinc-50 rounded-full" style={{ width: `${clamp(pct, 0, 100)}%` }} />
    </div>
  );
}

function Stat({ label, value, unit }) {
  return (
    <div className="rounded-xl bg-base border border-line p-3">
      <div className={lbl}>{label}</div>
      <div className={`${mono} text-xl font-semibold mt-1`}>
        {value}{unit && <span className="text-xs text-zinc-500 ml-1 font-normal">{unit}</span>}
      </div>
    </div>
  );
}

function Spark({ values }) {
  if (values.length < 2) return <div className="h-16 flex items-center justify-center text-xs text-zinc-600">График появится после второго замера</div>;
  const W = 300, H = 70, p = 6;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [p + (i * (W - 2 * p)) / (values.length - 1), p + (1 - (v - min) / span) * (H - 2 * p)]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16">
      <polyline points={pts.map((q) => q.join(',')).join(' ')} fill="none" stroke="#fafafa" strokeWidth="1.5" />
      {pts.map((q, i) => <circle key={i} cx={q[0]} cy={q[1]} r="2.5" fill="#fafafa" />)}
    </svg>
  );
}

/* ============================================================================
   ВКЛАДКА «СЕГОДНЯ»
   ========================================================================== */
function TodayTab({ state, update, goto }) {
  const today = ds();
  const [view, setView] = useState(today);
  const log = { ...EMPTY_LOG, ...(state.logs[view] || {}) };
  const setLog = (patch) => update((s) => ({ ...s, logs: { ...s.logs, [view]: { ...EMPTY_LOG, ...(s.logs[view] || {}), ...patch } } }));

  const yest = addDays(view, -1);
  const yLog = yest >= state.startDate ? { ...EMPTY_LOG, ...(state.logs[yest] || {}) } : null;
  const missed = (k) => !!yLog && !habitDone(yLog, k);

  const dayIdx = Math.max(0, diffDays(today, state.startDate));
  const block = Math.floor(dayIdx / 60);
  const cells = Array.from({ length: 60 }, (_, i) => addDays(state.startDate, block * 60 + i));
  const sprint = diffDays(BIRTHDAY, today);
  const st = useMemo(() => streaks(state), [state.logs, state.startDate]);
  const week = periodStats(state, 7);
  const weak = week.n >= 3 ? HABITS.map((h) => ({ ...h, p: week.per[h.k] / week.n })).sort((a, b) => a.p - b.p)[0] : null;

  const lastBody = [...state.body].sort((a, b) => b.date.localeCompare(a.date))[0];
  const sinceBody = diffDays(today, lastBody.date);

  const dow = new Date().getDay();
  const doneToday = state.history.some((h) => h.date === today);
  let planLine = null;
  if (PLAN_DOW[dow] && !doneToday) {
    const d = state.program.find((p) => p.id === PLAN_DOW[dow]);
    planLine = d && { head: 'Сегодня тренировка', text: d.title };
  } else {
    for (let k = 1; k <= 7; k++) {
      const id = PLAN_DOW[(dow + k) % 7];
      if (id) { const d = state.program.find((p) => p.id === id); planLine = d && { head: `Следующая: ${DOW_NAME[(dow + k) % 7]}, через ${k} дн.`, text: d.title }; break; }
    }
  }

  const addTask = (text) => {
    if (!text.trim() || log.tasks.length >= 3) return;
    setLog({ tasks: [...log.tasks, { id: uid(), text: text.trim(), done: false }] });
  };
  const [taskText, setTaskText] = useState('');

  return (
    <div className="space-y-4">
      {/* Спринт и серия */}
      <div className={card}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className={lbl}>Спринт до 16 лет</div>
            <div className="text-sm text-zinc-300 mt-1">
              Спринт до 16 лет: осталось <span className={`${mono} font-bold text-white`}>{Math.max(0, sprint)}</span> дн.
            </div>
          </div>
          <div className="text-right">
            <div className={lbl}>День / серия</div>
            <div className={`${mono} text-sm mt-1`}>{dayIdx + 1} / {st.cur}</div>
          </div>
        </div>
        {weak && weak.p < 1 && (
          <div className="mt-3 pt-3 border-t border-line text-xs text-zinc-400">
            Слабое звено недели: <span className="text-zinc-100">{weak.t}</span> ({Math.round(weak.p * 100)}%). Начни день с него.
          </div>
        )}
      </div>

      {/* Сетка 60 дней */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <span className={lbl}>В будущее · блок {block + 1} · 60 дней</span>
          <span className={`${mono} text-xs text-zinc-500`}>{fmtShort(cells[0])} – {fmtShort(cells[59])}</span>
        </div>
        <div className="grid grid-cols-10 gap-1.5">
          {cells.map((d, i) => {
            const future = d > today;
            const isToday = d === today;
            const p = future ? 0 : dayPct(state.logs[d]);
            const shade = { 0: 'transparent', 25: '#3f3f46', 50: '#71717a', 75: '#a1a1aa', 100: '#fafafa' }[p];
            return (
              <button
                key={d}
                disabled={future}
                onClick={() => setView(d)}
                title={`День ${block * 60 + i + 1} · ${fmtShort(d)}${future ? '' : ` · ${p}%`}`}
                className={`aspect-square rounded-[5px] border ${future ? 'bg-[#0e0e10] border-[#18181b]' : 'border-zinc-700'} ${isToday ? 'ring-2 ring-white ring-offset-1 ring-offset-[#09090b]' : ''} ${view === d && !isToday ? 'ring-1 ring-zinc-400' : ''}`}
                style={future ? undefined : { background: shade }}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 mt-3 text-[10px] text-zinc-500">
          <span>0%</span>
          {['transparent', '#3f3f46', '#71717a', '#a1a1aa', '#fafafa'].map((c) => (
            <span key={c} className="w-3.5 h-3.5 rounded-[4px] border border-zinc-700" style={{ background: c }} />
          ))}
          <span>100%</span>
        </div>
      </div>

      {/* Вчера / Сегодня */}
      <div className="flex gap-2 items-center">
        <div className="flex-1 grid grid-cols-2 gap-1 p-1 rounded-xl bg-card border border-line">
          <button
            disabled={addDays(today, -1) < state.startDate}
            onClick={() => setView(addDays(today, -1))}
            className={`py-2 rounded-lg text-xs font-semibold disabled:opacity-30 ${view === addDays(today, -1) ? 'bg-zinc-50 text-zinc-950' : 'text-zinc-400'}`}
          >Вчера</button>
          <button onClick={() => setView(today)} className={`py-2 rounded-lg text-xs font-semibold ${view === today ? 'bg-zinc-50 text-zinc-950' : 'text-zinc-400'}`}>Сегодня</button>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-300 capitalize">{fmtLong(view)}</div>
          <div className={`${mono} text-xs text-zinc-500`}>{dayPct(log)}%</div>
        </div>
      </div>

      {sinceBody >= 7 && (
        <button onClick={() => goto('goals')} className="w-full text-left rounded-xl border border-zinc-600 bg-card p-3 text-xs text-zinc-300">
          С последнего замера прошло <span className={mono}>{sinceBody}</span> дн. Сделай контрольный замер веса и % жира.
        </button>
      )}

      {planLine && (
        <button onClick={() => goto('gym')} className={`${card} w-full text-left flex items-center justify-between`}>
          <div>
            <div className={lbl}>{planLine.head}</div>
            <div className="text-sm mt-1">{planLine.text}</div>
          </div>
          <Dumbbell className="w-5 h-5 text-zinc-400" />
        </button>
      )}

      {/* Питание и база */}
      <div className={card}>
        <div className={`${lbl} mb-3`}>Питание и база</div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-200">Белковые приёмы пищи</span>
          <span className={`${mono} text-sm`}>{log.protein}/3</span>
        </div>
        <Segments n={3} value={log.protein} onChange={(v) => setLog({ protein: v })} />
        {missed('protein') && <div className="mt-2"><Tilt missed done={habitDone(log, 'protein')} /></div>}
        <div className="h-px bg-line my-3" />
        <CheckRow
          checked={log.dessert}
          onToggle={() => setLog({ dessert: !log.dessert })}
          title="Правило десерта: сладкое только после нормальной еды (или протеиновая замена / Zero)"
          badge={missed('dessert') ? <Tilt missed done={log.dessert} /> : null}
        />
      </div>

      {/* Скулы */}
      <div className={card}>
        <div className={`${lbl} mb-3`}>Острые скулы: анти-отек</div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-200">Чистая вода</span>
          <span className={`${mono} text-sm`}>{log.waterMl} / {WATER_GOAL} мл</span>
        </div>
        <Segments n={8} value={Math.min(8, Math.floor(log.waterMl / 250))} onChange={(v) => setLog({ waterMl: v * 250 })} />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button onClick={() => setLog({ waterMl: Math.max(0, log.waterMl - 250) })} className={`${btn} py-2.5 flex items-center justify-center gap-1.5`}><Minus className="w-3.5 h-3.5" /><span className={mono}>250 мл</span></button>
          <button onClick={() => setLog({ waterMl: log.waterMl + 250 })} className={`${btnP} py-2.5 flex items-center justify-center gap-1.5`}><Plus className="w-3.5 h-3.5" /><span className={mono}>250 мл</span></button>
        </div>
        {missed('water') && <div className="mt-2"><Tilt missed done={habitDone(log, 'water')} /></div>}
        <div className="h-px bg-line my-3" />
        <CheckRow
          checked={log.clean}
          onToggle={() => setLog({ clean: !log.clean })}
          title="Чистый вечер: без сахара и соленого за 3 часа до сна"
          badge={missed('clean') ? <Tilt missed done={log.clean} /> : null}
        />
      </div>

      {/* Фокус дня */}
      <div className={card}>
        <div className="flex items-center justify-between mb-2">
          <span className={lbl}>Фокус дня</span>
          <span className={`${mono} text-xs text-zinc-500`}>{log.tasks.filter((t) => t.done).length}/{log.tasks.length}</span>
        </div>
        {log.tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-2">
            <button
              onClick={() => setLog({ tasks: log.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) })}
              className="flex-1 flex items-center gap-3 py-2 text-left"
            >
              <Box checked={t.done} />
              <span className={`text-sm ${t.done ? 'line-through text-zinc-600' : 'text-zinc-200'}`}>{t.text}</span>
            </button>
            <button onClick={() => setLog({ tasks: log.tasks.filter((x) => x.id !== t.id) })} className="p-2 text-zinc-600 hover:text-zinc-300"><X className="w-4 h-4" /></button>
          </div>
        ))}
        {log.tasks.length < 3 && (
          <div className="flex gap-2 mt-2">
            <input
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { addTask(taskText); setTaskText(''); } }}
              placeholder="Главная задача дня (учёба / проект)"
              className={inp}
            />
            <button onClick={() => { addTask(taskText); setTaskText(''); }} className={`${btnP} px-4`}><Plus className="w-4 h-4" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   ВКЛАДКА «ЗАЛ»
   ========================================================================== */
function SetRow({ ex, set, onPatch, onAdj, onDone, onDel }) {
  const warm = set.type === 'W';
  const parts = ex.isSuperset
    ? [{ w: 'w', r: 'r', l: ex.partA }, { w: 'wB', r: 'rB', l: ex.partB }]
    : [{ w: 'w', r: 'r' }];
  const target = parseInt((ex.target.split('×')[1] || '10'), 10) || 10;
  return (
    <div className={`flex items-center gap-2 py-1.5 ${warm ? 'opacity-60' : ''}`}>
      <button
        onClick={() => onPatch({ type: warm ? 'R' : 'W' })}
        className={`${mono} w-12 shrink-0 h-9 rounded-lg border text-[10px] font-bold ${warm ? 'border-zinc-700 text-zinc-500' : 'border-zinc-50 bg-zinc-50 text-zinc-950'}`}
      >{warm ? '[Р]' : '[РАБ]'}</button>
      <div className="flex-1 space-y-1.5 min-w-0">
        {parts.map((p) => (
          <div key={p.w}>
            {p.l && <div className="text-[10px] text-zinc-500 mb-0.5 truncate">{p.l}</div>}
            <div className="flex items-center gap-1">
              <button onClick={() => onAdj(p.w, -2.5)} className={`${btn} ${mono} h-9 w-9 shrink-0 text-[11px]`}>−2.5</button>
              <input type="number" inputMode="decimal" value={set[p.w]} placeholder="кг" onChange={(e) => onPatch({ [p.w]: e.target.value })} className={`${inpM} h-9 text-center px-1`} />
              <button onClick={() => onAdj(p.w, 2.5)} className={`${btn} ${mono} h-9 w-9 shrink-0 text-[11px]`}>+2.5</button>
              <span className="text-zinc-600 text-xs px-0.5">×</span>
              <input type="number" inputMode="numeric" value={set[p.r]} placeholder={String(target)} onChange={(e) => onPatch({ [p.r]: e.target.value })} className={`${inpM} h-9 text-center px-1 max-w-[52px]`} />
            </div>
          </div>
        ))}
      </div>
      <button onClick={onDone} className="shrink-0"><Box checked={set.done} size="w-9 h-9" /></button>
      <button onClick={onDel} className="shrink-0 text-zinc-700 hover:text-zinc-300"><X className="w-4 h-4" /></button>
    </div>
  );
}

function GymTab({ state, update }) {
  const { program, history, draft } = state;
  const today = ds();
  const [dayId, setDayId] = useState(draft ? draft.dayId : (PLAN_DOW[new Date().getDay()] || (() => {
    for (let k = 1; k <= 7; k++) if (PLAN_DOW[(new Date().getDay() + k) % 7]) return PLAN_DOW[(new Date().getDay() + k) % 7];
    return 'day1';
  })()));
  const [edit, setEdit] = useState(false);
  const [notes, setNotes] = useState({});
  const [openId, setOpenId] = useState(null);
  const [rest, setRest] = useState({ dur: 90, end: null });
  const [now, setNow] = useState(Date.now());
  const [showArchive, setShowArchive] = useState(false);

  const activeId = draft ? draft.dayId : dayId;
  const day = program.find((d) => d.id === activeId) || program[0];
  const last = lastWorkout(history, day.id);

  useEffect(() => {
    if (!rest.end) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= rest.end) { beep(); setRest((r) => ({ ...r, end: null })); }
    }, 250);
    return () => clearInterval(id);
  }, [rest.end]);

  const startRest = (dur) => setRest({ dur, end: Date.now() + dur * 1000 });

  const start = () => update((s) => ({
    ...s,
    draft: {
      dayId: day.id, startedAt: Date.now(), date: today,
      ex: Object.fromEntries(day.exercises.map((e) => [e.id, { note: '', sets: mkSets(e, last) }])),
      cardio: { on: true, min: 10, speed: 5.3, incline: 3.0, dist: '' }
    }
  }));

  const updEx = (exId, fn) => update((s) => ({
    ...s,
    draft: { ...s.draft, ex: { ...s.draft.ex, [exId]: fn(s.draft.ex[exId] || { note: '', sets: [] }) } }
  }));
  const patchSet = (exId, setId, patch) => updEx(exId, (e) => ({ ...e, sets: e.sets.map((x) => (x.id === setId ? { ...x, ...patch } : x)) }));
  const adj = (exId, set, key, d) => patchSet(exId, set.id, { [key]: String(Math.max(0, r1((parseFloat(set[key]) || 0) + d))) });
  const delSet = (exId, setId) => updEx(exId, (e) => ({ ...e, sets: e.sets.filter((x) => x.id !== setId) }));
  const addSet = (exId, ex, type) => updEx(exId, (e) => {
    const prev = [...e.sets].reverse().find((x) => x.type === 'R') || e.sets[e.sets.length - 1];
    const n = { id: uid(), type, done: false, w: type === 'R' && prev ? prev.w : '', r: '', wB: type === 'R' && prev && ex.isSuperset ? prev.wB : '', rB: '' };
    return { ...e, sets: [...e.sets, n] };
  });
  const toggleDone = (exId, ex, set, idx, sets) => {
    if (set.done) { patchSet(exId, set.id, { done: false }); return; }
    const prev = sets.slice(0, idx).reverse().find((x) => x.w !== '' || x.r !== '');
    const tr = String(parseInt((ex.target.split('×')[1] || '10'), 10) || 10);
    const patch = { done: true };
    if (set.w === '' && prev) patch.w = prev.w;
    if (set.r === '') patch.r = prev && prev.r !== '' && prev.type === set.type ? prev.r : tr;
    if (ex.isSuperset) {
      if (set.wB === '' && prev) patch.wB = prev.wB;
      if (set.rB === '') patch.rB = prev && prev.rB !== '' && prev.type === set.type ? prev.rB : tr;
    }
    patchSet(exId, set.id, patch);
    if (set.type === 'R') startRest(rest.dur);
  };

  const setCardio = (patch) => update((s) => ({ ...s, draft: { ...s.draft, cardio: { ...s.draft.cardio, ...patch } } }));

  const finish = () => {
    const exs = day.exercises.map((e) => ({
      id: e.id, name: e.name, isSuperset: !!e.isSuperset, partA: e.partA, partB: e.partB,
      note: (draft.ex[e.id] && draft.ex[e.id].note) || '',
      sets: ((draft.ex[e.id] && draft.ex[e.id].sets) || []).filter((x) => x.done)
    })).filter((e) => e.sets.length);
    if (!exs.length) { alert('Отметь хотя бы один выполненный подход.'); return; }
    if (!window.confirm('Завершить тренировку и сохранить в архив?')) return;
    const c = draft.cardio;
    const auto = r2(((parseFloat(c.speed) || 0) * (parseFloat(c.min) || 0)) / 60);
    const cardio = c.on && parseFloat(c.min) > 0
      ? { min: parseFloat(c.min), speed: parseFloat(c.speed) || 0, incline: parseFloat(c.incline) || 0, dist: c.dist !== '' ? parseFloat(c.dist) || 0 : auto }
      : null;
    const rec = {
      id: uid(), ts: Date.now(), date: draft.date, dayId: day.id, title: day.title,
      duration: Math.round((Date.now() - draft.startedAt) / 60000),
      tonnage: tonnageOf(exs), exercises: exs, cardio
    };
    update((s) => ({ ...s, history: [...s.history, rec], draft: null }));
    setRest({ dur: rest.dur, end: null });
  };

  const cancel = () => { if (window.confirm('Отменить текущую тренировку? Введённые данные пропадут.')) { update((s) => ({ ...s, draft: null })); setRest({ dur: rest.dur, end: null }); } };

  // редактирование программы
  const editProg = (fn) => update((s) => ({ ...s, program: s.program.map((d) => (d.id === day.id ? { ...d, exercises: fn(d.exercises) } : d)) }));

  const ym = today.slice(0, 7);
  const monthKm = history.filter((h) => h.date.startsWith(ym) && h.cardio).reduce((a, h) => a + h.cardio.dist, 0);
  const cardio = draft ? draft.cardio : null;
  const autoDist = cardio ? r2(((parseFloat(cardio.speed) || 0) * (parseFloat(cardio.min) || 0)) / 60) : 0;
  const left = rest.end ? Math.max(0, Math.ceil((rest.end - now) / 1000)) : 0;

  return (
    <div className="space-y-4 pb-28">
      {/* Выбор дня */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-card border border-line">
        {program.map((d) => (
          <button
            key={d.id}
            disabled={!!draft}
            onClick={() => setDayId(d.id)}
            className={`py-2 px-1 rounded-lg text-[11px] font-semibold leading-tight ${activeId === d.id ? 'bg-zinc-50 text-zinc-950' : 'text-zinc-400'} ${draft && activeId !== d.id ? 'opacity-30' : ''}`}
          >{d.short}</button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{day.title}</div>
          <div className="text-xs text-zinc-500 mt-0.5">{last ? `Прошлый раз: ${fmtShort(last.date)}` : 'Первая тренировка этого дня'}</div>
        </div>
        {!draft && (
          <button onClick={() => setEdit(!edit)} className={`${btn} px-3 py-2 flex items-center gap-1.5`}>
            <Pencil className="w-3.5 h-3.5" />{edit ? 'Готово' : 'Править'}
          </button>
        )}
      </div>

      {/* Режим редактирования программы */}
      {!draft && edit && (
        <div className="space-y-2">
          {day.exercises.map((e) => (
            <div key={e.id} className={`${card} !p-3 flex gap-2 items-center`}>
              <input value={e.name} onChange={(ev) => editProg((xs) => xs.map((x) => (x.id === e.id ? { ...x, name: ev.target.value } : x)))} className={inp} />
              <input value={e.target} onChange={(ev) => editProg((xs) => xs.map((x) => (x.id === e.id ? { ...x, target: ev.target.value } : x)))} className={`${inpM} max-w-[100px]`} />
              <button onClick={() => editProg((xs) => xs.filter((x) => x.id !== e.id))} className="p-2 text-zinc-500 hover:text-white"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={() => editProg((xs) => [...xs, { id: uid(), name: 'Новое упражнение', target: '4×10' }])} className={`${btn} w-full py-3 flex items-center justify-center gap-2`}><Plus className="w-4 h-4" />Добавить упражнение</button>
        </div>
      )}

      {/* Предпросмотр до старта */}
      {!draft && !edit && (
        <>
          <div className="space-y-2">
            {day.exercises.map((e, i) => {
              const h = hintFor(e, last);
              return (
                <div key={e.id} className={`${card} !p-3`}>
                  <div className="flex justify-between gap-3">
                    <span className="text-sm">{i + 1}. {e.name}</span>
                    <span className={`${mono} text-xs text-zinc-400 shrink-0`}>{e.target}</span>
                  </div>
                  {h && h.a && (
                    <div className={`${mono} text-[11px] text-zinc-500 mt-1.5`}>
                      Цель: <span className="text-zinc-300">{h.a.goal}{h.b ? ` / ${h.b.goal}` : ''}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={start} className={`${btnP} w-full py-4 text-sm flex items-center justify-center gap-2`}><Play className="w-4 h-4" />Начать тренировку</button>
        </>
      )}

      {/* Активная тренировка */}
      {draft && day.exercises.map((e, i) => {
        const st = draft.ex[e.id] || { note: '', sets: [] };
        const h = hintFor(e, last);
        const doneCnt = st.sets.filter((x) => x.done && x.type === 'R').length;
        const isOpen = openId === e.id || !!st.note;
        return (
          <div key={e.id} className={card}>
            <div className="flex justify-between gap-3">
              <div className="text-sm font-medium leading-snug">{i + 1}. {e.name}</div>
              <div className={`${mono} text-xs text-zinc-400 shrink-0`}>{doneCnt} · {e.target}</div>
            </div>
            {h && (
              <div className={`${mono} text-[11px] text-zinc-500 mt-2 space-y-0.5`}>
                {h.a && <div>Прошлая: {h.a.prev}{h.b ? ` / B: ${h.b.prev}` : ''}</div>}
                {h.a && <div>Цель: <span className="text-zinc-200">{h.a.goal}{h.b ? ` / ${h.b.goal}` : ''}</span></div>}
                {h.note && <div className="font-sans text-zinc-600 italic">Заметка: {h.note}</div>}
              </div>
            )}
            <div className="mt-2 divide-y divide-line">
              {st.sets.map((s, idx) => (
                <SetRow
                  key={s.id} ex={e} set={s}
                  onPatch={(p) => patchSet(e.id, s.id, p)}
                  onAdj={(k, d) => adj(e.id, s, k, d)}
                  onDone={() => toggleDone(e.id, e, s, idx, st.sets)}
                  onDel={() => delSet(e.id, s.id)}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <button onClick={() => addSet(e.id, e, 'W')} className={`${btn} py-2`}>+ [Р]</button>
              <button onClick={() => addSet(e.id, e, 'R')} className={`${btn} py-2`}>+ [РАБ]</button>
              <button onClick={() => setOpenId(isOpen && !st.note ? null : e.id)} className={`${btn} py-2`}>Заметка</button>
            </div>
            {isOpen && (
              <textarea
                rows={2} value={st.note}
                onChange={(ev) => updEx(e.id, (x) => ({ ...x, note: ev.target.value }))}
                placeholder="Техника, ощущения, что поправить в следующий раз"
                className={`${inp} mt-2 text-xs`}
              />
            )}
          </div>
        );
      })}

      {/* Финишер: беговая дорожка */}
      {draft && cardio && (
        <div className={card}>
          <div className="flex items-center justify-between mb-3">
            <span className={lbl}>Финишер · беговая дорожка</span>
            <button onClick={() => setCardio({ on: !cardio.on })}><Box checked={cardio.on} /></button>
          </div>
          <div className={`grid grid-cols-3 gap-2 ${cardio.on ? '' : 'opacity-40 pointer-events-none'}`}>
            {[['min', 'Время, мин'], ['speed', 'Скорость, км/ч'], ['incline', 'Наклон, %']].map(([k, l]) => (
              <label key={k} className="block">
                <span className="text-[10px] text-zinc-500">{l}</span>
                <input type="number" inputMode="decimal" value={cardio[k]} onChange={(ev) => setCardio({ [k]: ev.target.value })} className={`${inpM} mt-1`} />
              </label>
            ))}
          </div>
          <label className={`block mt-2 ${cardio.on ? '' : 'opacity-40 pointer-events-none'}`}>
            <span className="text-[10px] text-zinc-500">Дистанция, км (пусто = авто)</span>
            <input type="number" inputMode="decimal" value={cardio.dist} placeholder={`~${autoDist.toFixed(2)}`} onChange={(ev) => setCardio({ dist: ev.target.value })} className={`${inpM} mt-1`} />
          </label>
        </div>
      )}

      {draft && (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={cancel} className={`${btn} py-3.5`}>Отмена</button>
          <button onClick={finish} className={`${btnP} col-span-2 py-3.5 text-sm`}>Завершить тренировку</button>
        </div>
      )}

      {/* Месячный километраж */}
      <div className={`${card} flex items-center justify-between`}>
        <div>
          <div className={lbl}>Дорожка · за месяц</div>
          <div className="text-xs text-zinc-500 mt-1">{parse(today).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</div>
        </div>
        <div className={`${mono} text-2xl font-semibold`}>{r2(monthKm).toFixed(2)}<span className="text-xs text-zinc-500 ml-1 font-normal">км</span></div>
      </div>

      {/* Архив */}
      <div className={card}>
        <button onClick={() => setShowArchive(!showArchive)} className="w-full flex items-center justify-between">
          <span className={lbl}>Архив тренировок · {history.length}</span>
          {showArchive ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </button>
        {showArchive && (
          <div className="mt-3 space-y-2">
            {!history.length && <div className="text-xs text-zinc-600">Пока пусто. Первая тренировка откроет архив.</div>}
            {[...history].sort((a, b) => b.ts - a.ts).map((h) => (
              <div key={h.id} className="rounded-xl bg-base border border-line">
                <button onClick={() => setNotes((n) => ({ ...n, [h.id]: !n[h.id] }))} className="w-full p-3 text-left">
                  <div className="flex justify-between gap-2">
                    <span className="text-sm">{h.title}</span>
                    <span className={`${mono} text-xs text-zinc-500`}>{fmtShort(h.date)}</span>
                  </div>
                  <div className={`${mono} text-[11px] text-zinc-500 mt-1`}>
                    {Math.round(h.tonnage)} кг тоннаж · {h.exercises.reduce((a, e) => a + e.sets.length, 0)} подх. · {h.duration} мин{h.cardio ? ` · ${h.cardio.dist} км` : ''}
                  </div>
                </button>
                {notes[h.id] && (
                  <div className="px-3 pb-3 space-y-2 border-t border-line pt-2">
                    {h.exercises.map((e) => (
                      <div key={e.id}>
                        <div className="text-xs text-zinc-300">{e.name}</div>
                        <div className={`${mono} text-[11px] text-zinc-500`}>
                          {e.sets.map((s) => `${s.type === 'W' ? '[Р] ' : ''}${s.w || 0}×${s.r || 0}${e.isSuperset ? ` + ${s.wB || 0}×${s.rB || 0}` : ''}`).join(' · ')}
                        </div>
                        {e.note && <div className="text-[11px] text-zinc-600 italic">{e.note}</div>}
                      </div>
                    ))}
                    <button
                      onClick={() => { if (window.confirm('Удалить тренировку из архива?')) update((s) => ({ ...s, history: s.history.filter((x) => x.id !== h.id) })); }}
                      className="text-[11px] text-zinc-600 hover:text-zinc-300 flex items-center gap-1"
                    ><Trash2 className="w-3 h-3" />Удалить</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Плавающий таймер отдыха */}
      {draft && (
        <div className="fixed left-0 right-0 z-30 px-3" style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
          <div className="max-w-2xl mx-auto rounded-2xl bg-[#18181b] border border-zinc-700 p-2 flex items-center gap-2">
            <Timer className="w-4 h-4 text-zinc-400 ml-1" />
            <span className={`${mono} text-lg font-semibold w-14 ${rest.end ? 'text-white' : 'text-zinc-500'}`}>{mmss(rest.end ? left : rest.dur)}</span>
            <div className="flex-1 grid grid-cols-3 gap-1">
              {[60, 90, 120].map((d) => (
                <button key={d} onClick={() => startRest(d)} className={`${mono} py-2 rounded-lg text-xs ${rest.dur === d ? 'bg-zinc-50 text-zinc-950 font-bold' : 'bg-base border border-line text-zinc-300'}`}>{d}с</button>
              ))}
            </div>
            {rest.end && <button onClick={() => setRest((r) => ({ ...r, end: null }))} className="p-2 text-zinc-400"><X className="w-4 h-4" /></button>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   ВКЛАДКА «ЦЕЛИ»
   ========================================================================== */
const STAGES = [[1, 'База в тягах'], [5, '5 раз'], [8, '8 раз'], [12, '12 раз'], [15, '15 раз · Золото ГТО']];

function GoalsTab({ state, update, openSos }) {
  const today = ds();
  const [imgErr, setImgErr] = useState(false);
  const [nw, setNw] = useState('');
  const [nf, setNf] = useState('');
  const body = [...state.body].sort((a, b) => a.date.localeCompare(b.date));
  const first = body[0], cur = body[body.length - 1];
  const h = state.height / 100;
  const bmi = (w) => r1(w / (h * h));
  const lean = (m) => r1(m.weight * (1 - m.fat / 100));
  const TARGET = 14;
  const leanNow = cur.weight * (1 - cur.fat / 100);
  const wAtTarget = r1(leanNow / (1 - TARGET / 100));
  const fatPct = ((first.fat - cur.fat) / (first.fat - TARGET)) * 100;
  const dropKg = r1(cur.weight - wAtTarget);
  const loadDrop = r1((dropKg / cur.weight) * 100);
  const relStrength = r1((cur.weight / wAtTarget - 1) * 100);

  let forecast = null;
  if (body.length >= 2) {
    const days = diffDays(cur.date, first.date);
    const rate = (first.fat - cur.fat) / Math.max(1, days);
    if (days >= 7 && rate > 0 && cur.fat > TARGET) forecast = addDays(today, Math.round((cur.fat - TARGET) / rate));
  }

  const addMeasure = () => {
    const w = parseFloat(nw.replace(',', '.')), f = parseFloat(nf.replace(',', '.'));
    if (!w || !f) return;
    update((s) => ({ ...s, body: [...s.body, { id: uid(), date: today, weight: w, fat: f }] }));
    setNw(''); setNf('');
  };

  const pm = state.pull.max;
  const setPull = (v) => update((s) => {
    const m = Math.max(0, v);
    return { ...s, pull: { max: m, log: [...s.pull.log.filter((x) => x.date !== today), { date: today, reps: m }] } };
  });
  const nextStage = STAGES.find((x) => pm < x[0]);

  return (
    <div className="space-y-4">
      {/* M3 */}
      <div className="rounded-2xl bg-card border border-line overflow-hidden">
        <div className="aspect-video bg-base relative">
          {!imgErr
            ? <img src="./m3.jpg" alt="BMW M3" onError={() => setImgErr(true)} className="w-full h-full object-cover" />
            : <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-600 text-center px-6">Положи фото в public/m3.jpg</div>}
        </div>
        <div className="p-4">
          <div className={lbl}>Визуальный якорь · BMW M3</div>
          <p className="text-sm text-zinc-300 mt-2 leading-relaxed">Побочный эффект масштаба личности, дисциплины и сильных проектов.</p>
        </div>
      </div>

      <button onClick={openSos} className={`${btnP} w-full py-4 text-sm flex items-center justify-center gap-2`}><Zap className="w-4 h-4" />Мне лень / Анти-срыв</button>

      {/* Рекомпозиция */}
      <div className={card}>
        <div className={`${lbl} mb-3`}>Рекомпозиция · 23.5% → 14% жира</div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Вес" value={cur.weight.toFixed(1)} unit="кг" />
          <Stat label="Жир" value={cur.fat.toFixed(1)} unit="%" />
          <Stat label="Сухая масса" value={lean(cur).toFixed(1)} unit="кг" />
          <Stat label="ИМТ" value={bmi(cur.weight).toFixed(1)} />
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-zinc-500 mb-1.5"><span>Прогресс до 14%</span><span className={mono}>{clamp(Math.round(fatPct), 0, 100)}%</span></div>
          <Bar pct={fatPct} />
        </div>
        <div className="text-xs text-zinc-500 mt-3 leading-relaxed">
          При той же сухой массе ({lean(cur).toFixed(1)} кг) и 14% жира вес будет около <span className={`${mono} text-zinc-200`}>{wAtTarget} кг</span>.
          {forecast && <> Прогноз по текущему темпу: 14% к <span className={`${mono} text-zinc-200`}>{fmtFull(forecast)}</span>.</>}
        </div>

        <div className="mt-4">
          <Spark values={body.map((m) => m.fat)} />
          <div className="text-[10px] text-zinc-600 text-center">Динамика % жира</div>
        </div>

        <div className="mt-3 text-xs">
          <div className={`grid grid-cols-5 gap-1 ${lbl} py-1.5 border-b border-line`}>
            <span>Дата</span><span className="text-right">Вес</span><span className="text-right">Жир</span><span className="text-right">Сухая</span><span />
          </div>
          {[...body].reverse().slice(0, 8).map((m) => (
            <div key={m.id} className={`grid grid-cols-5 gap-1 py-1.5 border-b border-line/60 items-center ${mono}`}>
              <span className="text-zinc-400">{fmtShort(m.date)}</span>
              <span className="text-right">{m.weight.toFixed(1)}</span>
              <span className="text-right">{m.fat.toFixed(1)}</span>
              <span className="text-right text-zinc-400">{lean(m).toFixed(1)}</span>
              <span className="text-right">
                {body.length > 1 && <button onClick={() => update((s) => ({ ...s, body: s.body.filter((x) => x.id !== m.id) }))} className="text-zinc-700 hover:text-zinc-300"><X className="w-3.5 h-3.5 inline" /></button>}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-2 mt-3">
          <input type="number" inputMode="decimal" value={nw} onChange={(e) => setNw(e.target.value)} placeholder="Вес, кг" className={`${inpM} col-span-2`} />
          <input type="number" inputMode="decimal" value={nf} onChange={(e) => setNf(e.target.value)} placeholder="Жир, %" className={`${inpM} col-span-2`} />
          <button onClick={addMeasure} className={`${btnP}`}><Plus className="w-4 h-4 mx-auto" /></button>
        </div>
      </div>

      {/* Подтягивания */}
      <div className={card}>
        <div className={`${lbl} mb-3`}>Подтягивания · цель 15 · Золото ГТО (10 класс)</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500">Текущий максимум в подходе</div>
            <div className={`${mono} text-4xl font-semibold mt-1`}>{pm}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPull(pm - 1)} className={`${btn} w-12 h-12 flex items-center justify-center`}><Minus className="w-4 h-4" /></button>
            <button onClick={() => setPull(pm + 1)} className={`${btnP} w-12 h-12 flex items-center justify-center`}><Plus className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          {STAGES.map(([n, l]) => {
            const reached = pm >= n;
            const isNext = nextStage && nextStage[0] === n;
            return (
              <div key={n} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${reached ? 'border-zinc-500 bg-[#18181b]' : isNext ? 'border-zinc-600 border-dashed' : 'border-line'}`}>
                <Box checked={reached} />
                <span className={`text-sm flex-1 ${reached ? 'text-zinc-100' : 'text-zinc-500'}`}>{l}</span>
                {isNext && <span className={`${mono} text-[11px] text-zinc-400`}>ещё {n - pm}</span>}
              </div>
            );
          })}
        </div>
        {state.pull.log.length > 1 && <div className="mt-3"><Spark values={state.pull.log.map((x) => x.reps)} /></div>}
        <div className="mt-4 rounded-xl bg-base border border-line p-3 text-xs text-zinc-400 leading-relaxed">
          Вес на турнике: сейчас <span className={`${mono} text-zinc-100`}>{cur.weight.toFixed(1)} кг</span>. При 14% жира и той же сухой массе —
          <span className={`${mono} text-zinc-100`}> {wAtTarget} кг</span>. Это на <span className={`${mono} text-zinc-100`}>{dropKg} кг</span> ({loadDrop}%) легче поднимать себя,
          то есть около <span className={`${mono} text-zinc-100`}>+{relStrength}%</span> к относительной силе без роста силы как таковой (грубая оценка).
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   ВКЛАДКА «СИСТЕМА»
   ========================================================================== */
function SystemTab({ state, update, cfg, saveCfg, sync, syncErr, syncNow }) {
  const [range, setRange] = useState(7);
  const [url, setUrl] = useState(cfg.url);
  const [key, setKey] = useState(cfg.key);
  const [paste, setPaste] = useState('');
  const fileRef = useRef(null);
  const rep = periodStats(state, range);
  const all = lifetime(state);
  const st = streaks(state);
  const recs = records(state.history);
  const pct = (k) => Math.round((rep.per[k] / rep.n) * 100);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `m-protocol-${ds()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importJson = (text) => {
    try {
      const o = JSON.parse(text);
      if (!o || typeof o !== 'object' || !o.logs) throw new Error('bad');
      if (!window.confirm('Заменить текущие данные данными из бэкапа?')) return;
      update(() => normalize(o));
      setPaste('');
    } catch { alert('Не удалось прочитать JSON. Проверь файл.'); }
  };

  return (
    <div className="space-y-4">
      {/* Уровень */}
      <div className={card}>
        <div className="flex items-end justify-between">
          <div>
            <div className={lbl}>Уровень дисциплины</div>
            <div className={`${mono} text-4xl font-semibold mt-1`}>{all.level}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-zinc-200">{rankOf(all.level)}</div>
            <div className={`${mono} text-xs text-zinc-500`}>{all.xp} XP</div>
          </div>
        </div>
        <div className="mt-3"><Bar pct={(all.into / 300) * 100} /></div>
        <div className={`${mono} text-[11px] text-zinc-500 mt-1.5`}>{all.into}/300 XP до следующего · +10 за привычку · +50 за тренировку</div>
      </div>

      {/* Отчёт */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <span className={lbl}>Отчёт</span>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-base border border-line">
            {[[7, 'Неделя'], [30, 'Месяц']].map(([d, l]) => (
              <button key={d} onClick={() => setRange(d)} className={`px-3 py-1.5 rounded-md text-[11px] font-semibold ${range === d ? 'bg-zinc-50 text-zinc-950' : 'text-zinc-400'}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Дисциплина" value={rep.disc} unit="%" />
          <Stat label="Чистых вечеров" value={rep.per.clean} unit={`/ ${rep.n}`} />
          <Stat label="Вода" value={r1(rep.ml / 1000)} unit="л" />
          <Stat label="Тренировок" value={rep.workouts} />
          <Stat label="Рабочий тоннаж" value={r2(rep.ton / 1000)} unit="т" />
          <Stat label="Дорожка" value={r2(rep.km).toFixed(2)} unit="км" />
        </div>
        <div className="mt-4 space-y-2.5">
          {HABITS.map((h) => (
            <div key={h.k}>
              <div className="flex justify-between text-xs text-zinc-400 mb-1"><span>{h.t}</span><span className={mono}>{pct(h.k)}%</span></div>
              <Bar pct={pct(h.k)} />
            </div>
          ))}
        </div>
      </div>

      {/* За всё время */}
      <div className={card}>
        <div className={`${lbl} mb-3`}>За всё время</div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Дней в протоколе" value={all.days} />
          <Stat label="Тренировок" value={all.workouts} />
          <Stat label="Подходов" value={all.sets} />
          <Stat label="Поднято" value={r1(all.ton / 1000)} unit="т" />
          <Stat label="Дорожка" value={r1(all.km)} unit="км" />
          <Stat label="Воды выпито" value={r1(all.ml / 1000)} unit="л" />
          <Stat label="Дней на 100%" value={st.full} />
          <Stat label="Серия / рекорд" value={`${st.cur} / ${st.best}`} unit="дн." />
        </div>
        <details className="mt-3">
          <summary className="text-xs text-zinc-400 cursor-pointer py-1">Личные рекорды ({recs.length})</summary>
          <div className="mt-2 space-y-1">
            {!recs.length && <div className="text-xs text-zinc-600">Появятся после первой тренировки.</div>}
            {recs.map((r) => (
              <div key={r.name} className="flex justify-between gap-3 text-xs border-b border-line/60 py-1.5">
                <span className="text-zinc-300">{r.name}</span>
                <span className={`${mono} text-zinc-100 shrink-0`}>{r.w} × {r.r}</span>
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* Supabase */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <span className={lbl}>Облачная синхронизация · Supabase</span>
          <span className={`${mono} text-[11px] text-zinc-400`}>{{ local: 'Local', syncing: 'Syncing', synced: 'Cloud Synced', error: 'Error' }[sync]}</span>
        </div>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" className={`${inpM} mb-2`} autoCapitalize="off" />
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="anon public key" type="password" className={`${inpM} mb-2`} />
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => saveCfg({ url: url.trim(), key: key.trim() })} className={`${btnP} py-2.5`}>Сохранить</button>
          <button onClick={syncNow} className={`${btn} py-2.5`}>Синхронизировать</button>
        </div>
        {sync === 'error' && <div className="text-[11px] text-zinc-400 mt-2 break-words">Ошибка: {syncErr}</div>}
        <div className="text-[11px] text-zinc-600 mt-2">Таблица tracker_state, строка id = main. На каждом устройстве вставь URL и ключ один раз.</div>
      </div>

      {/* Настройки */}
      <div className={card}>
        <div className={`${lbl} mb-3`}>Профиль и тексты</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10px] text-zinc-500">Дата старта (день 1)</span>
            <input type="date" value={state.startDate} onChange={(e) => e.target.value && update((s) => ({ ...s, startDate: e.target.value }))} className={`${inpM} mt-1`} />
          </label>
          <label className="block">
            <span className="text-[10px] text-zinc-500">Рост, см (для ИМТ)</span>
            <input type="number" inputMode="numeric" value={state.height} onChange={(e) => update((s) => ({ ...s, height: parseFloat(e.target.value) || 0 }))} className={`${inpM} mt-1`} />
          </label>
        </div>
        <label className="block mt-3">
          <span className="text-[10px] text-zinc-500">Текст режима «Анти-срыв»</span>
          <textarea rows={4} value={state.sos} onChange={(e) => update((s) => ({ ...s, sos: e.target.value }))} className={`${inp} mt-1 text-xs leading-relaxed`} />
        </label>
      </div>

      {/* Бэкап */}
      <div className={card}>
        <div className={`${lbl} mb-3`}>Резервная копия · JSON</div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={exportJson} className={`${btnP} py-2.5 flex items-center justify-center gap-2`}><Download className="w-3.5 h-3.5" />Экспорт</button>
          <button onClick={() => fileRef.current && fileRef.current.click()} className={`${btn} py-2.5 flex items-center justify-center gap-2`}><Upload className="w-3.5 h-3.5" />Импорт</button>
          <input
            ref={fileRef} type="file" accept=".json,application/json" className="hidden"
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              if (!f) return;
              const rd = new FileReader();
              rd.onload = (ev) => importJson(String(ev.target.result));
              rd.readAsText(f);
              e.target.value = '';
            }}
          />
        </div>
        <textarea rows={2} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Или вставь JSON сюда" className={`${inpM} mt-2 text-xs`} />
        {paste.trim().length > 10 && <button onClick={() => importJson(paste)} className={`${btn} w-full py-2.5 mt-2`}>Восстановить из текста</button>}
        <button
          onClick={() => { if (window.confirm('Стереть ВСЕ данные? Если подключено облако, оно тоже будет перезаписано.') && window.confirm('Точно стереть?')) update(() => ({ ...defaultState() })); }}
          className="mt-3 text-[11px] text-zinc-600 hover:text-zinc-300 flex items-center gap-1"
        ><Trash2 className="w-3 h-3" />Сбросить всё</button>
      </div>
    </div>
  );
}

/* ============================================================================
   ПОЛНОЭКРАННЫЙ «АНТИ-СРЫВ»
   ========================================================================== */
function SosModal({ text, onClose }) {
  const vref = useRef(null);
  const [muted, setMuted] = useState(false);
  const [vErr, setVErr] = useState(false);
  const [left, setLeft] = useState(300);
  const [end, setEnd] = useState(null);

  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    v.muted = false;
    const p = v.play();
    if (p && p.catch) p.catch(() => { v.muted = true; setMuted(true); v.play().catch(() => {}); });
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);

  useEffect(() => { if (vref.current) vref.current.muted = muted; }, [muted]);

  useEffect(() => {
    if (!end) return;
    const id = setInterval(() => {
      const l = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(l);
      if (l === 0) { setEnd(null); beep(); }
    }, 250);
    return () => clearInterval(id);
  }, [end]);

  const toggleTimer = () => {
    if (end) { setEnd(null); } else { setEnd(Date.now() + (left > 0 ? left : 300) * 1000); if (left === 0) setLeft(300); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="min-h-full max-w-3xl mx-auto p-4 flex flex-col">
        <div className="flex items-center justify-between">
          <span className={`${mono} text-[11px] uppercase tracking-widest text-zinc-500`}>Анти-срыв</span>
          <div className="flex gap-2">
            <button onClick={() => setMuted(!muted)} className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">{muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>
            <button onClick={onClose} className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="my-auto py-4 space-y-4">
          <div className="w-full aspect-video rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800">
            {vErr
              ? <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600 px-6 text-center">Положи видео в public/m3-edit.mp4</div>
              : <video ref={vref} src="./m3-edit.mp4" autoPlay loop playsInline onError={() => setVErr(true)} onClick={() => (vref.current.paused ? vref.current.play() : vref.current.pause())} className="w-full h-full object-contain bg-black" />}
          </div>
          <div className="rounded-2xl bg-[#0e0e10] border border-zinc-800 p-5">
            <p className="text-sm sm:text-base text-zinc-200 leading-relaxed text-center">{text}</p>
          </div>
          <div className="rounded-2xl bg-[#0e0e10] border border-zinc-800 p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Правило 5 минут</div>
              <div className="text-xs text-zinc-500 mt-0.5">Просто начни</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`${mono} text-2xl font-bold px-3 py-1 rounded-xl bg-black border border-zinc-800`}>{mmss(left)}</span>
              <button onClick={toggleTimer} className={`${btnP} px-4 py-2.5 flex items-center gap-1.5`}>{end ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}{end ? 'Пауза' : 'Старт'}</button>
              <button onClick={() => { setEnd(null); setLeft(300); }} className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400"><RotateCcw className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        <button onClick={onClose} className="w-full py-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-200">Вернуться к делу</button>
      </div>
    </div>
  );
}

/* ============================================================================
   ПРИЛОЖЕНИЕ
   ========================================================================== */
export default function App() {
  const [state, setState] = useState(loadState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const dirty = useRef(false);
  const [tab, setTab] = useState('today');
  const [sos, setSos] = useState(false);
  const [cfg, setCfg] = useState(loadCfg);
  const [sync, setSync] = useState('local');
  const [syncErr, setSyncErr] = useState('');

  const update = useCallback((fn) => {
    dirty.current = true;
    setState((s) => ({ ...fn(s), updatedAt: Date.now() }));
  }, []);

  // мгновенное сохранение в localStorage
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* noop */ }
  }, [state]);

  const client = useMemo(
    () => (cfg.url && cfg.key ? createClient(cfg.url, cfg.key, { auth: { persistSession: false } }) : null),
    [cfg.url, cfg.key]
  );

  useEffect(() => { if (!client) setSync('local'); }, [client]);

  const push = useCallback(async () => {
    if (!client) return;
    const snap = stateRef.current;
    if (!snap.updatedAt) return;
    setSync('syncing');
    const { error } = await client.from(TABLE).upsert({ id: 'main', data: snap, updated_at: new Date(snap.updatedAt).toISOString() });
    if (error) { setSync('error'); setSyncErr(error.message); return; }
    if (stateRef.current.updatedAt === snap.updatedAt) dirty.current = false;
    setSync('synced');
  }, [client]);

  const pull = useCallback(async () => {
    if (!client) return;
    try {
      setSync('syncing');
      const { data, error } = await client.from(TABLE).select('data,updated_at').eq('id', 'main').maybeSingle();
      if (error) throw error;
      const cur = stateRef.current;
      const cloudTs = data ? Date.parse(data.updated_at) : 0;
      if (data && cloudTs > cur.updatedAt) {
        setState({ ...normalize(data.data), updatedAt: cloudTs });
        dirty.current = false;
        setSync('synced');
      } else if (cur.updatedAt > cloudTs) {
        await push();
      } else {
        setSync('synced');
      }
    } catch (e) {
      setSync('error');
      setSyncErr(e.message || String(e));
    }
  }, [client, push]);

  // первичная подтяжка + при возврате в приложение
  useEffect(() => { pull(); }, [pull]);
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'visible') pull(); };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [pull]);

  // дебаунс 1 сек
  useEffect(() => {
    if (!client || !dirty.current) return;
    setSync('syncing');
    const t = setTimeout(push, 1000);
    return () => clearTimeout(t);
  }, [state.updatedAt, client, push]);

  const saveCfg = (c) => {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch { /* noop */ }
    setCfg(c);
  };

  const tabs = [
    { id: 'today', label: 'Сегодня', Icon: Sun },
    { id: 'gym', label: 'Зал', Icon: Dumbbell },
    { id: 'goals', label: 'Цели', Icon: Target },
    { id: 'system', label: 'Система', Icon: Settings }
  ];
  const syncLabel = { local: 'Local', syncing: 'Syncing', synced: 'Cloud Synced', error: 'Sync Error' }[sync];

  return (
    <div className="min-h-screen bg-base text-zinc-50">
      <header className="sticky top-0 z-20 bg-base/95 backdrop-blur border-b border-line" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`${mono} text-sm font-bold tracking-[0.2em]`}>M-PROTOCOL</span>
            <span className="flex items-center gap-1.5 text-[10px] text-zinc-500" title={sync === 'error' ? syncErr : ''}>
              <span className={`w-1.5 h-1.5 rounded-full border ${sync === 'synced' ? 'bg-zinc-50 border-zinc-50' : sync === 'error' ? 'bg-zinc-600 border-zinc-400' : 'border-zinc-500'}`} />
              <span className={mono}>{syncLabel}</span>
            </span>
          </div>
          <button onClick={() => setSos(true)} className={`${btn} px-3 py-2 flex items-center gap-1.5`}><Zap className="w-3.5 h-3.5" />Мне лень</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-32">
        {tab === 'today' && <TodayTab state={state} update={update} goto={setTab} />}
        {tab === 'gym' && <GymTab state={state} update={update} />}
        {tab === 'goals' && <GoalsTab state={state} update={update} openSos={() => setSos(true)} />}
        {tab === 'system' && <SystemTab state={state} update={update} cfg={cfg} saveCfg={saveCfg} sync={sync} syncErr={syncErr} syncNow={pull} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-base/95 backdrop-blur border-t border-line" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-2xl mx-auto grid grid-cols-4">
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => { setTab(id); window.scrollTo(0, 0); }} className={`h-[60px] flex flex-col items-center justify-center gap-1 ${tab === id ? 'text-zinc-50' : 'text-zinc-600'}`}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {sos && <SosModal text={state.sos} onClose={() => setSos(false)} />}
    </div>
  );
}
