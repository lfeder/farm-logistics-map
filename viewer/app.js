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
  // The flows are baked in from journeys.md at build time. Nothing here writes
  // them; to change a journey you edit the Markdown and run build.py.
  var F = window.FLOWS || [], DATA = window.DATA || {};
  var S = { id: F.length ? F[0].id : '', day: F.length ? F[0].days[0] : 'Sun', tab: 'flow' };
  try {
    var sv = JSON.parse(window.localStorage.getItem(STORE) || 'null');
    if (sv) {
      if (F.some(function (f) { return f.id === sv.id; })) S.id = sv.id;
      if (sv.day) S.day = sv.day;
      if (sv.tab) S.tab = sv.tab;
      if (sv.crop) S.crop = sv.crop;
    }
  } catch (e) { /* nothing stored, or junk in the slot */ }
  S.crop = S.crop || 'lettuce';
  function save() {
    try { window.localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {}
  }
  function cur() {
    for (var i = 0; i < F.length; i++) if (F[i].id === S.id) return F[i];
    S.id = F[0].id;
    return F[0];
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
    pts.forEach(function (p, i) {
      var prev = null;
      (p.t.after || []).forEach(function (id) {
        if (byId[id] && (prev === null || num(byId[id].e) > num(byId[prev].e))) prev = id;
      });
      p.from = prev && byId[prev] ? (byId[prev].place || 'Somewhere') : p.place;
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
  function places(flow) {
    var seen = {}, out = [];
    flow.tasks.forEach(function (t) {
      var p = t.place || 'Somewhere';
      if (!seen[p]) { seen[p] = 1; out.push(p); }
    });
    return out;
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
    var lanes = places(flow), yOf = {};
    lanes.forEach(function (l, i) { yOf[l] = PAD_T + i * LANE_H + LANE_H / 2; });
    var H = PAD_T + lanes.length * LANE_H + PAD_B;

    var svg = '', caps = '', busy = {};
    for (var c = 1; c < SPAN; c++) {
      svg += '<line class="col" x1="' + X(c * 24) + '" x2="' + X(c * 24) + '" y1="0" y2="' + H + '"/>';
    }
    r.pts.forEach(function (p) { (busy[p.place] || (busy[p.place] = [])).push(PCT(p.e)); });
    lanes.forEach(function (l, i) {
      var y = PAD_T + i * LANE_H;
      svg += '<line class="lane" x1="0" x2="1000" y1="' + (y + LANE_H / 2) + '" y2="' + (y + LANE_H / 2) + '"/>';
      var w = winOf(flow, l);
      if (!w) return;
      var open = [];
      for (var d = 0; d < SPAN; d++) {
        if (!w.days[(dowIdx(ANCHOR) + d) % 7]) continue;
        open.push(d);
        var x0 = X(d * 24 + num(w.open)), x1 = X(d * 24 + num(w.close));
        svg += '<rect class="band" x="' + x0 + '" width="' + Math.max(0, x1 - x0) +
          '" y="' + (y + 5) + '" height="' + (LANE_H - 10) + '"><title>' + esc(l) + ' open ' +
          winSpan(w) + '</title></rect>';
      }
      if (!open.length) return;
      var mine = busy[l] || [], pick = open[0];
      for (var oi = 0; oi < open.length; oi++) {
        var px = PCT(open[oi] * 24 + num(w.open)), clear = true;
        for (var bi = 0; bi < mine.length; bi++) if (Math.abs(mine[bi] - px) < 15) clear = false;
        if (clear) { pick = open[oi]; break; }
      }
      caps += '<div class="cap" style="left:' + PCT(pick * 24 + num(w.open)) + '%;top:' + (y + 3) + 'px">' +
        esc(l) + ' open</div>';
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
      if (p.e - p.s > .01 || !still) {
        if (still) wait += '<line class="wait" ' + seg + '/>';
        else move += '<line class="move" ' + seg + '/>';
      }
      svg += '<circle class="tick" cx="' + X(p.s) + '" cy="' + y1 + '" r="2.6"><title>' +
        esc(p.t.name) + ' starts ' + stamp(p.s) + '</title></circle>';
      grabs += '<line class="grab" ' + seg + ' data-task="' + esc(p.id) + '"><title>' +
        esc(p.t.name) + ' — ' + stamp(p.s) + ' to ' + stamp(p.e) + ', ' + dur(p.e - p.s) +
        '. Drag to move the whole task.</title></line>';
    });
    svg += link + wait + move + grabs;

    var dots = '', placed = {};
    r.pts.forEach(function (p) {
      var x = PCT(p.e), last = p.e === r.end;
      var nm = p.t.name || 'Task', tm = clock(p.e);
      var wpc = (30 + (nm.length + tm.length) * 5.3) / PLOT_PX * 100;
      var flip = x + wpc > 99;
      var lo = flip ? x - wpc : x, hi = flip ? x : x + wpc;
      var lane = placed[p.place] || (placed[p.place] = []), slot = 0;
      for (; slot < 3; slot++) {
        var free = true;
        for (var q = 0; q < lane.length; q++) {
          var o = lane[q];
          if (o.slot === slot && lo < o.hi + .5 && o.lo < hi + .5) { free = false; break; }
        }
        if (free) break;
      }
      lane.push({ lo: lo, hi: hi, slot: slot });
      var fed = feedsOf(flow, p.id);
      dots += '<div class="dot s' + slot + (last ? ' end' : '') + (flip ? ' flip' : '') +
        '" style="left:' + x + '%;top:' + yOf[p.place] + 'px" data-task="' + esc(p.id) + '"' +
        ' title="' + esc(nm) + ' — ' + stamp(p.s) + ' to ' + stamp(p.e) + ', ' + dur(p.e - p.s) +
        (p.t.note ? '. ' + esc(p.t.note) : '') +
        (fed.length ? '. Feeds ' + esc(fed.map(function (x2) { return x2.name; }).join(', ')) : '') +
        '">' + '<b></b><span>' + ico(p.t.icon) + esc(nm) + '<em>' + tm + '</em></span></div>';
    });

    var lbl = lanes.map(function (l) {
      var w = winOf(flow, l);
      return '<div class="lane-lbl" style="height:' + LANE_H + 'px">' + esc(l) +
        '<button class="win' + (w ? '' : ' off') + '" data-place="' + esc(l) + '">' +
        (w ? winSpan(w) : 'no hours') + '</button></div>';
    }).join('');

    return '<div class="hd"><b>' + esc(flow.name) + '</b><small>' + esc(flow.note || '') + '</small>' +
      '<div class="res"><b>' + r.days + '</b><small>' + (r.days === 1 ? 'day' : 'days') + '</small>' +
      '<em>' + r.hrs + ' h end to end, ' + r.still + ' standing still</em></div></div>' +
      '<div class="chart"><div class="gut" style="padding-top:' + PAD_T + 'px">' + lbl + '</div>' +
      '<div class="plot" style="height:' + H + 'px">' +
      '<svg class="svg" viewBox="0 0 1000 ' + H + '" preserveAspectRatio="none">' + svg + '</svg>' +
      caps + dots + '</div></div>';
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
    var body = flow.tasks.map(function (t, i) {
      var p = null;
      r.pts.forEach(function (x) { if (x.id === t.id) p = x; });
      var len = num(t.e) - num(t.s);
      var still = p && p.from === (t.place || 'Somewhere');
      var pre = (t.after || []).filter(function (id) { return r.byId[id]; });
      var badS = outside(flow, t.place || 'Somewhere', num(t.s));
      var badE = outside(flow, t.place || 'Somewhere', num(t.e));
      return '<div class="row' + (len < 0 ? ' bad' : '') + '" id="task-' + esc(t.id) + '">' +
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

  // ── Orders by destination ─────────────────────────────────────────────────
  // Three ways an order leaves the farm, off the purchase orders, so it owes
  // nothing to whether anybody built a pallet for it.
  var BUCKETS = [['kona', 'Costco Kona'], ['pickup', 'Pick up'], ['off', 'Off-island']];
  function ordersView() {
    var c = S.crop, rows = {}, weeks = {};
    (DATA.sales || []).forEach(function (x) {
      if (x.crop !== c) return;
      var k = x.wk + '|' + x.half;
      var R = rows[k] || (rows[k] = {});
      R[x.bucket] = (R[x.bucket] || 0) + (x.cases || 0);
      R[x.bucket + '_lb'] = (R[x.bucket + '_lb'] || 0) + (x.lbs || 0);
      weeks[x.wk] = 1;
    });
    var wks = Object.keys(weeks).sort();
    var HALF = [['early', 'Sun / Mon'], ['late', 'Wed / Thu']];
    var best = 0;
    wks.forEach(function (w) {
      HALF.forEach(function (h) {
        var b = rows[w + '|' + h[0]];
        if (b) best = Math.max(best, (b.kona_lb || 0) + (b.pickup_lb || 0) + (b.off_lb || 0));
      });
    });
    // Orders arrive in cases and the harvest is weighed, so both units belong on
    // every line rather than somebody converting in their head.
    function qty(b, k) {
      if (!b || !b[k]) return '<u>—</u>';
      return '<b>' + Math.round(b[k]).toLocaleString() + '</b><s>cs</s>' +
        '<s class="lb">' + Math.round(b[k + '_lb'] || 0).toLocaleString() + ' lb</s>';
    }
    var tot = { kona: 0, pickup: 0, off: 0, kona_lb: 0, pickup_lb: 0, off_lb: 0, n: 0 };
    var body = wks.map(function (w) {
      return HALF.map(function (h, hi) {
        var b = rows[w + '|' + h[0]] || null;
        if (b) {
          BUCKETS.forEach(function (k) {
            tot[k[0]] += b[k[0]] || 0; tot[k[0] + '_lb'] += b[k[0] + '_lb'] || 0;
          });
          tot.n++;
        }
        var sum = b ? (b.kona_lb || 0) + (b.pickup_lb || 0) + (b.off_lb || 0) : 0;
        var bar = sum && best ? '<span class="obar" style="width:' + (sum / best * 100).toFixed(1) + '%"></span>' : '';
        return '<tr class="' + (hi ? '' : 'wkstart') + '">' +
          (hi ? '' : '<th rowspan="2" class="wk">' + shortDate(w) + '</th>') +
          '<th class="hf">' + h[1] + '</th>' +
          BUCKETS.map(function (k) { return '<td>' + qty(b, k[0]) + '</td>'; }).join('') +
          '<td class="barcell">' + bar + '</td></tr>';
      }).join('');
    }).join('');
    var mean = {};
    BUCKETS.forEach(function (k) {
      mean[k[0]] = tot.n ? tot[k[0]] / tot.n : 0;
      mean[k[0] + '_lb'] = tot.n ? tot[k[0] + '_lb'] / tot.n : 0;
    });
    var avg = '<tr class="grp"><th colspan="6">Per window</th></tr><tr><th></th><th class="hf">Average</th>' +
      BUCKETS.map(function (k) { return '<td>' + qty(mean, k[0]) + '</td>'; }).join('') +
      '<td class="barcell"></td></tr>';
    return '<table class="otbl"><thead><tr><th></th><th></th>' +
      BUCKETS.map(function (k) { return '<th>' + k[1] + '</th>'; }).join('') +
      '<th></th></tr></thead><tbody>' + body + avg + '</tbody></table>' +
      '<p class="hint">Cases and pounds invoiced, off the purchase orders, split by how the order ' +
      'leaves the farm: ' +
      '<b>' + esc(DATA.on_island_customer || 'Kona') + '</b> on our own trucks, <b>pick up</b> at the gate ' +
      'under FOB Farm, and <b>off-island</b> on a boat. ' +
      'The freight manifest cannot answer this — it misses more than half of Kona, because it only holds ' +
      'what somebody built a pallet for, and it has no notion of pick-up at all.</p>';
  }
  function shortDate(iso) {
    var M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var d = new Date(iso + 'T00:00:00');
    return d.getDate() + ' ' + M[d.getMonth()];
  }

  // ── Opening hours, every place across every journey ───────────────────────
  function hoursView() {
    var seen = {};
    var out = F.map(function (flow) {
      var pl = places(flow).filter(function (p) { return winOf(flow, p); });
      if (!pl.length) return '';
      return '<h4>' + esc(flow.name) + '</h4><table class="otbl hrs"><thead><tr>' +
        '<th>Place</th><th>Days</th><th>Opens</th><th>Closes</th><th></th></tr></thead><tbody>' +
        pl.map(function (p) {
          var w = winOf(flow, p);
          var key = p + '|' + w.days.join('') + '|' + w.open + '|' + w.close;
          var dup = seen[key] ? ' <em>same as above</em>' : '';
          seen[key] = 1;
          return '<tr><th class="hf">' + esc(p) + '</th>' +
            '<td class="dcell">' + DOW.map(function (dn, d) {
              return '<span class="d' + (w.days[d] ? ' on' : '') + '" title="' + dn + '">' + dn[0] + '</span>';
            }).join('') + '</td>' +
            '<td class="mono">' + clock(num(w.open)) + '</td>' +
            '<td class="mono">' + clock(num(w.close)) + '</td>' +
            '<td class="nt">' + dup + '</td></tr>';
        }).join('') + '</tbody></table>';
    }).join('');
    return out + '<p class="hint">Set in <code>journeys.md</code> under each journey&rsquo;s ' +
      '<b>Hours</b> table. These are real weekdays — Costco receiving is shut on a Sunday whatever ' +
      'day we cut on — where the task times are offsets from the cut.</p>';
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
      document.getElementById('grid').innerHTML = '<p class="hint">No journeys in journeys.md.</p>';
      return;
    }
    var flow = cur();
    if (flow.days.indexOf(S.day) < 0) S.day = flow.days[0];
    ANCHOR = S.day;

    var r = read(flow);
    SPAN = Math.max(2, Math.ceil(r.end / 24) + 1);

    seg('pick', F.map(function (x) { return [x.id, x.name]; }), S.id,
      function (v) { S.id = v; save(); paint(); });
    seg('day', flow.days.map(function (d) { return [d, d]; }), S.day,
      function (v) { S.day = v; save(); paint(); });
    document.getElementById('src').innerHTML =
      'Defined in <code>journeys.md</code> — edit that and run <code>build.py</code>.';

    var ax = '';
    for (var i = 0; i < SPAN; i++) {
      ax += '<div class="day' + (i === 0 ? ' cut' : '') + '">' + dayName(i) + '</div>';
    }
    document.getElementById('axis').innerHTML = '<div class="gut"></div><div class="days">' + ax + '</div>';
    document.getElementById('grid').innerHTML = chart(flow, r);
    document.getElementById('legend').innerHTML =
      '<span><i class="sw band"></i>a green box is one day of that place&rsquo;s opening hours</span>' +
      '<span><i class="sw mv"></i>moving</span>' +
      '<span><i class="sw wt"></i>standing still</span>' +
      '<span><i class="sw tk"></i>where a task starts</span>';

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
      flow.tasks.length + ' tasks · ' + places(flow).length + ' places · ' + r.edges.length +
      ' links · ' + r.hrs + ' h end to end, ' + r.still + ' standing still';
    document.getElementById('tasks').innerHTML = taskTable(flow, r);
    document.getElementById('sub').textContent = flow.note ||
      'Time runs across, place runs down — so a sloped bar is movement and a flat one is waiting.';

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
    var crops = {};
    (DATA.sales || []).forEach(function (x) { crops[x.crop] = 1; });
    var opts = Object.keys(crops).sort().map(function (c) {
      return [c, c === 'cuke' ? 'Cucumbers' : c.charAt(0).toUpperCase() + c.slice(1)];
    });
    if (!opts.length) {
      document.getElementById('orders').innerHTML = '<p class="hint">No order data in data.json.</p>';
      return;
    }
    if (!crops[S.crop]) S.crop = opts[0][0];
    seg('ocrop', opts, S.crop, function (v) { S.crop = v; save(); paint(); });
    document.getElementById('onote').textContent =
      (DATA.window ? DATA.window.first + ' to ' + DATA.window.last : '') +
      ' · copied from the freight model';
    document.getElementById('orders').innerHTML = ordersView();
  }

  function seg(id, opts, sel, cb) {
    var el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = opts.map(function (o) {
      return '<a data-v="' + esc(o[0]) + '"' + (String(o[0]) === String(sel) ? ' class="on"' : '') +
        '>' + esc(o[1]) + '</a>';
    }).join('');
    [].slice.call(el.querySelectorAll('a')).forEach(function (a) {
      a.onclick = function () { cb(a.getAttribute('data-v')); };
    });
  }

  paint();
})();
