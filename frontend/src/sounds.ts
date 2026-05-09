// Sound system — file-based with Web Audio fallback

const SOUND_FILES: Record<string, string> = {
  // Run pool (random pick when tests start) — starcraft-confirm NOT here
  "locked-in":                     "/sounds/locked-in.mp3",
  "course-laid-in":                "/sounds/course-laid-in.mp3",
  "make-it-so":                    "/sounds/make-it-so_LviqthA.mp3",
  "easy-thrusters":                "/sounds/easy-thrusters.mp3",
  "hostiles-confirmed-and-locked": "/sounds/hostiles-confirmed-and-locked.mp3",
  "checklist-protocol-initiated":  "/sounds/checklist-protocol-initiated.mp3",
  "i-copy-that":                   "/sounds/i-copy-that.mp3",
  // UI click (buttons, tags, queue, pin)
  "starcraft-confirm":             "/sounds/starcraft-confirm.mp3",
  // Boot (page ready — pick random between the two)
  "all-hands":                     "/sounds/all-hands.mp3",
  "commlink-online":               "/sounds/commlink-online.mp3",
  // Completion
  "research-complete":             "/sounds/research-complete.mp3",
  "ghost-death":                   "/sounds/ghost-death.mp3",
  "marine-death":                  "/sounds/marine-death.mp3",
  // Misc UI
  tab:                             "/sounds/tab.ogg",
};

// Run pool — starcraft-confirm excluded
const RUN_POOL  = ["locked-in", "course-laid-in", "make-it-so",
                   "easy-thrusters", "hostiles-confirmed-and-locked", "checklist-protocol-initiated",
                   "i-copy-that"];
const FAIL_POOL = ["ghost-death", "marine-death"];
const BOOT_POOL = ["all-hands", "commlink-online"];

const audioCache    = new Map<string, HTMLAudioElement>();
const fileAvailable = new Map<string, boolean>();

// Tracks currently playing pool sounds — interlock: never two run sounds at once
const activeSounds = new Set<HTMLAudioElement>();

Object.entries(SOUND_FILES).forEach(([name, url]) => {
  fetch(url, { method: "HEAD" })
    .then(r => {
      fileAvailable.set(name, r.ok);
      if (r.ok) {
        const a = new Audio(url);
        a.preload = "auto";
        audioCache.set(name, a);
      }
    })
    .catch(() => fileAvailable.set(name, false));
});

function playFile(name: string, volume = 0.6): boolean {
  if (!fileAvailable.get(name)) return false;
  const cached = audioCache.get(name);
  if (!cached) return false;
  const clone = cached.cloneNode() as HTMLAudioElement;
  clone.volume = volume;
  clone.play().catch(() => {});
  return true;
}

// Run pool sound with interlock — skip if any run sound already playing
// (interlock only for run-start sounds, NOT for completion sounds)
function playPoolSound(name: string): boolean {
  if (activeSounds.size > 0) return true;
  if (!fileAvailable.get(name)) return false;
  const cached = audioCache.get(name);
  if (!cached) return false;
  const clone = cached.cloneNode() as HTMLAudioElement;
  clone.volume = 0.6;
  activeSounds.add(clone);
  clone.addEventListener("ended", () => activeSounds.delete(clone), { once: true });
  clone.addEventListener("pause",  () => activeSounds.delete(clone), { once: true });
  clone.play().catch(() => activeSounds.delete(clone));
  return true;
}

function pickRandom(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Web Audio fallback ───────────────────────────────────────────────────────

let _ctx: AudioContext | null = null;
function ac(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

function osc(type: OscillatorType, freq: number, gain: number, dur: number, delay = 0, freqEnd?: number) {
  const ctx = ac();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const now = ctx.currentTime + delay;
  o.connect(g); g.connect(ctx.destination);
  o.type = type;
  o.frequency.setValueAtTime(freq, now);
  if (freqEnd !== undefined) o.frequency.exponentialRampToValueAtTime(freqEnd, now + dur);
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.start(now); o.stop(now + dur + 0.01);
}

const SYNTH: Record<string, () => void> = {
  click: () => osc("square", 660, 0.12, 0.07, 0, 330),
  run:   () => { osc("square", 330, 0.09, 0.07, 0); osc("square", 440, 0.09, 0.07, 0.065); osc("square", 550, 0.09, 0.08, 0.13); },
  pass:  () => { osc("sine", 523, 0.12, 0.14, 0); osc("sine", 659, 0.12, 0.14, 0.08); osc("sine", 784, 0.14, 0.18, 0.16); },
  fail:  () => { osc("sawtooth", 440, 0.10, 0.12, 0); osc("sawtooth", 370, 0.09, 0.12, 0.07); osc("sawtooth", 293, 0.08, 0.18, 0.14, 220); },
  tab:   () => osc("sine", 660, 0.06, 0.06, 0, 440),
};

// ─── Public API ───────────────────────────────────────────────────────────────

/** Any UI button (non-run): tags, queue btn, pin btn, sidebar tabs, etc. */
export function playClick() {
  if (!playFile("starcraft-confirm")) SYNTH.click?.();
}
export function playHover() { SYNTH.click?.(); }

/** Queue/pin buttons on cards — same as click */
export function playQueue() { playClick(); }
export function playPin()   { playClick(); }

/** Sidebar tab switch */
export function playTab() {
  if (!playFile("tab")) SYNTH.tab?.();
}

/** Test execution starts — random from run pool (no starcraft-confirm) */
export function playRun() {
  if (!playPoolSound(pickRandom(RUN_POOL))) SYNTH.run?.();
}

/** Page fully loaded and operative — random between all-hands / commlink-online */
export function playBoot() {
  playFile(pickRandom(BOOT_POOL));
}

/** Batch test completion — pass = research-complete, fail = ghost-death */
export function playTestComplete(allPassed: boolean) {
  if (allPassed) {
    if (!playFile("research-complete")) SYNTH.pass?.();
  } else {
    if (!playFile(pickRandom(FAIL_POOL))) SYNTH.fail?.();
  }
}

/** Single test result (non-batch) — plays regardless of run pool interlock */
export function playPass() {
  if (!playFile("research-complete")) SYNTH.pass?.();
}
export function playFail() {
  if (!playFile(pickRandom(FAIL_POOL))) SYNTH.fail?.();
}
