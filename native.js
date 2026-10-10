(function (root) {
  "use strict";

  // Neither wrapper documents a "soft" style. Exhale uses the lightest one they do.
  // Despia local notifications are one-shot: nothing can cancel or repeat them.
  // Mindful Session is a category sample. Despia's quantity health write is the
  // wrong type, and Median documents no HealthKit JavaScript API, so this file
  // never sends one. A category writer is detected only if a wrapper adds it.

  const REMINDER_BODY = "A minute to breathe, whenever you're ready.";
  const REMINDER_TITLE = "Breathwork";

  const KEYS = {
    reminder: "breathe.reminder",
    reminderTime: "breathe.reminderTime",
    reminderArmedFor: "breathe.reminderArmedFor",
    health: "breathe.health",
  };

  function hapticIntent(phaseId) {
    const id = String(phaseId || "");
    if (id === "end") {
      return "success";
    }
    if (id.indexOf("hold") === 0) {
      return "none";
    }
    if (id.indexOf("exhale") === 0) {
      return "soft";
    }
    if (id.indexOf("inhale") === 0) {
      return "light";
    }
    return "none";
  }

  function medianStyle(intent, android) {
    if (intent === "success") {
      return "notificationSuccess";
    }
    if (intent === "light") {
      return "impactLight";
    }
    if (intent === "soft") {
      return android ? "tick" : "impactLight";
    }
    return null;
  }

  function despiaCommand(intent) {
    if (intent === "light" || intent === "soft") {
      return "lighthaptic://";
    }
    if (intent === "success") {
      return "successhaptic://";
    }
    return null;
  }

  function vibratePattern(intent) {
    if (intent === "light") {
      return 12;
    }
    if (intent === "soft") {
      return 6;
    }
    if (intent === "success") {
      return [12, 40, 12];
    }
    return null;
  }

  function mapHaptic(phaseId, kind, android) {
    const intent = hapticIntent(phaseId);
    const action = {
      intent: intent,
      kind: kind || "none",
      style: null,
      command: null,
      pattern: null,
    };
    if (intent === "none") {
      return action;
    }
    if (kind === "median") {
      action.style = medianStyle(intent, Boolean(android));
      return action;
    }
    if (kind === "despia") {
      action.command = despiaCommand(intent);
      return action;
    }
    if (kind === "vibrate") {
      action.pattern = vibratePattern(intent);
      return action;
    }
    return action;
  }

  function medianBridge(win) {
    const host = win || {};
    if (host.median && host.median.haptics && typeof host.median.haptics.trigger === "function") {
      return host.median;
    }
    if (host.gonative && host.gonative.haptics && typeof host.gonative.haptics.trigger === "function") {
      return host.gonative;
    }
    return null;
  }

  function despiaPresent(win, nav) {
    const host = win || {};
    if (typeof host.despia !== "undefined") {
      return true;
    }
    const ua = nav && nav.userAgent ? String(nav.userAgent) : "";
    return ua.toLowerCase().indexOf("despia") !== -1;
  }

  function vibrateSupported(nav) {
    return typeof nav !== "undefined" && nav !== null && typeof nav.vibrate === "function";
  }

  function isAndroid(nav) {
    const ua = nav && nav.userAgent ? String(nav.userAgent) : "";
    return ua.toLowerCase().indexOf("android") !== -1;
  }

  function hapticsKind(win, nav) {
    if (medianBridge(win)) {
      return "median";
    }
    if (despiaPresent(win, nav)) {
      return "despia";
    }
    if (vibrateSupported(nav)) {
      return "vibrate";
    }
    return "none";
  }

  function hapticsAvailable(win, nav) {
    return hapticsKind(win, nav) !== "none";
  }

  function reminderAvailable(win, nav) {
    return despiaPresent(win, nav);
  }

  function healthWriter(win) {
    const host = win || {};
    const kit = host.median && host.median.healthkit;
    if (kit && typeof kit.writeMindfulSession === "function") {
      return kit.writeMindfulSession;
    }
    return null;
  }

  function healthAvailable(win) {
    return healthWriter(win) != null;
  }

  function sendDespia(win, nav, command) {
    if (!win || !despiaPresent(win, nav)) {
      return false;
    }
    try {
      if (typeof win.despia === "function") {
        win.despia(command);
        return true;
      }
      win.despia = command;
      return true;
    } catch (err) {
      return false;
    }
  }

  function playHaptic(win, nav, phaseId) {
    let mapped = null;
    try {
      const kind = hapticsKind(win, nav);
      mapped = mapHaptic(phaseId, kind, isAndroid(nav));
      if (mapped.intent === "none") {
        mapped.played = false;
        return mapped;
      }
      if (kind === "median" && mapped.style) {
        medianBridge(win).haptics.trigger({ style: mapped.style });
        mapped.played = true;
        return mapped;
      }
      if (kind === "despia" && mapped.command) {
        mapped.played = sendDespia(win, nav, mapped.command);
        return mapped;
      }
      if (kind === "vibrate" && mapped.pattern != null && vibrateSupported(nav)) {
        nav.vibrate(mapped.pattern);
        mapped.played = true;
        return mapped;
      }
    } catch (err) {
      if (mapped) {
        mapped.played = false;
        return mapped;
      }
      return {
        intent: "none",
        kind: "none",
        style: null,
        command: null,
        pattern: null,
        played: false,
      };
    }
    if (mapped) {
      mapped.played = false;
    }
    return mapped;
  }

  function pad2(n) {
    const value = Number(n) || 0;
    return (value < 10 ? "0" : "") + value;
  }

  function nextReminderDate(nowMs, hour, minute) {
    const h = Number(hour);
    const m = Number(minute);
    const safeH = h >= 0 && h <= 23 && h === Math.floor(h) ? h : 8;
    const safeM = m >= 0 && m <= 59 && m === Math.floor(m) ? m : 0;
    const instant = Number(nowMs);
    const now = new Date(instant);
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), safeH, safeM, 0, 0);
    if (!(target.getTime() > instant)) {
      target.setDate(target.getDate() + 1);
    }
    return target;
  }

  function nextReminderDelaySeconds(nowMs, hour, minute) {
    const target = nextReminderDate(nowMs, hour, minute);
    const delta = target.getTime() - Number(nowMs);
    if (!(delta > 0)) {
      return 1;
    }
    return Math.max(1, Math.round(delta / 1000));
  }

  function reminderOccurrenceKey(nowMs, hour, minute) {
    const target = nextReminderDate(nowMs, hour, minute);
    return (
      target.getFullYear() +
      "-" +
      pad2(target.getMonth() + 1) +
      "-" +
      pad2(target.getDate()) +
      " " +
      pad2(target.getHours()) +
      ":" +
      pad2(target.getMinutes())
    );
  }

  function planReminder(nowMs, hour, minute, armedKey) {
    const key = reminderOccurrenceKey(nowMs, hour, minute);
    return {
      delaySeconds: nextReminderDelaySeconds(nowMs, hour, minute),
      key: key,
      schedule: String(armedKey || "") !== key,
    };
  }

  function localReminderCommand(seconds, body, title, url) {
    const delay = Math.max(1, Math.round(Number(seconds) || 0));
    return (
      "sendlocalpushmsg://push.send?s=" +
      delay +
      "=msg!" +
      encodeURIComponent(body == null ? "" : String(body)) +
      "&!#" +
      encodeURIComponent(title == null ? "" : String(title)) +
      "&!#" +
      encodeURIComponent(url == null ? "" : String(url))
    );
  }

  function parseClock(value) {
    const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(value || "").trim());
    if (!match) {
      return null;
    }
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) {
      return null;
    }
    return { hour: hour, minute: minute };
  }

  function formatClock(hour, minute) {
    return pad2(hour) + ":" + pad2(minute);
  }

  function appStartUrl(loc) {
    if (loc && typeof loc.href === "string" && loc.href) {
      return loc.href.split("#")[0];
    }
    return "./";
  }

  function mindfulSample(durationMs, nowMs) {
    const ms = Math.max(0, Math.round(Number(durationMs) || 0));
    const end = Math.round(Number(nowMs) || 0);
    return {
      durationMs: ms,
      minutes: Math.round(ms / 60000),
      startMs: end - ms,
      endMs: end,
    };
  }

  function writeMindfulSession(win, durationMs, nowMs) {
    const sample = mindfulSample(durationMs, nowMs == null ? Date.now() : nowMs);
    if (sample.durationMs <= 0) {
      return { wrote: false, sample: sample };
    }
    const writer = healthWriter(win);
    if (!writer) {
      return { wrote: false, sample: sample };
    }
    try {
      writer(sample);
      return { wrote: true, sample: sample };
    } catch (err) {
      return { wrote: false, sample: sample };
    }
  }

  const api = {
    REMINDER_BODY: REMINDER_BODY,
    REMINDER_TITLE: REMINDER_TITLE,
    KEYS: KEYS,
    hapticIntent: hapticIntent,
    mapHaptic: mapHaptic,
    hapticsKind: hapticsKind,
    hapticsAvailable: hapticsAvailable,
    reminderAvailable: reminderAvailable,
    healthAvailable: healthAvailable,
    playHaptic: playHaptic,
    sendDespia: sendDespia,
    nextReminderDelaySeconds: nextReminderDelaySeconds,
    reminderOccurrenceKey: reminderOccurrenceKey,
    planReminder: planReminder,
    localReminderCommand: localReminderCommand,
    parseClock: parseClock,
    formatClock: formatClock,
    appStartUrl: appStartUrl,
    mindfulSample: mindfulSample,
    writeMindfulSession: writeMindfulSession,
  };

  root.BREATHING_NATIVE = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
