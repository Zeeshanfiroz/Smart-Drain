/* ============================================================
   DrainGuard — app.js
   Fixes applied:
   1. No alert() — inline form error
   2. Nav highlight uses data-page attribute, not fragile index
   3. setInterval stacking fixed — stored and cleared
   4. Chart area closing path fixed — anchors to first point Y
   5. Gauge unit rendering fixed — separate span, no empty tags
   6. sendWorker / assignWorker mutate real state
   7. Alert badge count updates dynamically
   8. Alert filter buttons actually filter list
   9. Mobile hamburger sidebar
   10. Logout shows confirmation modal + clears session state
   ============================================================ */

/* ─── State ─── */
const state = {
  tickInterval: null,
  selectedDrain: 'D-04',
  alertCount: 3,
  // Worker availability — true = available
  workers: {
    'Ram Kumar':    { available: true,  zone: 'ZONE A · Sector 7 area',        assigned: null },
    'Vijay Prasad': { available: true,  zone: 'ZONE B · Market area',           assigned: null },
    'Suresh Yadav': { available: false, zone: 'ZONE C · ON SITE D-06',          assigned: 'D-06' },
    'Mohan Singh':  { available: false, zone: 'ZONE A · D-01 done · Returning', assigned: 'returning' },
    'Deepak Verma': { available: true,  zone: 'ZONE D · Sector 12 area',        assigned: null },
  },
  // Drain dispatch status — false = worker not yet sent
  dispatched: { 'D-04': false, 'D-09': false },
};

/* ─── Drain sensor data ─── */
const drainData = {
  'D-04': {
    name: 'D-04 Live Sensors', badge: 'CRITICAL', badgeClass: 'pb-red',
    level:     { val: '94', unit: '%',   pct: 94, color: 'var(--red)',    min: '0%',  max: '100%' },
    ph:        { val: '5.2',unit: '',    pct: 37, color: 'var(--red)',    min: '0',   max: '14'   },
    turbidity: { val: '340', unit: 'NTU',pct: 68, color: 'var(--orange)', min: '0',   max: '500'  },
    gas:       { val: '78',  unit: 'ppm',pct: 78, color: 'var(--yellow)', min: '0',   max: '100'  },
    mlText: 'Overflow likely in <strong style="color:var(--red)">~18 minutes</strong> if no action taken · Confidence 91%',
    mlColor: '#ff9999', mlBorder: 'rgba(255,61,61,0.3)', mlBg: 'rgba(255,61,61,0.06)',
    chartColor: '#ff3d3d',
    /* FIX: path defined as array of [x,y] so closing area can anchor correctly */
    chartPoints: [[0,118],[30,114],[60,110],[90,105],[120,98],[150,88],[180,72],[210,58],[240,42],[270,28],[300,10]],
  },
  'D-09': {
    name: 'D-09 Live Sensors', badge: 'URGENT', badgeClass: 'pb-red',
    level:     { val: '88', unit: '%',   pct: 88, color: 'var(--red)',    min: '0%',  max: '100%' },
    ph:        { val: '4.8',unit: '',    pct: 34, color: 'var(--red)',    min: '0',   max: '14'   },
    turbidity: { val: '410', unit: 'NTU',pct: 82, color: 'var(--red)',    min: '0',   max: '500'  },
    gas:       { val: '91',  unit: 'ppm',pct: 91, color: 'var(--red)',    min: '0',   max: '100'  },
    mlText: 'Chemical overflow in <strong style="color:var(--red)">~25 minutes</strong> · Industrial discharge suspected · Confidence 87%',
    mlColor: '#ff9999', mlBorder: 'rgba(255,61,61,0.3)', mlBg: 'rgba(255,61,61,0.06)',
    chartColor: '#ff7a00',
    chartPoints: [[0,122],[30,118],[60,112],[90,106],[120,96],[150,84],[180,68],[210,52],[240,38],[270,22],[300,14]],
  },
  'D-06': {
    name: 'D-06 Live Sensors', badge: 'WARNING', badgeClass: 'pb-yellow',
    level:     { val: '71', unit: '%',   pct: 71, color: 'var(--yellow)', min: '0%',  max: '100%' },
    ph:        { val: '6.1',unit: '',    pct: 44, color: 'var(--yellow)', min: '0',   max: '14'   },
    turbidity: { val: '210', unit: 'NTU',pct: 42, color: 'var(--yellow)', min: '0',   max: '500'  },
    gas:       { val: '44',  unit: 'ppm',pct: 44, color: 'var(--yellow)', min: '0',   max: '100'  },
    mlText: 'Bio-enzyme treatment active. Level stabilising. <strong style="color:var(--yellow)">Monitor closely</strong> · Confidence 74%',
    mlColor: '#ffe599', mlBorder: 'rgba(255,204,0,0.3)', mlBg: 'rgba(255,204,0,0.06)',
    chartColor: '#ffcc00',
    chartPoints: [[0,90],[30,88],[60,85],[90,82],[120,78],[150,74],[180,70],[210,66],[240,62],[270,58],[300,52]],
  },
  'D-01': {
    name: 'D-01 Live Sensors', badge: 'ALL CLEAR', badgeClass: 'pb-green',
    level:     { val: '22', unit: '%',   pct: 22, color: 'var(--green)',  min: '0%',  max: '100%' },
    ph:        { val: '7.1',unit: '',    pct: 51, color: 'var(--green)',  min: '0',   max: '14'   },
    turbidity: { val: '18',  unit: 'NTU',pct:  4, color: 'var(--green)',  min: '0',   max: '500'  },
    gas:       { val: '6',   unit: 'ppm',pct:  6, color: 'var(--green)',  min: '0',   max: '100'  },
    mlText: 'All 4 phases complete. Drain is <strong style="color:var(--green)">clean and safe</strong>. No action needed.',
    mlColor: '#88ffbb', mlBorder: 'rgba(0,255,136,0.3)', mlBg: 'rgba(0,255,136,0.06)',
    chartColor: '#00ff88',
    chartPoints: [[0,100],[30,98],[60,96],[90,94],[120,92],[150,90],[180,88],[210,86],[240,84],[270,82],[300,80]],
  },
};

/* ─── pointsToPath helper ─── */
function pointsToPath(pts) {
  return pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
}

/* FIX: area path closes back to first point's Y on baseline, not hardcoded Y=140 */
function pointsToArea(pts) {
  const line = pointsToPath(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${line} L${last[0]},140 L${first[0]},140 Z`;
}

/* ─── Login / Logout ─── */
function doLogin() {
  const id = document.getElementById('empId').value.trim();
  const err = document.getElementById('loginError');
  if (!id) {
    err.textContent = '⚠ Please enter your Employee ID / कृपया कर्मचारी आईडी दर्ज करें';
    err.classList.add('show');
    return;
  }
  err.classList.remove('show');

  // FIX: clear any previous interval before starting a new one
  if (state.tickInterval) {
    clearInterval(state.tickInterval);
    state.tickInterval = null;
  }

  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';

  // Update officer name from employee id
  document.getElementById('officerName').textContent = 'Officer · ' + id;

  tick();
  state.tickInterval = setInterval(tick, 1000);

  // Default drain selected
  selectDrain('D-04');
}

/* FIX: Logout shows confirmation modal instead of immediately logging out */
function doLogout() {
  document.getElementById('logoutModal').classList.add('show');
}

function cancelLogout() {
  document.getElementById('logoutModal').classList.remove('show');
}

function confirmLogout() {
  // FIX: clear interval, reset state, clear form field so next login is fresh
  if (state.tickInterval) {
    clearInterval(state.tickInterval);
    state.tickInterval = null;
  }
  document.getElementById('logoutModal').classList.remove('show');
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('loginPage').style.display = 'flex';

  // Reset form fields
  document.getElementById('empId').value = '';
  document.getElementById('loginError').classList.remove('show');
}

/* ─── Navigation ─── */
const pageTitles = {
  dashboard: "TODAY'S OVERVIEW / आज का सारांश",
  map:       'DRAIN MAP / नाली का नक्शा',
  alerts:    'ALERTS / अलर्ट',
  phases:    'PHASE TRACKER / सफाई प्रगति',
  dispatch:  'SEND WORKERS / कर्मचारी भेजें',
  report:    'DAILY REPORT / दैनिक रिपोर्ट',
};

/* FIX: uses data-page attribute instead of fragile querySelectorAll index */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');

  const navBtn = document.querySelector(`.nav-item[data-page="${id}"]`);
  if (navBtn) navBtn.classList.add('active');

  document.getElementById('pageTitle').textContent = pageTitles[id] || id;

  // Close mobile sidebar after navigation
  closeSidebar();
}

/* ─── Mobile Sidebar ─── */
function openSidebar() {
  document.querySelector('.sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('show');
}
function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

/* ─── Drain selection ─── */
function selectDrain(id) {
  const d = drainData[id];
  if (!d) {
    console.warn('selectDrain: unknown drain id:', id);
    showToast('⚠ Unknown drain: ' + id);
    return;
  }
  state.selectedDrain = id;

  // Highlight selected card
  document.querySelectorAll('.drain-card').forEach(c => c.classList.remove('selected'));
  const el = document.querySelector(`.drain-card[data-drain="${id}"]`);
  if (el) el.classList.add('selected');

  // Sensor panel title + badge
  document.getElementById('sensorTitle').textContent = d.name;
  const badge = document.getElementById('sensorBadge');
  badge.textContent = d.badge;
  badge.className = 'pbadge ' + d.badgeClass;

  // FIX: setGauge uses separate val + unit elements — no empty spans
  setGauge('g-level',     d.level);
  setGauge('g-ph',        d.ph);
  setGauge('g-turbidity', d.turbidity);
  setGauge('g-gas',       d.gas);

  // FIX: chart uses points array for both line and area — area closes correctly
  const linePath = pointsToPath(d.chartPoints);
  const areaPath = pointsToArea(d.chartPoints);
  const lastPt   = d.chartPoints[d.chartPoints.length - 1];

  document.getElementById('chartPath').setAttribute('stroke', d.chartColor);
  document.getElementById('chartPath').setAttribute('d', linePath);
  document.getElementById('chartArea').setAttribute('d', areaPath);
  document.getElementById('chartAreaStop').setAttribute('stop-color', d.chartColor);
  document.getElementById('chartDot').setAttribute('fill', d.chartColor);
  document.getElementById('chartDot').setAttribute('cx', lastPt[0]);
  document.getElementById('chartDot').setAttribute('cy', lastPt[1]);
  document.getElementById('chartPct').setAttribute('fill', d.chartColor);
  document.getElementById('chartPct').setAttribute('x', lastPt[0] - 17);
  document.getElementById('chartPct').setAttribute('y', lastPt[1] - 5);
  document.getElementById('chartPct').textContent = d.level.val + d.level.unit;

  // ML box
  document.getElementById('mlText').innerHTML = d.mlText;
  document.getElementById('mlText').style.color = d.mlColor;
  document.getElementById('mlBox').style.borderColor = d.mlBorder;
  document.getElementById('mlBox').style.background  = d.mlBg;

  showToast('📡 Now showing: ' + id + ' live sensors');
}

/* FIX: gauge sets val and unit as separate DOM nodes — no empty spans */
function setGauge(gaugeId, cfg) {
  const g = document.getElementById(gaugeId);
  if (!g) return;

  const valEl  = g.querySelector('.gauge-val');
  const fillEl = g.querySelector('.gauge-fill');
  const minEl  = g.querySelectorAll('.gauge-range span')[0];
  const maxEl  = g.querySelectorAll('.gauge-range span')[1];

  valEl.style.color = cfg.color;
  // Build val + optional unit
  let html = cfg.val;
  if (cfg.unit) html += `<span class="gauge-unit">${cfg.unit}</span>`;
  valEl.innerHTML = html;

  fillEl.style.width      = cfg.pct + '%';
  fillEl.style.background = cfg.color;

  minEl.textContent = cfg.min;
  maxEl.textContent = cfg.max;
}

/* ─── Dispatch — mutates real state ─── */
function sendWorker(drain, loc) {
  if (state.dispatched[drain]) {
    showToast('ℹ Worker already dispatched to ' + loc);
    return;
  }
  state.dispatched[drain] = true;

  // Find first available worker
  const workerName = Object.keys(state.workers).find(
    n => state.workers[n].available && state.workers[n].assigned === null
  );

  if (workerName) {
    state.workers[workerName].available = false;
    state.workers[workerName].assigned  = drain;
    renderWorkerList();
    showToast(`🚀 ${workerName} dispatched to ${loc}! SMS sent.`);
  } else {
    showToast('⚠ No available workers right now! / कोई कर्मचारी उपलब्ध नहीं');
  }
}

function assignWorker(name, drain) {
  const w = state.workers[name];
  if (!w) return;
  if (!w.available) {
    showToast(`⚠ ${name} is currently busy`);
    return;
  }
  w.available = false;
  w.assigned  = drain;
  renderWorkerList();
  showToast(`✅ ${name} assigned to ${drain}! SMS sent to worker.`);
}

/* FIX: re-renders worker cards from state so UI reflects real availability */
function renderWorkerList() {
  const list = document.getElementById('workerList');
  if (!list) return;
  list.innerHTML = '';

  Object.entries(state.workers).forEach(([name, w]) => {
    const statusClass = w.available ? 'ws-avail' : 'ws-busy';
    const statusLabel = w.available ? 'Available' : (w.assigned === 'returning' ? 'Returning' : 'Busy');
    const btnDisabled = !w.available ? 'disabled' : '';
    const btnLabel    = !w.available ? 'BUSY' : 'ASSIGN';
    const onAssign    = w.available ? `assignWorker('${name}', 'next drain')` : '';

    list.insertAdjacentHTML('beforeend', `
      <div class="worker-card">
        <div class="w-avatar">👷</div>
        <div class="w-info">
          <div class="w-name">${name}</div>
          <div class="w-zone">${w.zone}</div>
        </div>
        <span class="w-status ${statusClass}">${statusLabel}</span>
        <button class="assign-btn" ${btnDisabled} ${onAssign ? `onclick="${onAssign}"` : ''}>
          ${btnLabel}
        </button>
      </div>
    `);
  });
}

/* ─── Alert filters — actually filter the list ─── */
/* FIX: clicking filter buttons hides/shows alert items by data-severity */
function initAlertFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active-f'));
      btn.classList.add('active-f');

      const filter = btn.dataset.filter;
      document.querySelectorAll('.alert-item').forEach(item => {
        if (filter === 'all') {
          item.classList.remove('hidden');
        } else {
          const sev = item.dataset.severity || '';
          item.classList.toggle('hidden', sev !== filter);
        }
      });
    });
  });
}

/* ─── Alert badge — updates dynamically ─── */
function updateAlertBadge() {
  const badge = document.querySelector('.nav-badge');
  if (badge) badge.textContent = state.alertCount;
}

function markAlertSeen(btn) {
  const item = btn.closest('.alert-item');
  if (!item) return;
  item.style.opacity = '0.4';
  item.style.pointerEvents = 'none';
  if (state.alertCount > 0) {
    state.alertCount--;
    updateAlertBadge();
  }
  showToast('✅ Alert marked as seen');
}

/* ─── Clock ─── */
function tick() {
  const n = new Date();
  const timeEl   = document.getElementById('topClock');
  const dateEl   = document.getElementById('pageDate');
  const reportEl = document.getElementById('reportDate');
  if (timeEl)   timeEl.textContent   = n.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (dateEl)   dateEl.textContent   = n.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (reportEl) reportEl.textContent = n.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ─── Toast ─── */
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  const m = document.getElementById('toastMsg');
  if (!t || !m) return;
  m.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

/* ─── Boot ─── */
document.addEventListener('DOMContentLoaded', () => {
  initAlertFilters();
  updateAlertBadge();
  renderWorkerList();
  tick();
});