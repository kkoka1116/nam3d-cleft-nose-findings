import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const COLORS={phantom_v2:'#2a78d6',external_v1:'#1baf7a',highlight:'#1baf7a',muted:'var(--muted-bar)'};
const LABELS={frontal:'Frontal',frontal_taped:'Frontal (taped)',oblique_frontal:'Three-quarter',submental_oblique:'Oblique below',basal:'Basal',
  basal_penny:'Basal + penny',profile:'Profile',profile_penny:'Profile + penny',frontal_penny:'Frontal + penny'};
const VIEWNAMES={frontal:'front',left20:'20° left',right20:'20° right',submental35:'from below 35°'};
const SUBJECTS={nih_right_ucl:'Right unilateral cleft',nih_left_ucl:'Left unilateral cleft',nih_bilateral_cl:'Bilateral cleft'};
const tip=document.createElement('div'); tip.className='tooltip'; document.body.appendChild(tip);
const showTip=(e,html)=>{tip.innerHTML=html;tip.style.opacity=1;tip.style.left=(e.clientX+12)+'px';tip.style.top=(e.clientY+12)+'px'};
const hideTip=()=>tip.style.opacity=0;

const site=await (await fetch('data/site.json')).json();

// ---------- stats ----------
const c=site.charts.counts;
document.getElementById('stats')&&(document.getElementById('stats').innerHTML=[[c.phantom_runs,'phantom runs'],[c.nih_runs,'real cleft-model runs'],[c.comparison_models,'AI models compared'],[c.clinic_panels,'clinic panels']]
  .map(([v,l])=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`).join(''));

// ---------- protocol table: 2D ratio error by photo view (from results) ----------
{
  const v2=site.charts.views2d, cols=[['frontal'],['left20','right20'],['left40','right40'],['submental35'],['submental55']];
  const colNames=['Frontal','Turned 20°','Turned 40°','From below 35°','From below 55°'];
  const meas=[['nostril_width_ratio','Width ratio'],['nostril_height_ratio','Height ratio'],['nostril_area_ratio','Area ratio']];
  const cell=(m,views)=>{const r=v2.filter(x=>x.measurement===m&&views.includes(x.view)); const e=r.reduce((a,x)=>a+x.err_pct,0)/r.length, fa=r.reduce((a,x)=>a+x.false_asym_pct,0)/r.length;
    const cls=e<=8?'good':e<=12?'fair':'poor';
    return `<td class="${cls}" title="Symmetric noses appeared ${fa.toFixed(1)}% asymmetric on this view">${e<100?e.toFixed(1):e.toFixed(0)}%<small>${cls==='good'?'use':cls==='fair'?'caution':'avoid'}</small></td>`};
  const el=document.getElementById('protocol-table');
  if(el) el.innerHTML=`<table class="ptable"><tr><th></th>${colNames.map(c=>`<th>${c}</th>`).join('')}</tr>`
    +meas.map(([m,l])=>`<tr><th class="row">${l}</th>${cols.map(v=>cell(m,v)).join('')}</tr>`).join('')+'</table>';
}

// ---------- charts (plain SVG) ----------
function hbar(el,rows,{groups,value,fmt=v=>v.toFixed(1),max,colorFor,unit=''}){
  const W=640,rowH=groups.length*18+16,top=10,left=130,right=60,H=top+rows.length*rowH+24;
  const mx=max??Math.max(...rows.flatMap(r=>groups.map(g=>value(r,g)??0)))*1.12;
  const x=v=>left+(W-left-right)*v/mx; let s=`<svg viewBox="0 0 ${W} ${H}">`;
  for(let t=0;t<=4;t++){const v=mx*t/4;s+=`<g class="grid"><line x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${H-20}"/></g><text x="${x(v)}" y="${H-4}" text-anchor="middle">${fmt(v)}${unit}</text>`}
  rows.forEach((r,i)=>{const y0=top+i*rowH+8; s+=`<text x="${left-10}" y="${y0+groups.length*9+4}" text-anchor="end">${r.label}</text>`;
    groups.forEach((g,j)=>{const v=value(r,g); if(v==null) return; const y=y0+j*18, w=Math.max(2,x(v)-left);
      s+=`<rect x="${left}" y="${y}" width="${w}" height="14" rx="4" fill="${colorFor(r,g)}" data-tip="${r.label}${g.name?' · '+g.name:''}: ${fmt(v)}${unit}"/>`
        +`<text class="val" x="${left+w+6}" y="${y+11}">${fmt(v)}${unit}</text>`})});
  el.innerHTML=s+'</svg>';
  el.querySelectorAll('rect').forEach(r=>{r.addEventListener('mousemove',e=>showTip(e,r.dataset.tip));r.addEventListener('mouseleave',hideTip)});
}
const comp=site.charts.comparison, models=[...new Set(comp.map(d=>d.model))];
const byModel=m=>Object.fromEntries(comp.filter(d=>d.model===m).map(d=>[d.experiment,d]));
const expGroups=[{key:'phantom_v2',name:'Synthetic infant faces'},{key:'external_v1',name:'Real NIH cleft models'}];
document.getElementById('legend-exp').innerHTML=expGroups.map(g=>`<span><i style="background:${COLORS[g.key]}"></i>${g.name}</span>`).join('');
const mrows=models.map(m=>({label:m,d:byModel(m)}));
const tone=(r,g)=>r.label==='MoGe-2'?COLORS[g.key]:COLORS[g.key]+'80';
hbar(document.getElementById('chart-flatten'),mrows.filter(r=>r.d.phantom_v2.flatten_mm!=null),{groups:expGroups,value:(r,g)=>r.d[g.key].flatten_mm,unit:' mm',colorFor:tone});
document.getElementById('chart-flatten').insertAdjacentHTML('afterbegin',document.getElementById('legend-exp').outerHTML.replace('id="legend-exp"',''));
hbar(document.getElementById('chart-shape'),mrows.filter(r=>r.d.phantom_v2.shape_mm!=null),{groups:expGroups,value:(r,g)=>r.d[g.key].shape_mm,unit:' mm',colorFor:tone});
hbar(document.getElementById('chart-tilt'),mrows,{groups:expGroups,value:(r,g)=>r.d[g.key].tilt_deg,fmt:v=>v.toFixed(0),unit:'°',colorFor:tone});
const methods=[{name:'2D on photo',c:'#2a78d6'},{name:'DA3-Small 3D',c:'#eb6834'},{name:'MoGe-2 3D',c:'#1baf7a'}];
hbar(document.getElementById('chart-ratios'),site.charts.ratios.map(r=>({label:r.case,v:Object.fromEntries(r.values.map(x=>[x.method,x.err]))})),
  {groups:methods,value:(r,g)=>(Math.exp(r.v[g.name])-1)*100,fmt:v=>v.toFixed(0),unit:'%',colorFor:(r,g)=>g.c});
document.getElementById('chart-ratios').insertAdjacentHTML('afterbegin',`<div class="legend">${methods.map(m=>`<span><i style="background:${m.c}"></i>${m.name}</span>`).join('')}</div>`);
hbar(document.getElementById('chart-resolution'),site.charts.resolution.map(r=>({label:`face ${r.face_px} px wide`,v:r.err})),
  {groups:[{name:''}],value:r=>(Math.exp(r.v)-1)*100,fmt:v=>v.toFixed(0),unit:'%',colorFor:r=>r.label.includes('554')?'#1baf7a':'#2a78d6'});
document.getElementById('chart-resolution').insertAdjacentHTML('afterbegin','<p class="note">Nostril width ratio error from a frontal photo vs face size in pixels (2D, perfect geometry, 1.5 px click error)</p>');

// ---------- 3D ----------
const cache=new Map();
async function loadMesh(meta,extraDims){
  if(cache.has(meta.file)) return cache.get(meta.file);
  const buf=await (await fetch(meta.file)).arrayBuffer(); const n=meta.vertices; let o=0;
  const take=(T,count)=>{const a=new T(buf,o,count); o+=count*T.BYTES_PER_ELEMENT; return a};
  const pos=take(Float32Array,n*3), extra=meta.extra?take(Float32Array,n*meta.extra):null, uv=take(Float32Array,n*2), index=take(Uint32Array,meta.indices);
  const out={pos,extra,uv,index}; cache.set(meta.file,out); return out;
}
function makeGeometry(m){
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(m.pos.slice(),3));
  g.setAttribute('uv',new THREE.BufferAttribute(m.uv,2)); g.setIndex(new THREE.BufferAttribute(m.index,1)); g.computeVertexNormals(); return g;
}
function errorColors(err){ // 0 -> warm white, 5 mm -> deep red
  const stops=[[0,[.95,.94,.92]],[1.5,[.96,.78,.42]],[3,[.92,.41,.2]],[5,[.64,.09,.12]]], c=new Float32Array(err.length*3);
  err.forEach((e,i)=>{if(e<0){c[i*3]=.55;c[i*3+1]=.74;c[i*3+2]=.96;return} let k=1; while(k<stops.length-1&&e>stops[k][0]) k++; const [a,ca]=stops[k-1],[b,cb]=stops[k], t=Math.min(1,Math.max(0,(e-a)/(b-a)));
    for(let j=0;j<3;j++) c[i*3+j]=ca[j]+(cb[j]-ca[j])*t}); return c;
}
class Viewer{
  constructor(canvas,{autoRotate=false}={}){
    this.canvas=canvas; this.r=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true}); this.r.setPixelRatio(Math.min(2,devicePixelRatio));
    this.scene=new THREE.Scene(); this.cam=new THREE.PerspectiveCamera(30,1,.001,50);
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x3a3f46,1.1)); const d=new THREE.DirectionalLight(0xffffff,1.6); d.position.set(-.4,.6,1); this.scene.add(d);
    this.ctl=new OrbitControls(this.cam,canvas); this.ctl.enableDamping=true; this.ctl.rotateSpeed=.45; this.sway=autoRotate;
    // One-sided surfaces: keep the view within ~45 degrees of the photo's own viewpoint.
    this.ctl.minAzimuthAngle=-.8; this.ctl.maxAzimuthAngle=.8; this.ctl.minPolarAngle=Math.PI/2-.65; this.ctl.maxPolarAngle=Math.PI/2+.65;
    this.group=new THREE.Group(); this.scene.add(this.group); this.onFrame=null;
    new ResizeObserver(()=>this.resize()).observe(canvas); this.resize(); this.loop();
  }
  resize(){const w=this.canvas.clientWidth,h=this.canvas.clientHeight; if(!w||!h) return; this.r.setSize(w,h,false); this.cam.aspect=w/h; this.cam.updateProjectionMatrix()}
  loop(){requestAnimationFrame(()=>this.loop()); this.onFrame?.();
    if(this.sway&&this.radius){const a=.55*Math.sin(performance.now()/2600), t=this.ctl.target;  // gentle side-to-side sway
      this.cam.position.set(t.x+this.radius*Math.sin(a),t.y+this.radius*.12,t.z+this.radius*Math.cos(a)); this.cam.lookAt(t)}
    this.ctl.update(); this.r.render(this.scene,this.cam)}
  clear(){this.group.clear()}
  frame(obj,w,h,f,margin=1.12){ // camera at the photo's viewpoint (origin); fit the whole photo in this canvas
    const box=new THREE.Box3().setFromObject(obj), c=box.getCenter(new THREE.Vector3());
    const tv=Math.max(h/2/f,(w/2/f)/this.cam.aspect)*margin;
    this.cam.fov=2*Math.atan(tv)*180/Math.PI; this.cam.near=Math.max(1e-4,Math.abs(c.z)*.02); this.cam.far=Math.abs(c.z)*20; this.cam.position.set(0,0,0); this.cam.updateProjectionMatrix();
    this.ctl.target.copy(c); this.cam.lookAt(c); this.radius=c.length(); this.ctl.update();
  }
}

// ---------- hero: a clinic panel lifting into 3D ----------
const panels=site.clinic; const heroPanel=panels.find(p=>p.id==='sheet_06__p04')||panels[0];
const hero=new Viewer(document.getElementById('hero-canvas'),{autoRotate:true});
async function photoMesh(v,p){
  const m=await loadMesh(p.mesh); const g=makeGeometry(m); const tex=await new THREE.TextureLoader().loadAsync(p.image); tex.colorSpace=THREE.SRGBColorSpace;
  const mat=new THREE.MeshStandardMaterial({map:tex,roughness:.85,side:THREE.DoubleSide}); const mesh=new THREE.Mesh(g,mat); v.clear(); v.group.add(mesh);
  v.resize(); v.frame(mesh,p.size[0],p.size[1],p.focal_px); return {mesh,m,tex,mat};
}
function setMorph(o,t){const P=o.mesh.geometry.attributes.position.array; const a=o.m.extra,b=o.m.pos; for(let i=0;i<P.length;i++) P[i]=a[i]+(b[i]-a[i])*t;
  o.mesh.geometry.attributes.position.needsUpdate=true; o.mesh.geometry.computeVertexNormals(); o.mesh.geometry.computeBoundingSphere()}
const heroObj=await photoMesh(hero,heroPanel); const t0=performance.now();
hero.onFrame=()=>{const s=((performance.now()-t0)/1000)%8; const t=s<2?0:s<4.5?(s-2)/2.5:s<7?1:1-(s-7); setMorph(heroObj,t*t*(3-2*t))};

// ---------- truth comparison ----------
const truthV=new Viewer(document.getElementById('truth-canvas')); const sel=document.getElementById('truth-select');
site.validation.forEach((v,i)=>sel.add(new Option(`${SUBJECTS[v.subject]} · ${VIEWNAMES[v.view]}`,i)));
sel.value=String(site.validation.findIndex(v=>v.subject==='nih_left_ucl'&&v.view==='submental35'));
let truthMode='moge', truthObjs={};
const tm=document.getElementById('truth-mode'); [['truth','Truth'],['moge','MoGe-2'],['da3','DA3-Small'],['td','TrueDepth (sim.)'],['overlay','Overlay MoGe-2']].forEach(([k,l])=>{
  const b=document.createElement('button'); b.textContent=l; b.onclick=()=>{truthMode=k; applyTruth()}; b.dataset.k=k; tm.appendChild(b)});
function applyTruth(){
  tm.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.k===truthMode));
  for(const [k,o] of Object.entries(truthObjs)){
    o.visible= truthMode==='overlay' ? (k==='truth'||k==='moge') : k===truthMode;
    o.material.transparent=truthMode==='overlay'&&k==='truth'; o.material.opacity=truthMode==='overlay'&&k==='truth'?.35:1;
  }
}
async function showTruth(){
  const v=site.validation[+sel.value]; truthV.clear(); truthObjs={};
  for(const s of v.surfaces){
    const m=await loadMesh(s.mesh); const g=makeGeometry(m);
    const mat=s.key==='truth'?new THREE.MeshStandardMaterial({color:0x9fb3c8,roughness:.6,side:THREE.DoubleSide})
      :new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7,side:THREE.DoubleSide});
    if(s.key!=='truth') g.setAttribute('color',new THREE.BufferAttribute(errorColors(m.extra),3));
    const mesh=new THREE.Mesh(g,mat); truthObjs[s.key]=mesh; truthV.group.add(mesh);
  }
  truthV.resize(); truthV.frame(truthObjs.truth,1008*.42,1008*.42,1512); applyTruth();
  document.getElementById('truth-photo').src=v.photo;
  const rows=v.surfaces.filter(s=>s.key!=='truth');
  document.getElementById('truth-stats').innerHTML='<tr><th></th>'+rows.map(s=>`<th>${s.name}</th>`).join('')+'</tr>'
    +[['Shape error','shape_mm',' mm',1],['Surface tilt error','tilt_deg','°',0],['Offset (+ too flat)','offset_mm',' mm',1]]
      .map(([l,k,u,d])=>`<tr><td>${l}</td>${rows.map(s=>`<td class="num">${s[k]==null?'—':(k==='offset_mm'&&s[k]>0?'+':'')+s[k].toFixed(d)+u}</td>`).join('')}</tr>`).join('');
}
sel.onchange=showTruth; await showTruth();

// ---------- clinic viewer, morph and measurement ----------
const clinicV=new Viewer(document.getElementById('clinic-canvas')); let clinicObj=null, current=null, mode='photo';
const cm=document.getElementById('clinic-mode'); [['photo','Photo texture'],['clay','Clay shading']].forEach(([k,l])=>{const b=document.createElement('button'); b.textContent=l; b.dataset.k=k;
  b.onclick=()=>{mode=k; applyClinicMode()}; cm.appendChild(b)});
function applyClinicMode(){cm.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.k===mode)); if(!clinicObj) return;
  clinicObj.mat.map=mode==='photo'?clinicObj.tex:null; clinicObj.mat.color.set(mode==='photo'?0xffffff:0xd9cfc4); clinicObj.mat.needsUpdate=true}
const morph=document.getElementById('morph'); morph.oninput=()=>clinicObj&&setMorph(clinicObj,+morph.value);
const filters=['all',...new Set(panels.map(p=>p.label.replace('_penny','').replace('_taped','')))]; let filter='all';
const fEl=document.getElementById('filters'); filters.forEach(f=>{const b=document.createElement('button'); b.className='chip'; b.textContent=f==='all'?'All views':(LABELS[f]||f); b.dataset.f=f;
  b.onclick=()=>{filter=f; renderThumbs()}; fEl.appendChild(b)});
function renderThumbs(){fEl.querySelectorAll('.chip').forEach(b=>b.classList.toggle('on',b.dataset.f===filter));
  const el=document.getElementById('thumbs'); el.innerHTML='';
  panels.filter(p=>filter==='all'||p.label.startsWith(filter)).forEach(p=>{const b=document.createElement('button'); b.title=`${p.sheet.replace('sheet_','Sheet ')} · ${LABELS[p.label]||p.label}`;
    b.innerHTML=`<img src="${p.image}" alt="">`; b.classList.toggle('on',p===current); b.onclick=()=>openPanel(p); el.appendChild(b)})}
async function openPanel(p){current=p; clinicObj=await photoMesh(clinicV,p); setMorph(clinicObj,+morph.value); applyClinicMode(); renderThumbs(); resetMeasures()}

const MEASURES=[['dist','Distance'],['cw','Cleft nostril width'],['nw','Non-cleft nostril width'],['ch','Cleft nostril height'],['nh','Non-cleft nostril height']];
let mMode='dist', pending=[], results={}, distances=[]; const mm=document.getElementById('measure-mode'), hint=document.getElementById('measure-hint');
MEASURES.forEach(([k,l])=>{const b=document.createElement('button'); b.textContent=l; b.dataset.k=k; b.onclick=()=>{mMode=k; pending=[]; updateMeasureUI()}; mm.appendChild(b)});
document.getElementById('measure-clear').onclick=resetMeasures;
function resetMeasures(){results={}; distances=[]; pending=[]; clinicV.scene.children.filter(o=>o.userData.measure).forEach(o=>clinicV.scene.remove(o)); updateMeasureUI()}
function updateMeasureUI(){
  mm.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.k===mMode));
  hint.style.display='block'; hint.textContent=pending.length?'Click the second point':`Click two points: ${MEASURES.find(m=>m[0]===mMode)[1].toLowerCase()}`;
  const f=v=>v==null?'—':(v*1000).toFixed(1)+' mm', r=(a,b)=>a&&b?(a/b).toFixed(2):'—';
  document.getElementById('measure-table').innerHTML=`<tr><th>Measurement</th><th class="num">Value (model scale, unvalidated)</th></tr>`
    +MEASURES.slice(1).map(([k,l])=>`<tr><td>${l}</td><td class="num">${f(results[k])}</td></tr>`).join('')
    +`<tr><td><b>Width ratio</b> (cleft ÷ non-cleft)</td><td class="num"><b>${r(results.cw,results.nw)}</b></td></tr>`
    +`<tr><td><b>Height ratio</b></td><td class="num"><b>${r(results.ch,results.nh)}</b></td></tr>`
    +distances.map((d,i)=>`<tr><td>Distance ${i+1}</td><td class="num">${f(d)}</td></tr>`).join('');
}
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2(); let downAt=null;
const cc=document.getElementById('clinic-canvas');
cc.addEventListener('pointerdown',e=>downAt=[e.clientX,e.clientY]);
cc.addEventListener('pointerup',e=>{
  if(!clinicObj||!downAt||Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1])>4) return; // a drag orbits; a click measures
  if(+morph.value<.99){hint.textContent='Move the slider to 3D to measure'; return}
  const r=cc.getBoundingClientRect(); ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1); ray.setFromCamera(ndc,clinicV.cam);
  const hit=ray.intersectObject(clinicObj.mesh)[0]; if(!hit) return;
  const dot=new THREE.Mesh(new THREE.SphereGeometry(clinicV.cam.position.distanceTo(hit.point)*.006,16,12),new THREE.MeshBasicMaterial({color:0x1baf7a}));
  dot.position.copy(hit.point); dot.userData.measure=true; clinicV.scene.add(dot); pending.push(hit.point.clone());
  if(pending.length===2){
    const [a,b]=pending; const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineBasicMaterial({color:0x1baf7a,depthTest:false}));
    line.userData.measure=true; clinicV.scene.add(line); const d=a.distanceTo(b);
    if(mMode==='dist') distances.push(d); else results[mMode]=d; pending=[];
  }
  updateMeasureUI();
});
renderThumbs(); await openPanel(panels.find(p=>p.id==='sheet_03__p04')||panels[0]); applyClinicMode(); updateMeasureUI();

// ---------- same visit, two surfaces ----------
for(const [cid,id] of [['pair-a','sheet_03__p01'],['pair-b','sheet_03__p04']]){
  const p=panels.find(x=>x.id===id); if(!p) continue; const v=new Viewer(document.getElementById(cid));
  const o=await photoMesh(v,p); o.mat.map=null; o.mat.color.set(0xd9cfc4); o.mat.needsUpdate=true; setMorph(o,1);
  document.getElementById(cid+'-cap').textContent=`Same visit · ${LABELS[p.label]||p.label}`;
}

// ---------- capture speed ----------
{
  const speed=[['Clinical 3D camera',0.002],['DSLR flash photo',0.005],['TrueDepth frame',0.033],['TrueDepth 1-s burst',1],['Phone 360° head scan',15],['Photogrammetry',90]];
  const el=document.getElementById('chart-speed'), W=640, left=150, right=70, top=8, rowH=30, H=top+speed.length*rowH+26;
  const lo=Math.log10(0.001), hi=Math.log10(200), x=v=>left+(W-left-right)*(Math.log10(v)-lo)/(hi-lo);
  let s=`<svg viewBox="0 0 ${W} ${H}">`;
  [[0.001,'1 ms'],[0.01,'10 ms'],[0.1,'0.1 s'],[1,'1 s'],[10,'10 s'],[100,'100 s']].forEach(([v,l])=>{s+=`<g class="grid"><line x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${H-20}"/></g><text x="${x(v)}" y="${H-4}" text-anchor="middle">${l}</text>`});
  speed.forEach(([l,v],i)=>{const y=top+i*rowH+6, td=l.startsWith('TrueDepth'); const c=v<=1?(td?'#1baf7a':'#2a78d6'):'#d0472b';
    s+=`<text x="${left-10}" y="${y+12}" text-anchor="end">${l}</text><rect x="${left}" y="${y}" width="${Math.max(3,x(v)-left)}" height="16" rx="4" fill="${c}"/>`
      +`<text class="val" x="${x(v)+6}" y="${y+12}">${v<1?(v*1000).toFixed(0)+' ms':v+' s'}</text>`});
  el.innerHTML=s+`</svg><p class="note">Green and blue are fast enough to freeze an infant; red risks motion. Typical values.</p>`;
}

// ---------- TrueDepth preview: AI guess vs simulated TrueDepth ----------
{
  const tdA=new Viewer(document.getElementById('td-a')), tdB=new Viewer(document.getElementById('td-b')), ts=document.getElementById('td-select');
  const MODES=[['td_fused','Fused with MoGe-2'],['td_burst','1-s burst averaged'],['td','Single frame']]; let tdMode='td_fused';
  const seg=document.getElementById('td-mode'); MODES.forEach(([k,l])=>{const b=document.createElement('button'); b.textContent=l; b.dataset.k=k; b.onclick=()=>{tdMode=k; showTD()}; seg.appendChild(b)});
  site.validation.forEach((v,i)=>ts.add(new Option(`${SUBJECTS[v.subject]} · ${VIEWNAMES[v.view]}`,i)));
  ts.value=String(site.validation.findIndex(v=>v.subject==='nih_bilateral_cl'&&v.view==='submental35'));
  async function surfaceInto(viewer,s,ref){
    const m=await loadMesh(s.mesh); const g=makeGeometry(m); g.setAttribute('color',new THREE.BufferAttribute(errorColors(m.extra),3));
    viewer.clear(); viewer.group.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7,side:THREE.DoubleSide})));
    viewer.resize(); viewer.frame(ref,1008*.42,1008*.42,1512);
  }
  async function showTD(){
    seg.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.k===tdMode));
    const v=site.validation[+ts.value]; const ref=new THREE.Mesh(makeGeometry(await loadMesh(v.surfaces.find(s=>s.key==='truth').mesh)));
    const moge=v.surfaces.find(s=>s.key==='moge'), td=v.surfaces.find(s=>s.key===tdMode);
    document.getElementById('td-b-cap').textContent=`TrueDepth (simulated) · ${MODES.find(m=>m[0]===tdMode)[1]}`;
    await surfaceInto(tdA,moge,ref); await surfaceInto(tdB,td,ref);
    document.getElementById('td-stats').innerHTML=`<tr><th></th><th class="num">AI alone (MoGe-2)</th><th class="num">TrueDepth (sim.)</th></tr>`
      +`<tr><td>Nose shape error</td><td class="num">${moge.shape_mm.toFixed(2)} mm</td><td class="num">${td.shape_mm.toFixed(2)} mm*</td></tr>`
      +`<tr><td>Nose covered</td><td class="num">100%</td><td class="num">${td.coverage_pct.toFixed(0)}%</td></tr>`
      +(tdMode==='td_fused'?`<tr><td>Filled by AI (blue)</td><td class="num">—</td><td class="num">${td.filled_pct.toFixed(0)}%</td></tr>`:'')
      +`<tr><td colspan="3" class="note">*From an assumed sensor model (0.5 mm random noise, perfect calibration). Real captures will be worse; the pilot will measure it.</td></tr>`;
  }
  ts.onchange=showTD; await showTD();
}

// ---------- simulated photo-coach screens ----------
fetch('coach/coach_sim.json').then(r=>r.json()).then(rows=>{
  const el=document.getElementById('coach-strip'); if(!el) return;
  el.innerHTML=rows.map((r,i)=>`<figure class="coach-shot"><img src="coach/${r.image}" alt="${r.caption}" loading="lazy">
    <figcaption><b>${i+1}.</b> ${r.caption}</figcaption></figure>`).join('');
}).catch(()=>{});
