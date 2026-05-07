const rotaIndex = window.ROTA_INDEX || [];
window.ROTA_DATASETS = window.ROTA_DATASETS || {};
let data = { periods: [], rows: [], shifts: [], names: [] };
let activeRota = null;

const rotaSelect = document.getElementById('rotaSelect');
const nameSelect = document.getElementById('nameSelect');
const shiftCount = document.getElementById('shiftCount');
const shiftPreview = document.getElementById('shiftPreview');
const rotaTable = document.getElementById('rotaTable');
const confirmCheck = document.getElementById('confirmCheck');
const downloadBtn = document.getElementById('downloadBtn');

init();

function init(){
  if(!rotaIndex.length){
    rotaSelect.innerHTML = '<option value="">No rotas available</option>';
    nameSelect.innerHTML = '<option value="">No names available</option>';
    shiftPreview.innerHTML = '<p class="empty">No rota index found.</p>';
    return;
  }
  rotaSelect.innerHTML = rotaIndex.map(r => `<option value="${esc(r.key)}">${esc(r.label)}</option>`).join('');
  rotaSelect.addEventListener('change', () => loadRota(rotaSelect.value));
  nameSelect.addEventListener('change', render);
  confirmCheck.addEventListener('change', updateDownloadState);
  downloadBtn.addEventListener('click', downloadIcs);
  loadRota(rotaSelect.value || rotaIndex[0].key);
}

function loadRota(key){
  const meta = rotaIndex.find(r => r.key === key) || rotaIndex[0];
  if(!meta) return;
  activeRota = meta;
  confirmCheck.checked = false;
  nameSelect.innerHTML = '<option value="">Loading names...</option>';
  shiftPreview.innerHTML = '<p class="empty">Loading rota...</p>';
  rotaTable.innerHTML = '';
  downloadBtn.disabled = true;

  if(window.ROTA_DATASETS[meta.key]){
    setData(window.ROTA_DATASETS[meta.key]);
    return;
  }

  const script = document.createElement('script');
  script.src = meta.file + '?v=' + Date.now();
  script.onload = () => {
    if(window.ROTA_DATASETS[meta.key]) setData(window.ROTA_DATASETS[meta.key]);
    else showLoadError('The rota data file loaded, but did not register the expected key: '+meta.key);
  };
  script.onerror = () => showLoadError('Could not load rota file: '+meta.file);
  document.body.appendChild(script);
}

function setData(nextData){
  data = nextData || { periods: [], rows: [], shifts: [], names: [] };
  populateNames();
  render();
}

function showLoadError(message){
  data = { periods: [], rows: [], shifts: [], names: [] };
  nameSelect.innerHTML = '<option value="">No names available</option>';
  shiftPreview.innerHTML = `<p class="empty">${esc(message)}</p>`;
  rotaTable.innerHTML = '';
  shiftCount.textContent = '0';
  downloadBtn.disabled = true;
}

function populateNames(){
  const names = [...new Set(data.shifts.map(s => s.name).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  nameSelect.innerHTML = '<option value="">Select name...</option>' + names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  confirmCheck.checked = false;
}

function selectedShifts(){
  const name = nameSelect.value;
  if(!name) return [];
  return data.shifts
    .filter(s => s.name === name)
    .sort((a,b)=> a.date.localeCompare(b.date) || a.column.localeCompare(b.column));
}

function selectedRows(){
  return data.rows.slice().sort((a,b)=>a.date.localeCompare(b.date));
}

function render(){
  const shifts = selectedShifts();
  const name = nameSelect.value;
  shiftCount.textContent = String(shifts.length);
  confirmCheck.checked = false;
  renderShiftPreview(shifts);
  renderRotaTable(name);
  updateDownloadState();
}

function renderShiftPreview(shifts){
  if(!nameSelect.value){ shiftPreview.innerHTML = '<p class="empty">Select your name to preview shifts.</p>'; return; }
  if(!shifts.length){ shiftPreview.innerHTML = '<p class="empty">No duties found for this name in this rota.</p>'; return; }
  shiftPreview.innerHTML = shifts.map(s => `<div class="shift"><div><strong>${formatDate(s.date)}</strong><br><small>${esc(s.weekday)}</small></div><div>${esc(s.column)}</div><div><small>All day</small></div></div>`).join('');
}

function renderRotaTable(name){
  const rows = selectedRows();
  if(!rows.length){ rotaTable.innerHTML = '<p class="empty">No rota rows loaded.</p>'; return; }
  const dutyColumns = [...new Set(rows.flatMap(r => r.duties.map(d => d.column)))];
  let currentPeriod = '';
  let html = '<table class="rotaTable"><thead><tr><th>Day</th><th>Date</th>'+dutyColumns.map(c=>`<th>${esc(c)}</th>`).join('')+'</tr></thead><tbody>';
  for(const row of rows){
    const period = (data.periods.find(p => p.key === row.periodKey) || {}).label || row.periodKey;
    if(period !== currentPeriod){ currentPeriod = period; html += `<tr class="monthRow"><th colspan="${2+dutyColumns.length}">${esc(period)}</th></tr>`; }
    html += `<tr><td>${esc(row.weekday)}</td><td>${formatDate(row.date)}</td>`;
    for(const col of dutyColumns){
      const duty = row.duties.find(d => d.column === col);
      const value = duty ? duty.name : '';
      const isHit = name && value === name;
      html += `<td class="${isHit ? 'hit' : ''}">${esc(value)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  rotaTable.innerHTML = html;
}

function updateDownloadState(){ downloadBtn.disabled = selectedShifts().length === 0 || !confirmCheck.checked; }

function downloadIcs(){
  const shifts = selectedShifts();
  const name = nameSelect.value;
  const ics = buildIcs(shifts, name);
  const rotaKey = activeRota ? activeRota.key : 'rota';
  downloadFile(`${safe(name)}-${safe(rotaKey)}.ics`, ics, 'text/calendar;charset=utf-8');
}

function buildIcs(shifts, name){
  const stamp = toIcsUtc(new Date());
  const events = shifts.map((s, i) => {
    const start = s.date.replaceAll('-','');
    const end = addOneDayIso(s.date).replaceAll('-','');
    return ['BEGIN:VEVENT',
      `UID:${safe(name)}-${s.date}-${safe(s.column)}-${i}@rie-icu-rota`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${icsEsc('ICU '+s.column)}`,
      'LOCATION:RIE ICU',
      `DESCRIPTION:${icsEsc('Experimental rota calendar export. Check against official rota. Name: '+name+'; duty: '+s.column)}`,
      'END:VEVENT'].join('\r\n');
  }).join('\r\n');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//RIE ICU Rota Calendar//EN','CALSCALE:GREGORIAN',events,'END:VCALENDAR'].join('\r\n');
}

function addOneDayIso(iso){ const d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); }
function toIcsUtc(d){ return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`; }
function formatDate(iso){ return new Date(iso+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
function pad(n){ return String(n).padStart(2,'0'); }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function icsEsc(s){ return String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n'); }
function safe(s){ return String(s || 'rota').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function downloadFile(filename, content, type){ const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
