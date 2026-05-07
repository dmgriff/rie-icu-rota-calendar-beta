const MONTHS={january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
const MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];
let generated='', generatedFilename='', generatedMeta=null;
const fileInput=document.getElementById('fileInput'),statusEl=document.getElementById('status'),downloadBtn=document.getElementById('downloadData'),publishPanel=document.getElementById('publishPanel'),indexLine=document.getElementById('indexLine');

fileInput.addEventListener('change',async e=>{
  const file=e.target.files?.[0];
  if(!file)return;
  try{
    publishPanel.hidden=true;
    statusEl.textContent='Reading '+file.name+'...';
    const parsed=await parseDocx(file);
    generatedMeta=makeRotaMeta(parsed);
    generatedFilename=`${generatedMeta.key}.js`;
    generated='window.ROTA_DATASETS = window.ROTA_DATASETS || {};\nwindow.ROTA_DATASETS["'+generatedMeta.key+'"] = '+JSON.stringify(parsed.data,null,2)+';\n';
    statusEl.textContent=`Found ${parsed.data.shifts.length} duties, ${parsed.data.names.length} names. Rota period: ${generatedMeta.label}.`;
    downloadBtn.textContent='Download '+generatedFilename;
    downloadBtn.disabled=false;
    indexLine.textContent=`{ key: "${generatedMeta.key}", label: "${generatedMeta.label}", file: "data/${generatedFilename}" },`;
    publishPanel.hidden=false;
  }catch(err){
    console.error(err);
    statusEl.textContent='Could not parse rota: '+err.message;
    downloadBtn.disabled=true;
  }
});

downloadBtn.addEventListener('click',()=>downloadFile(generatedFilename,generated,'application/javascript;charset=utf-8'));

async function parseDocx(file){
  if(!window.JSZip)throw new Error('JSZip did not load.');
  const zip=await JSZip.loadAsync(file);
  const docfile=zip.file('word/document.xml');
  if(!docfile)throw new Error('No word/document.xml found.');
  const xmlText=await docfile.async('text');
  const xml=new DOMParser().parseFromString(xmlText,'application/xml');
  const body=xml.getElementsByTagNameNS('*','body')[0];
  let current=null;const periods=[],rows=[],shifts=[],names=new Set();
  for(const child of [...body.children]){
    if(child.localName==='p'){
      const h=parseHeading(textFromNode(child));
      if(h)current=h;
    }
    if(child.localName==='tbl'&&current){
      const result=parseTable(child,current);
      if(result.rows.length){
        periods.push(result.period);rows.push(...result.rows);shifts.push(...result.shifts);result.shifts.forEach(s=>names.add(s.name));
      }
    }
  }
  if(!periods.length) throw new Error('No monthly rota tables found.');
  periods.sort((a,b)=>a.key.localeCompare(b.key));
  rows.sort((a,b)=>a.date.localeCompare(b.date));
  shifts.sort((a,b)=>a.date.localeCompare(b.date)||a.column.localeCompare(b.column)||a.name.localeCompare(b.name));
  const label=rangeLabel(periods);
  const data={generatedFrom:file.name,periods,rows,shifts,names:[...names].sort(),label};
  return {data, periods};
}

function makeRotaMeta(parsed){
  const periods=parsed.periods;
  const first=periods[0], last=periods[periods.length-1];
  const label=rangeLabel(periods);
  const key=`${MONTH_NAMES[monthFromKey(first.key)].slice(0,3).toLowerCase()}-${MONTH_NAMES[monthFromKey(last.key)].slice(0,3).toLowerCase()}-${yearFromKey(first.key)}`;
  return {key,label};
}
function rangeLabel(periods){
  if(!periods.length)return 'Rota';
  const first=periods[0], last=periods[periods.length-1];
  const firstMonth=MONTH_NAMES[monthFromKey(first.key)];
  const lastMonth=MONTH_NAMES[monthFromKey(last.key)];
  const firstYear=yearFromKey(first.key), lastYear=yearFromKey(last.key);
  return firstYear===lastYear ? `${firstMonth} - ${lastMonth} ${firstYear}` : `${firstMonth} ${firstYear} - ${lastMonth} ${lastYear}`;
}
function monthFromKey(key){return Number(key.split('-')[1])-1;}
function yearFromKey(key){return Number(key.split('-')[0]);}
function parseHeading(text){const compact=String(text||'').toLowerCase().replace(/\s+/g,'');const m=compact.match(/criticalcareconsultantrota([a-z]+)(\d{4})/);if(!m)return null;const monthIndex=MONTHS[m[1]],year=Number(m[2]);if(monthIndex===undefined||!year)return null;return{monthIndex,year};}
function parseTable(tbl,h){const raw=[...tbl.getElementsByTagNameNS('*','tr')].map(r=>[...r.getElementsByTagNameNS('*','tc')].map(c=>clean(textFromNode(c))));if(!raw.length)return{rows:[],shifts:[],period:null};const headerIndex=raw.findIndex(r=>r.filter(isDutyHeader).length>=2);if(headerIndex<0)return{rows:[],shifts:[],period:null};const header=raw[headerIndex];const dateIndex=findDateColumnIndex(header,raw,headerIndex);const dutyCols=header.map((label,index)=>({label:normaliseDuty(label),index})).filter(c=>c.index>dateIndex&&c.label);const periodKey=`${h.year}-${String(h.monthIndex+1).padStart(2,'0')}`,periodLabel=`${MONTH_NAMES[h.monthIndex]} ${h.year}`;const rows=[],shifts=[];for(const r of raw.slice(headerIndex+1)){const weekday=r[dateIndex-1]||'';const day=Number(r[dateIndex]);if(!Number.isInteger(day)||day<1||day>31)continue;const iso=`${h.year}-${String(h.monthIndex+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;const row={periodKey,date:iso,weekday,duties:[]};for(const col of dutyCols){const name=cleanName(r[col.index]);row.duties.push({column:col.label,name});if(name)shifts.push({periodKey,date:iso,weekday,column:col.label,name});}rows.push(row);}return{period:{key:periodKey,label:periodLabel,start:`${periodKey}-01`},rows,shifts};}
function findDateColumnIndex(header,rows,headerIndex){for(let i=0;i<header.length;i++){const sample=rows.slice(headerIndex+1,headerIndex+8).map(r=>r[i]);const numeric=sample.filter(v=>/^\d{1,2}$/.test(String(v||'').trim())).length;const prev=i>0&&rows.slice(headerIndex+1,headerIndex+8).filter(r=>/^(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)$/i.test(String(r[i-1]||'').trim())).length>=2;if(numeric>=2&&prev)return i;}return 1;}
function isDutyHeader(v){return/\b(base|on\s*call|night|116|118)\b/i.test(clean(v));}
function normaliseDuty(v){const t=clean(v).replace(/\b1\s*st\b/i,'1st').replace(/\b2\s*nd\b/i,'2nd');return isDutyHeader(t)?t:'';}
function cleanName(v){const n=clean(v).toUpperCase();return(!n||n==='SERVICE')?'':n;}
function textFromNode(node){return[...node.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join(' ').replace(/\s+/g,' ').trim();}
function clean(s){return String(s||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();}
function downloadFile(filename,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}
