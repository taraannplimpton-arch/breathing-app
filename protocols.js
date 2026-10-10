(function (root) {
  const BREATHING = {
    APP_VERSION: "1.5.0",
    SESSION_MS: 5 * 60 * 1000,
    DURATION_MINUTES: [1, 2, 5, 10],
    MIN_SCALE: 0.42,
    MAX_SCALE: 1,
    PATTERNS: {
      rest: {
        id: "rest",
        homeLabel: "Calm Down",
        protocol: "2–1–6",
        mood: "calm",
        technique: "Nose inhale, short nose top-up, long mouth exhale",
        // Cyclic sighing loop (9s cycle): 2s nasal inhale, 1s nasal top-up, 6s mouth exhale.
        phases: [
          { id: "inhale", seconds: 2 },
          { id: "inhale2", seconds: 1 },
          { id: "exhale", seconds: 6 },
        ],
        colors: {
          inhale: { fill: "#7f88c8", glow: "rgba(110, 122, 190, 0.38)", atmosphere: "#090814" },
          inhale2: { fill: "#9aa3d8", glow: "rgba(140, 150, 210, 0.42)", atmosphere: "#0b0a18" },
          exhale: { fill: "#4e5bac", glow: "rgba(78, 91, 172, 0.32)", atmosphere: "#06060d" },
        },
      },
      energy: {
        id: "energy",
        homeLabel: "Energy",
        protocol: "4–2",
        mood: "bright",
        technique: "Nose inhale and nose exhale (shorter out). Stop if you feel lightheaded. More air isn't better.",
        maxMinutes: 1,
        phases: [
          { id: "inhale", seconds: 4 },
          { id: "exhale", seconds: 2 },
        ],
        colors: {
          inhale: { fill: "#ffc46a", glow: "rgba(255, 176, 72, 0.55)", atmosphere: "#2a1608" },
          exhale: { fill: "#d44512", glow: "rgba(210, 70, 20, 0.4)", atmosphere: "#160a06" },
        },
      },
      hrv: {
        id: "hrv",
        homeLabel: "HRV",
        protocol: "5–5",
        mood: "steady",
        technique: "Nose inhale and nose exhale, soft belly",
        phases: [
          { id: "inhale", seconds: 5 },
          { id: "exhale", seconds: 5 },
        ],
        colors: {
          inhale: { fill: "#6ef0d8", glow: "rgba(80, 220, 196, 0.5)", atmosphere: "#072422" },
          exhale: { fill: "#0c7a71", glow: "rgba(12, 122, 113, 0.4)", atmosphere: "#041412" },
        },
      },
      focus: {
        id: "focus",
        homeLabel: "Focus",
        protocol: "Box",
        mood: "steady",
        technique: "Nose inhale, nose hold, nose exhale, nose hold — all through the nose",
        phases: [
          { id: "inhale", seconds: 4 },
          { id: "hold", seconds: 4 },
          { id: "exhale", seconds: 4 },
          { id: "hold", seconds: 4 },
        ],
        colors: {
          inhale: { fill: "#7ec3ff", glow: "rgba(90, 170, 255, 0.5)", atmosphere: "#0d1a30" },
          hold: { fill: "#b7a6ff", glow: "rgba(170, 150, 255, 0.46)", atmosphere: "#161430" },
          exhale: { fill: "#2758e2", glow: "rgba(39, 88, 226, 0.42)", atmosphere: "#07101f" },
        },
      },
      sleep: {
        id: "sleep",
        homeLabel: "Sleep",
        protocol: "4–6",
        mood: "calm",
        technique: "Small breath, easy longer exhale. Counts fade once the rhythm settles.",
        dropCountAfterCycles: 4,
        phases: [
          { id: "inhale", seconds: 4 },
          { id: "exhale", seconds: 6 },
        ],
        colors: {
          inhale: { fill: "#6d739e", glow: "rgba(90, 96, 150, 0.32)", atmosphere: "#07060c" },
          exhale: { fill: "#646a90", glow: "rgba(100, 106, 144, 0.28)", atmosphere: "#05050a" },
        },
      },
    },
    URGE: {
      id: "urge",
      homeLabel: "Think First",
      protocol: "4–6",
      technique: "Stop, notice, then choose.",
      description: "That airport candy, the reply-all, the cart checkout. Breathe first, then decide.",
      durationNote: "About 3 minutes.",
      breaths: 15,
      breathCountWrap: 10,
      stopMs: 5000,
      observeMs: 10000,
      expandMs: 8000,
      waveRiseMs: 60000,
      pattern: {
        id: "urge",
        mood: "still",
        phases: [
          { id: "inhale", seconds: 4 },
          { id: "exhale", seconds: 6 },
        ],
        colors: {
          inhale: { fill: "#c4a48a", glow: "rgba(180, 140, 110, 0.28)", atmosphere: "#1a1410" },
          exhale: { fill: "#7c5e4b", glow: "rgba(124, 94, 75, 0.24)", atmosphere: "#0c0a08" },
        },
      },
      lines: {
        stop: "Pause. Put it down.",
        observe: "Notice the pull. Where do you feel it?",
        expand: "Notice what changed. Widen your view.",
        respond: "What's your next move?",
        again: "Another round",
        done: "Done",
      },
    },
  };

  root.BREATHING = BREATHING;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = BREATHING;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
