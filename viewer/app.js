(function () {
  "use strict";

  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var STORE = 'taskvis.view.v1';

  var ICON = {
    box:   '<path d="M2 5.2 8 2.4l6 2.8v5.6L8 13.6 2 10.8z"/><path d="M2 5.2 8 8l6-2.8M8 8v5.6"/>',
    truck: '<path d="M1 4.5h8.2v6H1z"/><path d="M9.2 6.6h2.6L14.4 9v1.5H9.2z"/><circle cx="4.2" cy="11.6" r="1.5"/><circle cx="11.3" cy="11.6" r="1.5"/>',
    plane: '<path d="M1.6 8.4 14.4 3.6l-3 5.2 1.1 4.4-2.4-1.5-2.2 1.9-.4-3.1z"/>',
    ship:  '<path d="M2.4 9.6h11.2l-1.7 3.8H4.1z"/><path d="M4.3 9.6V5.8h7.4v3.8M8 5.8V3.2"/>',
    depot: '<path d="M1.8 6.8 8 3.4l6.2 3.4v6.4H1.8z"/><path d="M5.6 13.2V9h4.8v4.2"/>',
    store: '<path d="M2 6.4h12v6.8H2z"/><path d="M2 6.4 3.4 3h9.2L14 6.4"/><path d="M6.4 13.2V9.4h3.2v3.8"/>',
    clock: '<circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.4 1.6"/>'
  };
  var ICONS = ['box', 'truck', 'plane', 'ship', 'depot', 'store', 'clock'];
  function ico(k) {
    return '<svg class="i" viewBox="0 0 16 16" width="14" height="14" fill="none" ' +
      'stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">' +
      (ICON[k] || ICON.clock) + '</svg>';
  }

  // ── What a task is ────────────────────────────────────────────────────────
  // A start, a stop, and where it ends up. Both times are typed, in hours from
  // midnight on day 0, so every task carries exactly the same fields and the
  // list is one grid rather than a different set of controls per kind.
  //
  //   { id, name, place, icon, note, s, e, after: [ids] }
  //
  // Nothing is derived from the graph. `after` records what has to happen
  // first, which is what the links are drawn from, but it does NOT push times
  // about: the next start does not have to be the previous stop. A gap is a
  // gap and gets drawn as one; an overlap is two things happening at once,
  // which is often the truth and used to be inexpressible.
  //
  // Opening hours belong to a PLACE, not to a task. Costco receiving is open 4
  // to 11 whether or not anything is driving towards it.

  // ── Reading the schedule ──────────────────────────────────────────────────
  // The Google Sheet is the schedule. legs.csv is the snapshot the build
  // committed beside it, so the page works with no network and the diff shows
  // what changed. A refresh reads the sheet, which means an edit there is on
  // the screen without anyone running a build.
  //
  // This is the ONLY place a row of CSV becomes a journey. The build used to
  // do the same job again in Python; it does not any more, so there is one set
  // of rules and they cannot drift apart.

  function csvRows(text) {
    var rows = [], row = [], cell = '', q = false, i, c;
    text = String(text).replace(/\r\n?/g, '\n');
    for (i = 0; i < text.length; i++) {
      c = text.charAt(i);
      if (q) {
        if (c !== '"') cell += c;
        else if (text.charAt(i + 1) === '"') { cell += '"'; i++; }
        else q = false;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // Both spellings of every column, so the sheet's headings and the snapshot's
  // read the same and neither has to be rewritten to match the other.
  var COL = {
    'crop': 'crop', 'fob': 'fob', 'transport': 'transport',
    'start day': 'start_day', 'start_day': 'start_day',
    'branch': 'branch', 'leg': 'leg',
    'start location': 'from', 'start_location': 'from',
    'start dt': 's', 'start_dt': 's',
    'end location': 'place', 'end_location': 'place',
    'end dt': 'e', 'end_dt': 'e',
    'icon': 'icon', 'note': 'note'
  };
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function legRows(text) {
    var rows = csvRows(text), head = -1, i;
    // The sheet keeps its own margins -- blank columns to the left, blank rows
    // above -- so the header is found by what it names rather than by where it
    // sits. Every layout has a leg and a time it starts.
    for (i = 0; i < rows.length && head < 0; i++) {
      var seen = {};
      rows[i].forEach(function (c) { seen[c.trim().toLowerCase()] = 1; });
      if (seen.leg && seen['start dt']) head = i;
    }
    if (head < 0) throw new Error('no header row naming both Leg and Start dt');
    var keep = [];
    rows[head].forEach(function (h, k) {
      var name = h.trim().toLowerCase();
      if (has(COL, name)) keep.push([k, COL[name]]);
    });
    function got(k) {
      for (var n = 0; n < keep.length; n++) if (keep[n][1] === k) return true;
      return false;
    }
    ['leg', 's', 'e'].forEach(function (k) {
      if (!got(k)) throw new Error('no column for ' + k);
    });
    if (!got('crop') && !got('fob') && !got('transport')) {
      throw new Error('nothing names the journey: needs Crop, FOB or Transport');
    }
    var out = [];
    for (i = head + 1; i < rows.length; i++) {
      var r = rows[i], rec = {};
      keep.forEach(function (pair) { rec[pair[1]] = (r[pair[0]] || '').trim(); });
      if (rec.leg) out.push(rec);
    }
    if (!out.length) throw new Error('no legs under the header');
    return out;
  }

  // Su M T W Th F Sa, and the longer forms. A bare S is not accepted: it could
  // be either end of the week and a schedule is not the place to guess.
  var DAY_WORDS = { su: 0, sun: 0, sunday: 0,
    m: 1, mo: 1, mon: 1, monday: 1,
    t: 2, tu: 2, tue: 2, tues: 2, tuesday: 2,
    w: 3, we: 3, wed: 3, wednesday: 3,
    th: 4, thu: 4, thur: 4, thurs: 4, thursday: 4,
    f: 5, fr: 5, fri: 5, friday: 5,
    sa: 6, sat: 6, saturday: 6 };

  function dayTime(spec, where) {
    // Sheets like to paste a narrow no-break space before AM/PM; flatten every
    // kind of space to one before reading.
    var t = String(spec == null ? '' : spec).replace(/[\s\u00a0\u202f]+/g, ' ').trim();
    var m = /^([A-Za-z]+) ?,? +(\d{1,2}):(\d{2})$/.exec(t);
    if (!m) throw new Error(where + ": expected a day and a time like 'Sun, 10:00', got '" + t + "'");
    var w = m[1].toLowerCase();
    if (w === 's') throw new Error(where + ": 'S' could be Sunday or Saturday -- write Su or Sa");
    if (!has(DAY_WORDS, w)) throw new Error(where + ": '" + m[1] + "' is not a day");
    var hh = +m[2], mm = +m[3];
    if (hh > 23 || mm > 59) throw new Error(where + ": '" + t + "' is not a time");
    return { d: DAY_WORDS[w], h: hh + mm / 60 };
  }

  // A leg's icon is read off its name rather than typed, so the sheet stays
  // columns of schedule and a new leg picks up a sensible glyph on its own.
  // Order matters: the first match wins, so the specific rules come before the
  // general. "Costco delivery clearance" is a clearance, not a delivery.
  var ICON_RULES = [
    [/clearance|eligib|submission|paperwork/, 'depot'],
    [/pack/, 'box'],
    [/fl(y|ight)|aloha|air\b/, 'plane'],
    [/sail|barge|boat/, 'ship'],
    [/truck|deliver|pickup|haul|drive|load/, 'truck'],
    [/receiv|store/, 'store']
  ];
  function iconFor(name) {
    var low = String(name || '').toLowerCase();
    for (var i = 0; i < ICON_RULES.length; i++) {
      if (ICON_RULES[i][0].test(low)) return ICON_RULES[i][1];
    }
    return 'clock';
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'flow';
  }

  // A journey is defined once and run on more than one cutting day, so the
  // rows group by journey and start day and each group is its own picture.
  function buildFlows(rows) {
    var hours = {};
    ((window.REF || {}).hours || []).forEach(function (h) { hours[h.place] = h; });
    var groups = {}, order = [];
    // Crop, where it is going and how it gets there name the journey; the
    // start day says which run of it this is. Four columns, one picture.
    function name(r) {
      return [r.crop, r.fob, r.transport].filter(function (v) { return v; }).join('-') || 'Journey';
    }
    rows.forEach(function (r) {
      var key = name(r) + '\u0000' + (r.start_day || '0');
      if (!has(groups, key)) { groups[key] = []; order.push(key); }
      groups[key].push(r);
    });
    return order.map(function (key) {
      var rs = groups[key], jn = name(rs[0]);
      var where0 = jn + ' / start day ' + (rs[0].start_day || '0');
      // The first leg names the day the journey starts, and every other time
      // is counted forward from there -- so one definition draws as a Sunday
      // picture and a Wednesday one without being written down twice.
      var anchor = dayTime(rs[0].s, where0).d;
      var branches = [], tasks = [];
      rs.forEach(function (r) {
        var where = where0 + ' / ' + r.leg;
        function at(spec) {
          var dt = dayTime(spec, where);
          return ((dt.d - anchor + 7) % 7) * 24 + dt.h;
        }
        var br = (r.branch || '1').trim() || '1';
        if (branches.indexOf(br) < 0) branches.push(br);
        var ic = (r.icon || '').toLowerCase();
        // Keep the weekday the leg was written on as well as the hour it lands
        // at for this journey's own anchor. One of them draws a single journey
        // from its cut; the other hangs every journey on the same week.
        var ds = dayTime(r.s, where), de = dayTime(r.e, where);
        tasks.push({ id: 't' + tasks.length, name: r.leg, branch: br,
          from: r.from || 'Somewhere', place: r.place || 'Somewhere',
          s: at(r.s), e: at(r.e),
          sd: ds.d, sh: ds.h, ed: de.d, eh: de.h,
          icon: ICONS.indexOf(ic) < 0 ? iconFor(r.leg) : ic,
          note: r.note || '' });
      });
      // Within a branch the rows are already in order, and that is the whole
      // dependency story -- nothing needs an "after" column to say what the
      // sheet already says.
      var last = {};
      tasks.forEach(function (t) {
        t.after = has(last, t.branch) ? [last[t.branch]] : [];
        last[t.branch] = t.id;
      });
      var wins = {};
      tasks.forEach(function (t) {
        [t.from, t.place].forEach(function (pl) {
          if (has(hours, pl)) {
            wins[pl] = { days: hours[pl].days, open: hours[pl].open, close: hours[pl].close };
          }
        });
      });
      // The journey a leg belongs to, which is what it is coloured by. The
      // start day is not part of it: the same journey run on Sunday and on
      // Wednesday is one thing happening twice, and reads better as one.
      tasks.forEach(function (t) { t.def = jn; });
      return { id: slug(jn) + '-' + slug(DOW[anchor]), name: jn, start: DOW[anchor],
        crop: rs[0].crop || '', fob: rs[0].fob || '', transport: rs[0].transport || '',
        branches: branches, tasks: tasks, windows: wins };
    });
  }

  var F = [], DATA = window.DATA || {};
  var S = { sel: {}, tab: 'flow' };
  // Where the drawn schedule came from, so the line above the chart can say.
  var SRC = { live: false, at: null, why: '' };
  try {
    var sv = JSON.parse(window.localStorage.getItem(STORE) || 'null');
    if (sv) {
      if (sv.sel) S.sel = sv.sel;
      if (sv.tab) S.tab = sv.tab;
      if (sv.rates) S.rates = sv.rates;
    }
  } catch (e) { /* nothing stored, or junk in the slot */ }
  S.rates = S.rates || {};
  function save() {
    try { window.localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {}
  }
  function cur() {
    var list = shown();
    return list.length === 1 ? list[0] : null;
  }

  // ── Clock ─────────────────────────────────────────────────────────────────
  var SPAN = 3, ANCHOR = 'Sun';
  var dowIdx = function (n) { return DOW.indexOf(n); };
  function clock(h) {
    var t = ((Math.round(h * 4) / 4 % 24) + 24) % 24, hh = Math.floor(t);
    var mn = Math.round((t - hh) * 60), m = mn ? ':' + (mn < 10 ? '0' : '') + mn : '';
    return (hh % 12 === 0 ? 12 : hh % 12) + m + ' ' + (hh < 12 ? 'AM' : 'PM');
  }
  function dayOf(h) { return Math.floor(h / 24); }
  function dayName(d) { return DOW[((dowIdx(ANCHOR) + d) % 7 + 7) % 7]; }
  function stamp(h) { return dayName(dayOf(h)) + ' ' + clock(h); }
  function hhmm(h) {
    var t = ((h % 24) + 24) % 24, hr = Math.floor(t), mn = Math.round((t - hr) * 60);
    return (hr < 10 ? '0' : '') + hr + ':' + (mn < 10 ? '0' : '') + mn;
  }
  function fromHM(s) {
    var p = String(s || '').split(':'), h = parseFloat(p[0]), m = parseFloat(p[1] || 0);
    return isNaN(h) ? 0 : Math.max(0, Math.min(23.99, h + (isNaN(m) ? 0 : m / 60)));
  }
  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? (d || 0) : n; }
  function dur(h) {
    var v = Math.round(h * 4) / 4;
    if (v <= 0) return '0 h';
    if (v < 1) return Math.round(v * 60) + ' m';
    return (Math.abs(v - Math.round(v)) < .01 ? Math.round(v) : v.toFixed(2).replace(/0$/, '')) + ' h';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function all(q) { return [].slice.call(document.querySelectorAll(q)); }
  function uid(p) { return p + Math.random().toString(36).slice(2, 7); }
  function cssId(id) { return String(id).replace(/[^A-Za-z0-9_-]/g, '\\$&'); }

  // ── Reading a flow ────────────────────────────────────────────────────────
  // There is nothing to solve: the times are already there. This only sorts,
  // works out the places, and finds the links worth drawing.
  function read(flow) {
    var byId = {};
    flow.tasks.forEach(function (t) { byId[t.id] = t; });
    var pts = flow.tasks.map(function (t) {
      return { id: t.id, t: t, s: num(t.s), e: num(t.e), place: t.place || 'Somewhere' };
    });
    var start = 0, end = 0;
    pts.forEach(function (p) {
      start = Math.min(start === 0 && !pts.length ? p.s : start, p.s);
      end = Math.max(end, p.e, p.s);
    });
    if (pts.length) start = Math.min.apply(null, pts.map(function (p) { return p.s; }));
    var idle = pts.reduce(function (a, p) { return a + Math.max(0, p.e - p.s); }, 0);
    var moving = 0, still = 0;
    pts.forEach(function (p) {
      // The leg carries its own origin, so a bar has a real slope rather than
      // one inferred from whatever happened to come before it.
      p.from = p.t.from || p.place;
      if (p.from === p.place) still += Math.max(0, p.e - p.s); else moving += Math.max(0, p.e - p.s);
    });
    var edges = [];
    flow.tasks.forEach(function (t) {
      (t.after || []).forEach(function (id) {
        if (!byId[id]) return;
        edges.push({ from: id, to: t.id, h0: num(byId[id].e), h1: num(t.s),
                     p0: byId[id].place || 'Somewhere' });
      });
    });
    var broken = flow.tasks.filter(function (t) { return num(t.e) < num(t.s); });
    return { byId: byId, pts: pts, edges: edges, broken: broken,
             start: start, end: end, idle: Math.round(idle),
             still: Math.round(still), moving: Math.round(moving),
             days: dayOf(end) - dayOf(start), hrs: Math.round(end - start) };
  }
  // Every location a leg touches, in the order the journey reaches them, so the
  // vertical axis reads top to bottom the way the product travels.
  function places(flow) {
    var seen = {}, out = [];
    flow.tasks.forEach(function (t) {
      var b = t.branch || '1';
      [t.from, t.place].forEach(function (p) {
        p = p || 'Somewhere';
        if (!has(seen, p)) { seen[p] = { b: b, i: out.length }; out.push(p); }
        else if (b < seen[p].b) seen[p].b = b;
      });
    });
    // Branch 1 is the pallet and branch 2 is the clock running beside it, so
    // the places only the clock touches go underneath -- the product's own
    // path then reads as one block rather than being interrupted by the lab.
    return out.sort(function (a, b) {
      if (seen[a].b !== seen[b].b) return seen[a].b < seen[b].b ? -1 : 1;
      return seen[a].i - seen[b].i;
    });
  }
  function feedsOf(flow, id) {
    return flow.tasks.filter(function (t) { return (t.after || []).indexOf(id) >= 0; });
  }
  function winOf(flow, place) { return (flow.windows || {})[place] || null; }
  function winSpan(w) {
    var a = clock(num(w.open)), b = clock(num(w.close));
    return a.slice(-2) === b.slice(-2) ? a.slice(0, -3) + '–' + b : a + '–' + b;
  }

  // ── Drawing ───────────────────────────────────────────────────────────────
  var LANE_H = 38, PAD_T = 14, PAD_B = 18, PLOT_PX = 1040;
  var X = function (h) { return (h / (SPAN * 24)) * 1000; };
  var PCT = function (h) { return (h / (SPAN * 24)) * 100; };

  function chart(flow, r) {
    // One colour per journey, so a thread can be followed across a busy week.
    var hue = {}, hues = 0;
    flow.tasks.forEach(function (t) {
      var d = t.def || flow.name;
      if (!has(hue, d)) hue[d] = hues++;
    });
    function jc(t) { return ' j' + (hue[t.def || flow.name] % 10); }

    var lanes = places(flow), yOf = {};
    lanes.forEach(function (l, i) { yOf[l] = PAD_T + i * LANE_H + LANE_H / 2; });
    var H = PAD_T + lanes.length * LANE_H + PAD_B;

    var svg = '';
    // Every two hours, faint. With no times written in the grid this is how a
    // bar is read, so it is the finest ruling that stays quiet. The day
    // boundaries keep their own heavier line.
    for (var q = 2; q < SPAN * 24; q += 2) {
      if (q % 24 === 0) continue;
      svg += '<line class="hr" x1="' + X(q) + '" x2="' + X(q) + '" y1="0" y2="' + H + '"/>';
    }
    for (var c = 1; c < SPAN; c++) {
      svg += '<line class="col" x1="' + X(c * 24) + '" x2="' + X(c * 24) + '" y1="0" y2="' + H + '"/>';
    }
    lanes.forEach(function (l, i) {
      var y = PAD_T + i * LANE_H;
      svg += '<line class="lane" x1="0" x2="1000" y1="' + (y + LANE_H / 2) + '" y2="' + (y + LANE_H / 2) + '"/>';
    });

    // Links first, so a bar always sits on top of the thread that reached it.
    // A link that runs backwards means a task starts before what it comes after
    // has finished, which is allowed and is worth seeing.
    var link = '';
    r.edges.forEach(function (e) {
      if (Math.abs(e.h1 - e.h0) <= .01) return;
      link += '<line class="link' + (e.h1 < e.h0 ? ' back' : '') + '" x1="' + X(e.h0) +
        '" y1="' + yOf[e.p0] + '" x2="' + X(e.h1) + '" y2="' + yOf[e.p0] + '"/>';
    });

    var move = '', wait = '', grabs = '';
    r.pts.forEach(function (p) {
      var y1 = yOf[p.from] === undefined ? yOf[p.place] : yOf[p.from];
      var seg = 'x1="' + X(p.s) + '" y1="' + y1 + '" x2="' + X(p.e) + '" y2="' + yOf[p.place] + '"';
      var still = p.from === p.place;
      // Branches are separate threads until they meet, so they do not share a
      // colour.
      var b = jc(p.t);
      if (p.e - p.s > .01 || !still) {
        if (still) wait += '<line class="wait' + b + '" ' + seg + '/>';
        else move += '<line class="move' + b + '" ' + seg + '/>';
      }
      svg += '<circle class="pt' + b + '" cx="' + X(p.s) + '" cy="' + y1 + '" r="3"/>' +
        '<circle class="pt' + b + '" cx="' + X(p.e) + '" cy="' + yOf[p.place] + '" r="3"/>';
      grabs += '<line class="grab" ' + seg + ' data-task="' + esc(p.id) + '"><title>' +
        esc(p.t.name) + ' — ' + stamp(p.s) + ' to ' + stamp(p.e) + ', ' + dur(p.e - p.s) +
        '. Drag to move the whole task.</title></line>';
    });
    svg += link + wait + move + grabs;

    // A leg carries three labels: the hour at each end, against its own dot, and
    // the name on the bar between them. Hanging the name off one end made a
    // flat bar read as though the name belonged to the far end of it.
    var dots = '', taken = [], said = {};
    r.pts.forEach(function (p) {
      var y1 = yOf[p.from] === undefined ? yOf[p.place] : yOf[p.from];
      var y2 = yOf[p.place];
      var db = jc(p.t);
      var nm = p.t.name || 'Task';
      // One leg's stop is usually the next one's start, in the same place at
      // the same minute, and printing the hour twice on top of itself is how
      // that reads. Each moment gets one label.

      // ── Where a leg's name goes ──────────────────────────────────────
      // The shape of the leg decides it, not the crowding:
      //
      //   sloped -- it changes place  the name sits to the RIGHT of the
      //                               start dot, on the start dot's own row
      //   flat   -- it stays put      the name sits just ABOVE the start dot
      //
      // Either way it hangs off the start, so a name always reads as the
      // beginning of its activity rather than the end. If that spot is taken
      // the name steps up; it never slides along the bar, so it cannot drift
      // away from the leg it belongs to.
      // A name wraps at every word, so it is as wide as its longest word and
      // as tall as it has words. Time is the scarce axis here and place is
      // not, which is the whole reason to spend height to buy width.
      // Several journeys share the same first legs -- one packing run feeds
      // both the air and the barge picture -- so the same name at the same
      // place and hour is one event, said once.
      var once = nm + '|' + p.from + '|' + p.place + '|' + p.s + '|' + p.e;
      if (said[once]) return;
      said[once] = 1;

      var ROW = 12;
      // Where the browser is allowed to break: at a space, and after a slash
      // or a hyphen -- which stay on the line they end. Guessing this wrong
      // makes a name shorter and taller than the model thinks, and then two
      // names a step apart still touch.
      var words = nm.replace(/([\/-])/g, '$1\u0000').split(/[\s\u0000]+/)
        .filter(function (w) { return w; });
      var wLen = 0;
      words.forEach(function (w) { if (w.length > wLen) wLen = w.length; });
      var wpc = (12 + wLen * 5.6) / PLOT_PX * 100;
      // Plus the padding the box actually carries, so a step really does clear
      // the name it stepped over.
      var hh = Math.max(1, words.length) * ROW + 2;
      var lo = PCT(p.s) + .6, hi = lo + wpc;
      // Sloped, the name sits centred on the start dot's row. Flat, it sits
      // clear above the dot -- which for a stack means its bottom edge does,
      // not its middle. A name that has to move moves by its whole height,
      // because moving by less would only overlap itself.
      var base = y1 === y2 ? -(hh / 2 + 2) : 0;
      // Keep stepping until there is room. Two journeys can put a dozen legs
      // on one lane in one hour, and a name that gives up lands on top of
      // another. Up is tried before down, since that is where a name reads.
      var STEPS = [0, -1, -2, -3, -4, -5, 1, 2, 3, 4];
      var ly = null;
      for (var k = 0; k < STEPS.length; k++) {
        var cand = y1 + base + STEPS[k] * hh, free = true;
        for (var q2 = 0; q2 < taken.length; q2++) {
          var o = taken[q2];
          if (cand - hh / 2 < o.b && o.t < cand + hh / 2 &&
              lo < o.hi + .4 && o.lo < hi + .4) { free = false; break; }
        }
        if (free) { ly = cand; break; }
      }
      if (ly === null) ly = y1 + base;
      taken.push({ t: ly - hh / 2, b: ly + hh / 2, lo: lo, hi: hi });
      dots += '<div class="ln' + db + '" style="left:' + PCT(p.s) + '%;top:' + ly + 'px"' +
        ' data-task="' + esc(p.id) + '" title="' + esc(nm) + ' — ' + stamp(p.s) + ' to ' +
        stamp(p.e) + ', ' + dur(p.e - p.s) + (p.t.note ? '. ' + esc(p.t.note) : '') + '">' +
        '<span class="nw">' + esc(nm) + '</span></div>';
    });

    var lbl = lanes.map(function (l) {
      return '<div class="lane-lbl" style="height:' + LANE_H + 'px">' + esc(l) + '</div>';
    }).join('');

    // How long it takes is a fact about one journey. Several of them have no
    // single duration between them, so there is nothing to put here.
    var res = flow.many ? '' :
      '<div class="res"><b>' + r.days + '</b><small>' + (r.days === 1 ? 'day' : 'days') +
      '</small><em>' + r.hrs + ' h end to end, ' + r.still + ' standing still</em></div>';
    return '<div class="hd"><b>' + esc(flow.name) + '</b>' + res + '</div>' +
      '<div class="chart"><div class="gut" style="padding-top:' + PAD_T + 'px">' + lbl + '</div>' +
      '<div class="plot" style="height:' + H + 'px">' +
      '<svg class="svg" viewBox="0 0 1000 ' + H + '" preserveAspectRatio="none">' + svg + '</svg>' +
      dots + '</div></div>';
  }


  // ── Gating on the hours ───────────────────────────────────────────────────
  // The times come from the Markdown, so a window cannot push them about. What
  // it can do is say when a written time falls outside the door it belongs to.
  function nextOpen(w, h) {
    for (var i = 0; i < 28; i++) {
      var d = Math.floor(h / 24) + i, dw = (dowIdx(ANCHOR) + d) % 7;
      if (!w.days[dw]) continue;
      var o = d * 24 + num(w.open), c = d * 24 + num(w.close);
      if (h <= o) return o;
      if (h < c) return h;
    }
    return h;
  }
  function outside(flow, place, h) {
    var w = winOf(flow, place);
    return w ? nextOpen(w, h) !== h : false;
  }
  function offences(flow) {
    var out = [];
    flow.tasks.forEach(function (t) {
      var pl = t.place || 'Somewhere';
      if (!winOf(flow, pl)) return;
      if (outside(flow, pl, num(t.s))) out.push({ t: t, f: 'starts', h: num(t.s), pl: pl });
      if (outside(flow, pl, num(t.e))) out.push({ t: t, f: 'stops', h: num(t.e), pl: pl });
    });
    return out;
  }

  // ── The task list, which is a reading of the Markdown ─────────────────────
  var COLS = ['', '', 'Task', 'Place', 'Starts', 'Stops', 'Takes', 'After', 'Note'];
  function taskTable(flow, r) {
    var head = '';
    var body = flow.tasks.map(function (t, i) {
      // With several journeys in one list, a row has to say which it is from.
      // A line between them says it once instead of once per row.
      var mark = '';
      if (t.journey && t.journey !== head) {
        head = t.journey;
        mark = '<div class="grp">' + esc(head) + '</div>';
      }
      var p = null;
      r.pts.forEach(function (x) { if (x.id === t.id) p = x; });
      var len = num(t.e) - num(t.s);
      var still = p && p.from === (t.place || 'Somewhere');
      var pre = (t.after || []).filter(function (id) { return r.byId[id]; });
      var badS = outside(flow, t.place || 'Somewhere', num(t.s));
      var badE = outside(flow, t.place || 'Somewhere', num(t.e));
      return mark + '<div class="row' + (len < 0 ? ' bad' : '') + '" id="task-' + esc(t.id) + '">' +
        '<div class="cell n">' + (i + 1) + '</div>' +
        '<div class="cell ico">' + ico(t.icon) + '</div>' +
        '<div class="cell nm">' + esc(t.name) + '</div>' +
        '<div class="cell plc">' + esc(t.place) + '</div>' +
        '<div class="cell tm' + (badS ? ' out' : '') + '"' +
        (badS ? ' title="' + esc(t.place) + ' is shut then."' : '') + '>' + stamp(num(t.s)) + '</div>' +
        '<div class="cell tm' + (badE ? ' out' : '') + '"' +
        (badE ? ' title="' + esc(t.place) + ' is shut then."' : '') + '>' + stamp(num(t.e)) + '</div>' +
        '<div class="cell dur' + (len < 0 ? ' bad' : still && len > .01 ? ' still' : '') + '">' +
        (len < 0 ? 'backwards' : dur(len)) + '</div>' +
        '<div class="cell aft">' + (pre.length
          ? pre.map(function (id) { return esc(r.byId[id].name); }).join(', ') : '—') + '</div>' +
        '<div class="cell nt">' + esc(t.note || '') + '</div>' +
        '</div>';
    }).join('');
    return '<div class="grid">' +
      COLS.map(function (c, i) { return '<div class="gh' + (i === 6 ? ' r' : '') + '">' + c + '</div>'; }).join('') +
      body + '</div>';
  }

  // ── What has to be packed, and how long it takes ──────────────────────────
  // Three case types at three different rates against two destinations, which
  // is the shape the pack line is actually planned in. Cases only: the pack
  // line counts cases, and pounds were a second number nobody was using here.
  var GROUPS = (window.DATA && DATA.pack_groups) || [['LW', 'LW'], ['LF', 'LF'], ['TRAY', 'LR/AR/WR']];
  var DESTS = [['on', 'On-island'], ['off', 'Off-island']];
  // Minutes per case, not cases per minute: a tray takes six minutes, it does
  // not come off the line six at a time.
  var RATE_DEF = { LW: 2, LF: 1, TRAY: 1 };

  function startHour() {
    var v = parseInt(S.startHour, 10);
    return isNaN(v) || v < 0 || v > 23 ? 10 : v;
  }
  function hourLabel(h) {
    var x = ((Math.floor(h) % 24) + 24) % 24;
    return x === 0 ? '12a' : x < 12 ? x + 'a' : x === 12 ? '12p' : (x - 12) + 'p';
  }
  function rates() {
    var r = {};
    GROUPS.forEach(function (g) {
      var v = S.rates && S.rates[g[0]];
      r[g[0]] = (v === undefined || v === null || v === '' || +v <= 0) ? RATE_DEF[g[0]] : +v;
    });
    return r;
  }
  function mins(cases, rate) { return cases * rate; }
  function showMins(m) {
    if (!m) return '—';
    if (m < 60) return Math.round(m) + ' min';
    var h = Math.floor(m / 60), mm = Math.round(m - h * 60);
    return h + ' h' + (mm ? ' ' + mm : '');
  }

  function ordersView() {
    var P = (window.DATA && DATA.packs) || [];
    if (!P.length) return '<p class="hint">No pack data in data.json.</p>';
    var R = rates();
    var tot = {}, n = 0;
    DESTS.forEach(function (d) { GROUPS.forEach(function (g) { tot[d[0] + g[0]] = 0; }); });
    P.forEach(function (row) {
      n++;
      DESTS.forEach(function (d) {
        GROUPS.forEach(function (g) { tot[d[0] + g[0]] += (row[d[0]] || {})[g[0]] || 0; });
      });
    });

    // ── The two pack days ────────────────────────────────────────────────
    // Day 1 is a 6.5 hour shift filled in a fixed order: all of Kona's LW,
    // then as much off-island LW as still fits, then all the LF and all the
    // trays for both days. Day 2 is the off-island LW that did not fit.
    var DAY1 = 6.5;
    var LB = { LW: 10.5, LF: 10, TRAY: 2.25 };
    var konaLW = n ? tot.onLW / n : 0;
    var offLW = n ? tot.offLW / n : 0;
    var lf = n ? (tot.onLF + tot.offLF) / n : 0;
    var tray = n ? (tot.onTRAY + tot.offTRAY) / n : 0;
    var hKona = mins(konaLW, R.LW) / 60, hLF = mins(lf, R.LF) / 60, hR = mins(tray, R.TRAY) / 60;
    var room = DAY1 - (hKona + hLF + hR);
    var offLW1 = R.LW > 0 ? Math.max(0, Math.min(offLW, room * 60 / R.LW)) : 0;
    var offLW2 = offLW - offLW1;
    var segs1 = [
      ['Kona LW', konaLW, hKona, konaLW * LB.LW, 'k'],
      ['Off-island LW', offLW1, mins(offLW1, R.LW) / 60, offLW1 * LB.LW, 'o'],
      ['LF', lf, hLF, lf * LB.LF, 'f'],
      ['LR/AR/WR', tray, hR, tray * LB.TRAY, 'r']
    ].filter(function (x) { return x[1] > 0.5; });
    var segs2 = [['Off-island LW', offLW2, mins(offLW2, R.LW) / 60, offLW2 * LB.LW, 'o']]
      .filter(function (x) { return x[1] > 0.5; });
    var wide = Math.max(hKona + hLF + hR + mins(offLW1, R.LW) / 60,
                        mins(offLW2, R.LW) / 60, DAY1) || 1;
    function dayRow(label, segs, over) {
      var h = segs.reduce(function (a, x) { return a + x[2]; }, 0);
      var lb = segs.reduce(function (a, x) { return a + x[3]; }, 0);
      return '<div class="pd"><span class="pd-l">' + label + '</span>' +
        '<span class="pd-bar">' +
        segs.map(function (x) {
          return '<span class="pd-s ' + x[4] + '" style="width:' + (x[2] / wide * 100).toFixed(2) +
            '%" title="' + esc(x[0]) + ' — ' + Math.round(x[1]).toLocaleString() + ' cs, ' +
            showMins(x[2] * 60) + ', ' + Math.round(x[3]).toLocaleString() + ' lb">' +
            (x[2] / wide > .07 ? esc(x[0]) : '') + '</span>';
        }).join('') +
        '</span>' +
        '<span class="pd-h' + (over ? ' over' : '') + '">' + showMins(h * 60) + '</span>' +
        '<span class="pd-lb">' + Math.round(lb).toLocaleString() + ' lb</span></div>';
    }
    var st = startHour(), scale = '';
    for (var hh = 0; hh <= Math.floor(wide); hh++) {
      scale += '<span class="pd-t" style="left:' + (hh / wide * 100).toFixed(3) + '%">' +
        hourLabel(st + hh) + '</span>';
    }
    var packBar = '<div class="packdays">' +
      '<div class="pd pd-axis"><span class="pd-l"></span>' +
      '<span class="pd-bar pd-scale">' + scale + '</span>' +
      '<span class="pd-h"></span><span class="pd-lb"></span></div>' +
      dayRow('Pack day 1', segs1, hKona + hLF + hR > DAY1 + .01) +
      dayRow('Pack day 2', segs2, false) + '</div>';

    var rateRow = '<div class="rates"><span class="lbl">Minutes per case</span>' +
      GROUPS.map(function (g) {
        return '<label class="rate">' + esc(g[1]) +
          '<input type="text" inputmode="numeric" value="' + R[g[0]] +
          '" data-rate="' + g[0] + '"></label>';
      }).join('') +
      '<label class="rate"><span class="lbl">Starts</span>' +
      '<input type="text" inputmode="numeric" value="' + st + '" data-start="1"></label></div>';

    var body = P.map(function (row, i) {
      var first = i % 2 === 0;
      return '<tr class="' + (first ? 'wkstart' : '') + '">' +
        (first ? '<th rowspan="2" class="wk">' + shortDate(row.wk) + '</th>' : '') +
        '<th class="hf">' + (row.half === 'early' ? 'Sun / Mon' : 'Wed / Thu') + '</th>' +
        DESTS.map(function (d) {
          return GROUPS.map(function (g) {
            var v = (row[d[0]] || {})[g[0]] || 0;
            return '<td class="fig">' + (v ? v.toLocaleString() : '&mdash;') + '</td>';
          }).join('');
        }).join('') + '</tr>';
    }).join('');

    var minRow = '<tr class="minrow"><th></th><th class="hf">Minutes</th>' +
      DESTS.map(function (d) {
        return GROUPS.map(function (g) {
          return '<td class="fig">' + showMins(mins(n ? tot[d[0] + g[0]] / n : 0, R[g[0]])) + '</td>';
        }).join('');
      }).join('') + '</tr>';

    var avg = '<tr class="grp"><th colspan="8">Per window</th></tr>' +
      '<tr><th></th><th class="hf">Average</th>' +
      DESTS.map(function (d) {
        return GROUPS.map(function (g) {
          return '<td class="fig">' + Math.round(n ? tot[d[0] + g[0]] / n : 0).toLocaleString() + '</td>';
        }).join('');
      }).join('') + '</tr>';

    return packBar + rateRow +
      '<table class="otbl orders"><thead>' +
      '<tr><th></th><th></th>' +
      DESTS.map(function (d) { return '<th colspan="3" class="grp2">' + d[1] + '</th>'; }).join('') +
      '</tr><tr class="units"><th></th><th></th>' +
      DESTS.map(function () {
        return GROUPS.map(function (g) { return '<th>' + esc(g[1]) + '</th>'; }).join('');
      }).join('') + '</tr></thead><tbody>' + minRow + body + avg + '</tbody></table>';
  }

  function shortDate(iso) {
    var M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var d = new Date(iso + 'T00:00:00');
    return d.getDate() + ' ' + M[d.getMonth()];
  }

  // ── Hours: everybody's clock, not just this journey's ─────────────────────
  // A window belongs to a party, not to a task, and the ones that matter are
  // the ones this product waits at whether or not the journey on screen goes
  // through them.
  function hoursView() {
    var R = window.REF || { hours: [], sailings: [] };
    var out = '';
    if (R.hours.length) {
      out += '<h4>Who will take it, and when</h4>' +
        '<table class="otbl hrs"><thead><tr><th>Place</th><th>Days</th><th>Opens</th>' +
        '<th>Closes</th><th>After arrival</th><th>Note</th></tr></thead><tbody>' +
        R.hours.map(function (w) {
          return '<tr><th class="hf">' + esc(w.place) + '</th>' +
            '<td class="dcell">' + dayCells(w.days) + '</td>' +
            '<td class="mono">' + clock(num(w.open)) + '</td>' +
            '<td class="mono">' + clock(num(w.close)) + '</td>' +
            '<td class="mono">' + (w.lead ? w.lead + ' h' : '<u>—</u>') + '</td>' +
            '<td class="nt">' + esc(w.note || '') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    if (R.sailings.length) {
      out += '<h4>Young Brothers sailings</h4>' +
        '<table class="otbl hrs"><thead><tr><th>Route</th><th>Departs</th><th>Arrives</th>' +
        '<th>Connects</th><th>Note</th></tr></thead><tbody>' +
        R.sailings.map(function (x) {
          var open = /\?/.test(x.departs) || /\?/.test(x.arrives);
          return '<tr' + (open ? ' class="unk"' : '') + '><th class="hf">' + esc(x.route) + '</th>' +
            '<td class="mono">' + esc(x.departs) + '</td>' +
            '<td class="mono">' + esc(x.arrives) + '</td>' +
            '<td class="nt">' + esc(x.connects || '') + '</td>' +
            '<td class="nt">' + mark(x.note || '') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    // What this journey actually uses, which is a subset and worth seeing
    // apart -- and only means anything while one journey is on screen.
    var flow = cur();
    var pl = flow ? places(flow).filter(function (p) { return winOf(flow, p); }) : [];
    if (pl.length) {
      out += '<h4>Used by ' + esc(flow.name) + '</h4>' +
        '<table class="otbl hrs"><thead><tr><th>Place</th><th>Days</th><th>Opens</th>' +
        '<th>Closes</th><th></th></tr></thead><tbody>' +
        pl.map(function (p) {
          var w = winOf(flow, p);
          return '<tr><th class="hf">' + esc(p) + '</th>' +
            '<td class="dcell">' + dayCells(w.days) + '</td>' +
            '<td class="mono">' + clock(num(w.open)) + '</td>' +
            '<td class="mono">' + clock(num(w.close)) + '</td><td></td></tr>';
        }).join('') + '</tbody></table>';
    }
    return out + '<p class="hint">All of this is set in <code>hours.csv</code> and ' +
      '<code>sailings.csv</code>. Days here are real weekdays, the same as in ' +
      '<code>legs.csv</code>.' + '<span hidden>' +
      'tables at the top of the file, and each journey&rsquo;s own <b>Hours</b> table. Days here are ' +
      '</span></p>';
  }
  function dayCells(days) {
    return DOW.map(function (dn, d) {
      return '<span class="d' + (days[d] ? ' on' : '') + '" title="' + dn + '">' + dn[0] + '</span>';
    }).join('');
  }
  function mark(t) {
    return esc(t).replace(/NOT CONFIRMED/g, '<b class="unconfirmed">Not confirmed</b>');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  var TABS = [['flow', 'Flow'], ['orders', 'Orders'], ['hours', 'Hours']];
  function paint() {
    seg('tabs', TABS, S.tab, function (v) { S.tab = v; save(); paint(); });
    TABS.forEach(function (t) {
      document.getElementById('page-' + t[0]).hidden = t[0] !== S.tab;
    });
    if (S.tab === 'flow') paintFlow();
    if (S.tab === 'orders') paintOrders();
    if (S.tab === 'hours') document.getElementById('hours').innerHTML = hoursView();
  }

  function paintFlow() {
    if (!F.length) {
      document.getElementById('grid').innerHTML = '<p class="hint">No journeys.</p>';
      document.getElementById('src').innerHTML = srcLine();
      return;
    }
    var list = shown();
    picker();
    document.getElementById('key').innerHTML =
      '<i class="sw mv"></i>moving<i class="sw wt"></i>standing still';
    document.getElementById('src').innerHTML = srcLine();
    if (!list.length) {
      document.getElementById('grid').innerHTML =
        '<p class="hint">Nothing is both of those.</p>';
      document.getElementById('axis').innerHTML = '';
      document.getElementById('tasks').innerHTML = '';
      return;
    }
    var flow = merge(list);
    // One journey is drawn from its own cut; several share the week, because
    // that is the only axis they have in common.
    ANCHOR = flow.many ? 'Sun' : (flow.start || 'Sun');

    var r = read(flow);
    SPAN = flow.many ? 7 : Math.max(2, Math.ceil(r.end / 24) + 1);

    // Mark the days we actually cut on, which is what each shown journey
    // starts on. It used to mark day 0, and day 0 stopped being the cut the
    // moment several journeys began sharing a Sunday axis.
    var cuts = {};
    list.forEach(function (f) { cuts[f.start] = 1; });
    var ax = '';
    for (var i = 0; i < SPAN; i++) {
      var dn = dayName(i);
      ax += '<div class="day' + (cuts[dn] ? ' cut' : '') + '">' + dn + '</div>';
    }
    // The four-hour marks are only useful if you can say what hour they are.
    var hx = '';
    for (var q = 0; q < SPAN * 24; q += 4) {
      var hh = q % 24;
      hx += '<span class="hlab' + (hh === 0 ? ' mid' : '') + '" style="left:' + PCT(q) + '%">' +
        (hh === 0 ? '12a' : hh < 12 ? hh + 'a' : hh === 12 ? '12p' : (hh - 12) + 'p') + '</span>';
    }
    document.getElementById('axis').innerHTML =
      '<div class="axrow"><div class="gut"></div><div class="days">' + ax + '</div></div>' +
      '<div class="axrow"><div class="gut"></div><div class="hours-axis">' + hx + '</div></div>';
    document.getElementById('grid').innerHTML = chart(flow, r);

    var off = offences(flow), warn = '';
    if (r.broken.length) {
      warn += '<div class="warn">' + r.broken.map(function (t) { return esc(t.name); }).join(', ') +
        ' stop' + (r.broken.length > 1 ? '' : 's') + ' before ' +
        (r.broken.length > 1 ? 'they' : 'it') + ' start' + (r.broken.length > 1 ? '' : 's') + '.</div>';
    }
    if (off.length) {
      warn += '<div class="warn">' + off.length + ' time' + (off.length > 1 ? 's fall' : ' falls') +
        ' outside the opening hours of the place ' + (off.length > 1 ? 'they belong' : 'it belongs') +
        ' to: ' + off.map(function (o) {
          return esc(o.t.name) + ' ' + o.f + ' ' + stamp(o.h) + ', but ' + esc(o.pl) + ' is open ' +
                 winSpan(winOf(flow, o.pl));
        }).join('; ') + '.</div>';
    }
    document.getElementById('warn').innerHTML = warn;
    document.getElementById('tnote').textContent =
      flow.tasks.length + ' legs · ' + (flow.branches || []).length + ' branches · ' +
      places(flow).length + ' places · ' + r.hrs + ' h end to end, ' + r.still + ' standing still';
    document.getElementById('tasks').innerHTML = taskTable(flow, r);

    // A bar or a dot finds its row, which is the only interaction left.
    all('#grid [data-task]').forEach(function (el) {
      el.addEventListener('click', function () {
        var c = document.getElementById('task-' + el.getAttribute('data-task'));
        if (!c) return;
        c.classList.add('lit');
        c.scrollIntoView({ block: 'center' });
        window.setTimeout(function () { c.classList.remove('lit'); }, 2600);
      });
    });
  }

  function paintOrders() {
    var host = document.getElementById('orders');
    host.innerHTML = ordersView();
    // Delegated, and bound once. A rate change repaints the whole view, so a
    // handler holding its own input goes on reading the element it replaced.
    if (!host.__wired) {
      host.__wired = true;
      host.addEventListener('input', function (ev) {
        var inp = ev.target;
        if (!inp || !inp.getAttribute) return;
        var key = inp.getAttribute('data-rate'), pos = inp.selectionStart;
        if (inp.getAttribute('data-start')) {
          var h = parseInt(inp.value, 10);
          S.startHour = isNaN(h) || h < 0 || h > 23 ? '' : h;
        } else if (key) {
          var v = parseFloat(inp.value);
          S.rates = S.rates || {};
          S.rates[key] = isNaN(v) || v <= 0 ? '' : v;
        } else { return; }
        save();
        host.innerHTML = ordersView();
        var again = host.querySelector(key ? '[data-rate="' + key + '"]' : '[data-start]');
        if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) {} }
      });
    }
  }

  // ── Picking a journey ─────────────────────────────────────────────────────
  // Eight variants in one row was a list to read rather than a choice to make.
  // The same eight are three questions: which cut, where it is going, and what
  // carries it. A question with only one answer is not a question and is not
  // drawn, which is what keeps the freight toggle off the on-island journeys.
  // The sheet says what a journey is in its own columns, so nothing here has
  // to take a name apart to find out.
  function facets(f) {
    return { when: f.start, crop: f.crop || '', to: f.fob || '', by: f.transport || '' };
  }

  // We cut on the anchor day and the day after, and both feed the same
  // departure, so the pair is the honest label for the choice.
  function cutLabel(day) {
    var i = DOW.indexOf(day);
    return i < 0 ? day : day + '/' + DOW[(i + 1) % 7];
  }

  function uniq(list) {
    var seen = {}, out = [];
    list.forEach(function (v) {
      if (v !== '' && !Object.prototype.hasOwnProperty.call(seen, v)) { seen[v] = 1; out.push(v); }
    });
    return out;
  }

  // Answer as much of the wanted combination as exists, giving up the freight
  // before the destination and the cut before either.
  var KEYS = ['crop', 'to', 'by', 'when'];

  // Each question holds a set of answers rather than one. An empty set asks
  // nothing, so turning every answer off is how you say "the whole week".
  function shown() {
    var sel = S.sel || {};
    return F.filter(function (f) {
      var x = facets(f);
      for (var i = 0; i < KEYS.length; i++) {
        var list = sel[KEYS[i]] || [];
        if (list.length && list.indexOf(x[KEYS[i]]) < 0) return false;
      }
      return true;
    });
  }

  // Several journeys are drawn as one picture: the same lanes, and one week
  // rather than each journey's own first day. A leg keeps the weekday it was
  // written on, so this is a re-hanging, not a recalculation.
  function merge(list) {
    if (list.length === 1) return list[0];
    var tasks = [], branches = [], windows = {};
    list.forEach(function (f, i) {
      var pre = 'f' + i + ':';
      f.tasks.forEach(function (t) {
        var c = {}, k;
        for (k in t) if (has(t, k)) c[k] = t[k];
        c.id = pre + t.id;
        c.after = (t.after || []).map(function (a) { return pre + a; });
        c.journey = f.name + ' \u00b7 ' + cutLabel(f.start);
        c.s = t.sd * 24 + t.sh;
        c.e = t.ed * 24 + t.eh;
        // A leg that runs past midnight on Saturday lands before its own start
        // once the week wraps. It still takes as long as it took.
        while (c.e < c.s) c.e += 24;
        tasks.push(c);
      });
      (f.branches || []).forEach(function (b) { if (branches.indexOf(b) < 0) branches.push(b); });
      for (var p in f.windows) if (has(f.windows, p)) windows[p] = f.windows[p];
    });
    return { id: 'many', name: sharedName(list), start: 'Sun', many: list.length,
      branches: branches, tasks: tasks, windows: windows };
  }

  // Name the picture by what every journey in it has in common, which is the
  // only thing that is true of all of them.
  function sharedName(list) {
    var parts = [];
    KEYS.forEach(function (k) {
      var v = uniq(list.map(function (f) { return facets(f)[k]; }));
      if (v.length === 1 && v[0]) parts.push(k === 'when' ? cutLabel(v[0]) : v[0]);
    });
    return parts.length ? parts.join(' \u00b7 ') : 'The week';
  }

  function picker() {
    function ask(id, key, label) {
      var opts = uniq(F.map(function (f) { return facets(f)[key]; }));
      // One answer is not a question. That is what keeps the freight toggle
      // off a destination with only one way to reach it, and the crop toggle
      // away entirely while we only grow lettuce.
      seg(id, opts.length > 1 ? opts.map(function (v) {
        return [v, label ? label(v) : v];
      }) : [], S.sel[key] || [], function (v) {
        var list = (S.sel[key] || []).slice(), at = list.indexOf(v);
        if (at < 0) list.push(v); else list.splice(at, 1);
        S.sel[key] = list;
        save();
        paint();
      });
    }
    ask('pick-when', 'when', cutLabel);
    ask('pick-crop', 'crop');
    ask('pick-to', 'to');
    ask('pick-by', 'by');
  }

  function seg(id, opts, sel, cb) {
    var el = document.getElementById(id);
    if (!el) return;
    el.style.display = opts.length ? '' : 'none';
    var chosen = Object.prototype.toString.call(sel) === '[object Array]' ? sel : [sel];
    el.innerHTML = opts.map(function (o) {
      var on = chosen.some(function (c) { return String(o[0]) === String(c); });
      return '<a data-v="' + esc(o[0]) + '"' + (on ? ' class="on"' : '') +
        '>' + esc(o[1]) + '</a>';
    }).join('');
    [].slice.call(el.querySelectorAll('a')).forEach(function (a) {
      a.onclick = function () { cb(a.getAttribute('data-v')); };
    });
  }

  // Nothing to say when the sheet was read: that is the normal case and the
  // chart is the answer. The line exists for when it was not, because stale
  // legs drawn silently would be worse than no line at all.
  function srcLine() {
    if (SRC.live || !SRC.why) return '';
    return 'Sheet unreadable (' + esc(SRC.why) + ') — showing the snapshot in ' +
      '<code>legs.csv</code>.';
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  // Draw the snapshot at once so the page is never blank, then read the sheet
  // and redraw if it is there. A journey the reader has already picked stays
  // picked across the swap.
  function useText(text, live, why) {
    var built;
    try {
      built = buildFlows(legRows(text));
    } catch (err) {
      why = String((err && err.message) || err);
      // A typo in the sheet must not take the page down with it: fall back to
      // the snapshot and say why on the line above the chart.
      if (live) { useText(window.LEGS || '', false, why); return; }
      built = [];
      live = false;
    }
    F = built;
    SRC = { live: live, at: new Date(), why: why || '' };
    // A stored answer that the sheet no longer offers is dropped rather than
    // silently narrowing the picture to nothing.
    S.sel = S.sel || {};
    var have = {};
    KEYS.forEach(function (k) { have[k] = uniq(F.map(function (f) { return facets(f)[k]; })); });
    var any = false;
    KEYS.forEach(function (k) {
      S.sel[k] = (S.sel[k] || []).filter(function (v) { return have[k].indexOf(v) >= 0; });
      if (S.sel[k].length) any = true;
    });
    // Open on one journey rather than on everything at once.
    if (!any && F.length) {
      var first = facets(F[0]);
      KEYS.forEach(function (k) { S.sel[k] = first[k] ? [first[k]] : []; });
    }
    paint();
  }

  useText(window.LEGS || '', false, '');
  var SHEET = window.SHEET || '';
  if (SHEET && window.fetch) {
    window.fetch(SHEET, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (t) {
      useText(t, true, '');
    })['catch'](function (e) {
      SRC.why = String((e && e.message) || e);
      if (S.tab === 'flow') document.getElementById('src').innerHTML = srcLine();
    });
  }
})();
