// FSRS-4.5 scheduler (default parameters), implemented from the published algorithm.
// Grades: 1 Again, 2 Hard, 3 Good, 4 Easy. Same-day learning steps are skipped:
// the client re-queues "Again" cards within the session; the server schedules the next day.
const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5, FACTOR = 19 / 81, MAX_INTERVAL = 36500;
const clampD = (d) => Math.min(10, Math.max(1, d));
const initD = (g) => clampD(W[4] - (g - 3) * W[5]);
const initS = (g) => Math.max(0.1, W[g - 1]);
export const retrievability = (t, s) => Math.pow(1 + (FACTOR * t) / s, DECAY);

function nextD(d, g) {
  const dd = d - W[6] * (g - 3);
  return clampD(W[7] * initD(3) + (1 - W[7]) * dd);
}
function nextRecallS(d, s, r, g) {
  const hard = g === 2 ? W[15] : 1, easy = g === 4 ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) *
    (Math.exp((1 - r) * W[10]) - 1) * hard * easy);
}
function nextForgetS(d, s, r) {
  return Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]));
}

// prev: null for a new card, else {stability, difficulty, reps, lapses, last_review}
export function schedule(prev, grade, now = new Date()) {
  let s, d, reps = 1, lapses = 0, elapsed = 0;
  if (!prev) {
    s = initS(grade); d = initD(grade);
  } else {
    elapsed = Math.max(0, (now - new Date(prev.last_review)) / 86400000);
    const r = retrievability(elapsed, prev.stability);
    d = nextD(prev.difficulty, grade);
    reps = prev.reps + 1; lapses = prev.lapses;
    if (grade === 1) { s = Math.max(0.1, nextForgetS(prev.difficulty, prev.stability, r)); lapses++; }
    else s = nextRecallS(prev.difficulty, prev.stability, r, grade);
  }
  let due, state;
  if (grade === 1) { due = new Date(now.getTime() + 10 * 60000); state = 1; }
  else {
    const days = Math.min(MAX_INTERVAL, Math.max(1, Math.round(s * (Math.pow(0.9, 1 / DECAY) - 1) / FACTOR)));
    due = new Date(now.getTime() + days * 86400000); state = 2;
  }
  return { stability: s, difficulty: d, reps, lapses, state, due: due.toISOString(),
    last_review: now.toISOString(), elapsed_days: elapsed };
}
