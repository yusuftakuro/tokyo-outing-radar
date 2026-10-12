const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');const context={window:{}};
for(const f of ['data/areas.js','data/events.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
const e=context.window.RADAR_EVENTS,a=context.window.RADAR_AREAS,s=context.window.RADAR_STATIONS;
assert(e.length>=5);assert(s.length>=15);assert(Object.keys(a).length>=7);
const ids=new Set();for(const x of e){assert(!ids.has(x.id),`duplicate id ${x.id}`);ids.add(x.id);assert(a[x.area],`unknown area ${x.area}`);assert(/^https:\/\//.test(x.url));assert(/^\d{4}-\d\d-\d\d$/.test(x.verified));assert(/^\d{4}-\d\d-\d\d$/.test(x.dateStart));assert(!Number.isNaN(Date.parse(x.start))&&!Number.isNaN(Date.parse(x.end)));assert(Date.parse(x.start)<Date.parse(x.end));assert(x.dateStart<=x.dateEnd);assert(x.dateStart<=x.start.slice(0,10)&&x.end.slice(0,10)<=x.dateEnd);assert(x.price>=0);assert(x.reserved===false,`reservation required ${x.id}`);assert(x.summary.length>35)}
console.log(`PASS: ${e.length} verified sample events, ${Object.keys(a).length} areas, ${s.length} origins`);
