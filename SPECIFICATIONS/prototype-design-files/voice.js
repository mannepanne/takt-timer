// voice.js — natural language parser for timer commands
// Simulated voice input (no real mic API) — parses the transcript string into actions.

(function() {
  const wordNum = {
    zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10,
    eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, twenty:20, thirty:30, forty:40,
    fifty:50, sixty:60, ninety:90,
    'a':1, 'an':1,
  };

  function parseNumber(tok) {
    if (tok == null) return NaN;
    const n = parseInt(tok, 10);
    if (!isNaN(n)) return n;
    return wordNum[tok.toLowerCase()] ?? NaN;
  }

  // Returns seconds from a duration clause following an index in tokens
  // Examples handled: "1 minute", "90 seconds", "2:30", "two minutes thirty seconds"
  function parseDurationAt(tokens, i) {
    const tok = tokens[i];
    if (!tok) return { seconds: NaN, next: i };

    // mm:ss
    if (/^\d+:\d+$/.test(tok)) {
      const [m, s] = tok.split(':').map(Number);
      return { seconds: m*60 + s, next: i+1 };
    }

    let n = parseNumber(tok);
    if (isNaN(n)) return { seconds: NaN, next: i };
    let j = i + 1;
    let seconds = 0;
    let unitFound = false;

    const unitAt = (k) => {
      const t = tokens[k]?.toLowerCase();
      if (!t) return null;
      if (/^min(ute)?s?$/.test(t)) return 'min';
      if (/^sec(ond)?s?$/.test(t)) return 'sec';
      if (/^hr?s?$|^hour(s)?$/.test(t)) return 'hr';
      return null;
    };

    let unit = unitAt(j);
    if (unit) {
      j++;
      if (unit === 'min') seconds += n * 60;
      else if (unit === 'sec') seconds += n;
      else if (unit === 'hr') seconds += n * 3600;
      unitFound = true;

      // look for "and 30 seconds" or "30 seconds"
      if (tokens[j]?.toLowerCase() === 'and') j++;
      const m = parseNumber(tokens[j]);
      if (!isNaN(m)) {
        const u2 = unitAt(j+1);
        if (u2) {
          if (u2 === 'sec') seconds += m;
          else if (u2 === 'min') seconds += m * 60;
          j += 2;
        }
      }
    } else {
      // bare number — assume seconds if small, guess context later
      return { seconds: NaN, next: i };
    }

    return { seconds: unitFound ? seconds : NaN, next: j };
  }

  function fmtTime(s) {
    const m = Math.floor(s/60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2,'0')}`;
  }

  // Parses a "session" command: sets, work duration, rest duration
  function parseSessionCommand(text) {
    const s = text.toLowerCase().replace(/[,\.?!\u2014\u2013-]/g,' ').replace(/\s+/g,' ').trim();
    const tokens = s.split(' ').filter(Boolean);

    let sets = null;
    let work = null;
    let rest = null;

    // sets: look for "<n> sets" or "<n> rounds"
    for (let i = 0; i < tokens.length - 1; i++) {
      if (/^sets?$|^rounds?$|^reps?$/.test(tokens[i+1])) {
        const n = parseNumber(tokens[i]);
        if (!isNaN(n)) { sets = n; break; }
      }
    }

    // work duration: after "of" or "for" or after "sets of"
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === 'of' || tokens[i] === 'for') {
        const r = parseDurationAt(tokens, i+1);
        if (!isNaN(r.seconds)) { work = r.seconds; break; }
      }
    }
    // fallback: first duration in string
    if (work == null) {
      for (let i = 0; i < tokens.length; i++) {
        const r = parseDurationAt(tokens, i);
        if (!isNaN(r.seconds)) { work = r.seconds; break; }
      }
    }

    // rest duration: after "rest"
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === 'rest' || tokens[i] === 'break') {
        // search nearby for a duration
        for (let j = Math.max(0, i-3); j < Math.min(tokens.length, i+6); j++) {
          if (j === i) continue;
          const r = parseDurationAt(tokens, j);
          if (!isNaN(r.seconds) && r.seconds !== work) { rest = r.seconds; break; }
        }
        if (rest != null) break;
      }
    }

    return {
      sets: sets ?? 3,
      workSec: work ?? 60,
      restSec: rest ?? 30,
    };
  }

  function parseCommand(text, presets = []) {
    const s = text.toLowerCase().trim();

    // Save
    const saveMatch = s.match(/save (?:this |that )?(?:as )?(?:a )?preset(?: called| named)? ["']?(.+?)["']?$/i)
      || s.match(/save (?:as )?["']?(.+?)["']?$/i)
      || s.match(/name (?:this|it) ["']?(.+?)["']?$/i);
    if (saveMatch) {
      return { type: 'save', name: saveMatch[1].trim().replace(/^(a|an|the)\s+/, '') };
    }

    // Run / start preset
    const runMatch = s.match(/^(?:run|start|play|go|begin|do)\s+(.+)$/i);
    if (runMatch) {
      const query = runMatch[1].trim();
      const preset = presets.find(p => p.name.toLowerCase() === query)
        || presets.find(p => p.name.toLowerCase().includes(query))
        || presets.find(p => query.includes(p.name.toLowerCase()));
      if (preset) return { type: 'runPreset', preset };
      // fall through to session parse
    }

    // Delete / rename — skip for prototype

    // Default: session command
    if (/set|round|rep|minute|second|rest|break|:/i.test(s)) {
      return { type: 'session', ...parseSessionCommand(s) };
    }

    // Unknown — best-effort as session
    return { type: 'session', ...parseSessionCommand(s) };
  }

  window.Takt = window.Takt || {};
  window.Takt.parseCommand = parseCommand;
  window.Takt.fmtTime = fmtTime;
})();
