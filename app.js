(()=>{
'use strict';
const EVENTS = Array.isArray(window.RADAR_EVENTS)?window.RADAR_EVENTS:[];
const AREAS=window.RADAR_AREAS||{};
const STATIONS=window.RADAR_STATIONS||[];
const $=id=>document.getElementById(id);
const KEY='tokyo-radar-settings-1',HISTORY='tokyo-radar-shown-1';
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function load(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
const previous=load(KEY,{});
const VALID_STATIONS=new Set(STATIONS.map(s=>s[0]));
let settings={origin:VALID_STATIONS.has(previous.origin)?previous.origin:'初台',mode:previous.mode==='custom'?'custom':'now',time:/^\d\d:\d\d$/.test(previous.time||'')?previous.time:'13:00',budget:[-1,0,1000,3000,5000].includes(previous.budget)?previous.budget:3000};
let current=null,sessionSeen=new Set(),sequence=0;
const dateParts=()=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(new Date()).map(v=>[v.type,v.value]));
function localNow(){const p=dateParts();return {day:`${p.year}-${p.month}-${p.day}`, minutes:(+p.hour)*60+(+p.minute),weekday:p.weekday};}
function isoDay(t){return t.slice(0,10)}
function dateString(day){const [y,m,d]=day.split('-');const weekdays=['日','月','火','水','木','金','土'];const w=weekdays[new Date(`${day}T12:00:00+09:00`).getUTCDay()];return `${+m}月${+d}日`;}
function timeText(t){return t.slice(11,16)}
function budgetText(){return settings.budget===-1?'予算指定なし':settings.budget===0?'無料':`${settings.budget.toLocaleString('ja-JP')}円以下`}
function originCoords(){return STATIONS.find(s=>s[0]===settings.origin)}
function haversine(a,b,c,d){const r=Math.PI/180;const lat=(c-a)*r,lon=(d-b)*r;const k=Math.sin(lat/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(lon/2)**2;return 6371*2*Math.atan2(Math.sqrt(k),Math.sqrt(1-k));}
function kmToArea(area){const o=originCoords();if(!o||!area)return 30;return haversine(o[1],o[2],area.lat,area.lng)}
function leaveMinutes(){return settings.mode==='now'?localNow().minutes:Number(settings.time.slice(0,2))*60+Number(settings.time.slice(3,5))}
function isToday(e){const day=localNow().day;return isoDay(e.start)===day;}
function isActive(e){const day=localNow().day;return e.dateStart<=day&&day<=e.dateEnd&&new Date(e.end)>new Date()}
function isAvailable(e){if(e.reserved)return false;if(settings.budget>=0&&e.price>settings.budget)return false;if(!isActive(e))return false;
 const endMinutes=Number(timeText(e.end).slice(0,2))*60+Number(timeText(e.end).slice(3,5));return endMinutes>leaveMinutes()+40;}
function recentAge(areaId){const stamp=load(HISTORY,{})[areaId];return stamp?Math.floor((Date.now()-stamp)/86400000):9999}
function areaTag(e){if(e.significance==='one')return '今日だけ';if(e.significance==='final')return '今日が最終日';if(e.significance==='daily')return '今日も開催';return '開催中'}
function eventScore(e){const a=AREAS[e.area];const distance=kmToArea(a);const availableHours=(new Date(e.end)-new Date())/3600000;const bonus=e.significance==='one'?8:e.significance==='final'?7:0;
return e.quality+bonus-Math.min(distance*.75,30)+(availableHours<2?-18:0);}
function candidates(){const events=EVENTS.filter(isAvailable).map(e=>({type:'event',id:e.id,area:e.area,event:e,score:eventScore(e)}));
 const occupied=new Set(events.map(e=>e.area));const allPlaces=Object.entries(AREAS).filter(([id,a])=>a.baseline&&!occupied.has(id)).map(([id,a])=>({type:'place',id:`place-${id}`,area:id,score:a.strength-Math.min(kmToArea(a)*.75,30),recent:recentAge(id)}));
 const freshPlaces=allPlaces.filter(p=>p.recent>=30);const places=events.length||freshPlaces.length?freshPlaces:allPlaces.sort((a,b)=>b.recent-a.recent);
 return [...events,...places].sort((a,b)=>b.score-a.score);}
function nextCandidate(){return candidates().find(c=>!sessionSeen.has(c.area))||null}
function markSeen(c){sessionSeen.add(c.area);if(c.type==='place'){const history=load(HISTORY,{});history[c.area]=Date.now();save(HISTORY,history)}}
function setScreen(name){['home','result','detail'].forEach(id=>$(id).hidden=id!==name);window.scrollTo(0,0)}
function configure(){const origin=$('origin');origin.innerHTML=STATIONS.map(s=>`<option value="${esc(s[0])}">${esc(s[0])}</option>`).join('');origin.value=settings.origin;$('departureMode').value=settings.mode;$('departureTime').value=settings.time;$('departureTime').hidden=settings.mode!=='custom';$('budget').value=String(settings.budget)}
function showSettings(){configure();$('settingsDialog').showModal()}
function openLocationMap(area){const a=AREAS[area];return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(settings.origin+'駅')}&destination=${encodeURIComponent(a.station+'駅')}&travelmode=transit`}
function renderHome(){const now=localNow();$('dateLabel').textContent=`${dateString(now.day)}の東京`;$('conditions').textContent=`${settings.origin}から　｜　${settings.mode==='now'?'今から':settings.time+'出発'}　｜　${budgetText()}`;
 const list=EVENTS.filter(isAvailable).sort((a,b)=>eventScore(b)-eventScore(a));
 const lastVerified='2026-10-12';$('dataFootnote').textContent=`イベント情報確認日：${dateString(lastVerified)}。交通費・移動時間は含みません。`;
 $('freshnessNotice').textContent=now.day>lastVerified?(list.length?'掲載内容は10月12日確認時点の情報です。当日の変更は公式でご確認ください。':'本日分のイベントはまだ登録されていません。常設の街歩き候補を提案します。'):'開催中止や当日の変更は、公式情報で再確認してください。';$('freshnessNotice').classList.toggle('alert',now.day>lastVerified);
 $('eventsTitle').textContent=list.length?'今日の催し':'今日の開催情報';
 const items=list.slice(0,4);
 $('todayEvents').innerHTML=items.length?items.map(e=>`<article class="event-item"><button type="button" data-event="${esc(e.id)}"><div class="event-label">${esc(AREAS[e.area].name)}　・　${esc(areaTag(e))}</div><h3>${esc(e.name)}</h3><p>${esc(e.summary)}</p><div class="tiny">${esc(timeText(e.start))}〜${esc(timeText(e.end))}　｜　${esc(e.priceLabel)}</div></button></article>`).join(''):'<div class="empty">この条件で確認済みの催しはありません。下のボタンから散歩先を提案できます。</div>';
 $('todayEvents').querySelectorAll('[data-event]').forEach(btn=>btn.addEventListener('click',()=>{const e=EVENTS.find(x=>x.id===btn.dataset.event);if(e)showResult({type:'event',area:e.area,event:e,id:e.id})}));
 const horizon=new Date(`${now.day}T12:00:00+09:00`);horizon.setUTCDate(horizon.getUTCDate()+7);
 const future=EVENTS.filter(e=>e.dateStart>now.day && new Date(`${e.dateStart}T12:00:00+09:00`)<=horizon && !e.reserved && (settings.budget<0||e.price<=settings.budget)).sort((a,b)=>a.dateStart.localeCompare(b.dateStart)||b.quality-a.quality);
 const unique=[];const names=new Set();for(const e of future){if(names.has(e.name))continue;names.add(e.name);unique.push(e);if(unique.length===3)break}
 $('upcoming').hidden=unique.length===0;
 $('upcomingEvents').innerHTML=unique.map(e=>`<article class="event-item"><div class="event-label">${esc(dateString(e.dateStart))}〜　・　${esc(AREAS[e.area].name)}</div><h3>${esc(e.name)}</h3><div class="tiny">${esc(e.priceLabel)}　｜　<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">公式情報 ↗</a></div></article>`).join('');
}
function description(c){return c.type==='event'?c.event.summary:AREAS[c.area].baseline}
function title(c){return c.type==='event'?c.event.name:'街歩き'}
function renderFacts(c){const a=AREAS[c.area],e=c.event;return `<dl class="facts"><div class="fact"><dt>代表駅</dt><dd>${esc(a.station)}</dd></div>${e?`<div class="fact"><dt>時間</dt><dd>${esc(timeText(e.start))}〜${esc(timeText(e.end))}</dd></div><div class="fact"><dt>料金</dt><dd>${esc(e.priceLabel)}</dd></div>`:'<div class="fact"><dt>種別</dt><dd>常設の街歩き（本日の催しは未確認）</dd></div>'}</dl>`}
function showResult(c){current=c;markSeen(c);const a=AREAS[c.area];$('resultArea').textContent=a.name;
 $('resultBody').innerHTML=`<div class="eyebrow">${esc(c.type==='event'?areaTag(c.event):'街歩き')}</div><div class="result-event">${esc(title(c))}</div><p class="result-reason">${esc(description(c))}</p>${renderFacts(c)}`;
 $('resultFootnote').textContent='距離による順位調整はしていますが、電車での所要時間は計算していません。';setScreen('result')}
function showNext(){const c=nextCandidate();if(c){showResult(c)}else{current=null;$('resultArea').textContent='候補はひと通り見ました';$('resultBody').innerHTML='<p>この条件での候補は以上です。出発時間や予算を変更すると候補が増える場合があります。</p>';$('resultFootnote').textContent='';setScreen('result')}
 $('detailButton').disabled=!current;$('nextButton').textContent=current?'別の街を見る →':'最初から見る';}
function renderDetails(){if(!current)return;const c=current,e=c.event,a=AREAS[c.area];$('detailArea').textContent=a.name;const reasons=e?`<section class="block"><h2>${esc(e.name)}</h2><p>${esc(e.summary)}</p><ul>${e.detail.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></section>`:`<section class="block"><h2>街歩き</h2><p>${esc(a.baseline)}</p></section>`;
 $('detailBody').innerHTML=`${reasons}${renderFacts(c)}<section class="block"><h2>歩くなら</h2><ul>${a.near.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></section><div class="links"><a href="${esc(openLocationMap(c.area))}" target="_blank" rel="noopener noreferrer">${esc(settings.origin)}からの経路 ↗</a>${e?`<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">公式情報 ↗</a>`:''}</div><p class="meta">${e?`公式情報確認：${esc(e.verified)}。${esc(e.notes)}`:'常設の街歩き提案です。施設・店舗の営業時間や休業日は別途ご確認ください。'}</p>`;setScreen('detail')}
function reset(){sessionSeen=new Set();current=null;sequence=0;renderHome();setScreen('home')}
$('homeLink').onclick=e=>{e.preventDefault();reset()};$('settingsButton').onclick=showSettings;$('cancelSettings').onclick=()=>$('settingsDialog').close();$('departureMode').onchange=()=>{$('departureTime').hidden=$('departureMode').value!=='custom'};
$('settingsForm').onsubmit=e=>{e.preventDefault();settings={origin:$('origin').value,mode:$('departureMode').value,time:$('departureTime').value||'13:00',budget:Number($('budget').value)};save(KEY,settings);$('settingsDialog').close();reset()};
$('recommendButton').onclick=()=>{sessionSeen=new Set();showNext()};$('resultBack').onclick=()=>setScreen('home');$('detailBack').onclick=()=>setScreen('result');$('detailButton').onclick=renderDetails;$('nextButton').onclick=()=>{if(!current){sessionSeen=new Set()}showNext()};
window.RADAR_DEBUG={localNow,candidates,isAvailable,haversine,getSettings:()=>({...settings})};
renderHome();
})();
