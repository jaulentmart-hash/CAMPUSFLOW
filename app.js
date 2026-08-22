// CampusFlow V2 — front-end local, prêt pour migration Supabase
let DATA = { opportunities: [], deadlines: [], establishments: [], formations: [], sources: [] };
let PROFILE = loadProfile();
let COMPLETED = loadCompleted();
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function defaultProfile(){ return { ville:"", villeResidence:"", age:"", niveau:"", boursier:"non", alternant:"non", etablissement:"", formation:"", logement:"", transport:"", qf:"" }; }
function loadProfile(){ try { return {...defaultProfile(), ...(JSON.parse(localStorage.getItem('campusflow_profile'))||{})}; } catch { return defaultProfile(); } }
function saveProfile(){ localStorage.setItem('campusflow_profile', JSON.stringify(PROFILE)); }
function loadCompleted(){ try { return JSON.parse(localStorage.getItem('campusflow_completed')) || []; } catch { return []; } }
function saveCompleted(){ localStorage.setItem('campusflow_completed', JSON.stringify(COMPLETED)); }

const FALLBACK_CITIES = ['Paris','Lyon','Lille','Bordeaux','Toulouse','Grenoble'];

fetch('data.json?v=2.1')
  .then(r=>{ if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
  .then(json=>{ DATA={...DATA,...json}; init(); })
  .catch(err=>{
    console.error('CampusFlow data loading error', err);
    // L'interface reste utilisable : les villes de lancement sont disponibles en secours.
    init();
    $('#opp-list').innerHTML='<div class="empty-state">La base distante n’a pas pu être chargée. Réessaie en actualisant la page.</div>';
  });

function init(){ renderProfileForm(); renderIdCard(); renderFilters(); renderOpportunities(); renderDeadlines(); renderHome(); bindNav(); bindSheet(); }

function isNational(o){ return (o.perimetre||'').toLowerCase()==='national'; }
function opportunityMatchesProfile(o){
  if (isNational(o)) return true;
  if (!PROFILE.ville) return true;
  return (o.ville||'')===PROFILE.ville;
}
function opportunityIsCompatible(o){
  if (!opportunityMatchesProfile(o)) return false;
  if ((o.boursier_requis||'').toLowerCase()==='oui' && PROFILE.boursier!=='oui') return false;
  if ((o.alternant_requis||'').toLowerCase()==='oui' && PROFILE.alternant!=='oui') return false;
  if (o.age_max && PROFILE.age && Number(PROFILE.age)>Number(o.age_max)) return false;
  return true;
}
function confidence(o){
  let known=0, checks=0;
  if (o.age_max){ checks++; if(PROFILE.age) known++; }
  if ((o.boursier_requis||'').toLowerCase()==='oui'){ checks++; known++; }
  if ((o.alternant_requis||'').toLowerCase()==='oui'){ checks++; known++; }
  if (!isNational(o)){ checks++; if(PROFILE.ville) known++; }
  if (!checks) return 'À vérifier';
  return known===checks ? 'Profil compatible' : 'À vérifier';
}

function financialClass(o){
  if (o.financial_class) return o.financial_class;
  const t=(o.type||'').toLowerCase();
  const c=(o.categorie||'').toLowerCase();
  if (t.includes('prêt')) return 'financing';
  if (t.includes('aide financière') || t.includes('remboursement') || t.includes('exonération') || c.includes("aide d'urgence")) return 'aid';
  if (t.includes('tarif') || t.includes('réduction') || t.includes('gratuité') || t.includes('abonnement') || t.includes('carnet') || t.includes('crédit numérique')) return 'benefit';
  return 'service';
}
function amountMax(o){ return Number(o.montant_max_eur)||Number(o.montant_min_eur)||0; }
function annualPotential(o){
  if (financialClass(o)!=='aid') return 0;
  const v=amountMax(o); if(!v) return 0;
  const f=(o.frequence||'').toLowerCase();
  if (f.includes('mensuel')) return v*12;
  return v;
}
function euro(n){ return `${Math.round(n).toLocaleString('fr-FR')} €`; }
function financialSummary(list){
  const aids=list.reduce((s,o)=>s+annualPotential(o),0);
  const financing=list.filter(o=>financialClass(o)==='financing').reduce((m,o)=>Math.max(m,amountMax(o)),0);
  const benefits=list.filter(o=>['benefit','cost','saving'].includes(financialClass(o))).length;
  return {aids, financing, benefits};
}

function renderIdCard(){
  $('#id-name').textContent=PROFILE.ville?`Étudiant·e à ${PROFILE.ville}`:'Configure ton profil';
  const pills=[]; if(PROFILE.niveau)pills.push(PROFILE.niveau); if(PROFILE.boursier==='oui')pills.push('Boursier·ère'); if(PROFILE.alternant==='oui')pills.push('Alternant·e'); if(PROFILE.age)pills.push(`${PROFILE.age} ans`);
  $('#id-pills').innerHTML=pills.length?pills.map(x=>`<span class="pill">${escapeHtml(x)}</span>`).join(''):'<span class="pill">Profil à compléter</span>';
}
function renderHome(){
  const compatible=DATA.opportunities.filter(opportunityIsCompatible);
  const s=financialSummary(compatible);
  $('#savings-amount').textContent=euro(s.aids);
  $('#savings-count').textContent=`jusqu’à ${compatible.filter(o=>financialClass(o)==='aid').length} aide(s) financière(s) compatible(s)`;
  $('#benefit-count').textContent=`${s.benefits} avantage(s) tarifaire(s)`;
  $('#financing-amount').textContent=s.financing?`Financement accessible jusqu’à ${euro(s.financing)}`:'Aucun financement spécifique détecté';
  const dls=relevantDeadlines();
  const homeDl=$('#home-deadlines'); homeDl.innerHTML='';
  if(!dls.length) homeDl.innerHTML='<div class="empty-state compact">Aucune échéance pertinente à venir.</div>';
  dls.slice(0,3).forEach(d=>homeDl.appendChild(deadlineRow(d)));
  const homeOpp=$('#home-opportunities'); homeOpp.innerHTML='';
  compatible.sort((a,b)=>scoreOpportunity(b)-scoreOpportunity(a)).slice(0,4).forEach(o=>homeOpp.appendChild(opportunityCard(o)));
}
function scoreOpportunity(o){ return (financialClass(o)==='aid'?30:0) + (confidence(o)==='Profil compatible'?20:0) + (isNational(o)?0:10) + ((o.statut_verification||'').includes('🟢')?5:0); }

let activeVille='Toutes', activeCategorie='Toutes', activeType='Toutes';
function renderFilters(){
  makeChips('#filter-ville',['Toutes',...new Set(DATA.opportunities.map(o=>o.ville).filter(Boolean))],activeVille,v=>{activeVille=v;renderFilters();renderOpportunities();});
  makeChips('#filter-categorie',['Toutes',...new Set(DATA.opportunities.map(o=>o.categorie).filter(Boolean))],activeCategorie,v=>{activeCategorie=v;renderFilters();renderOpportunities();});
  makeChips('#filter-type',['Toutes','Aides','Avantages','Financements','Services'],activeType,v=>{activeType=v;renderFilters();renderOpportunities();});
}
function makeChips(sel,items,active,cb){ const el=$(sel); el.innerHTML=''; items.forEach(v=>{ const c=document.createElement('button'); c.className='chip'+(v===active?' active':''); c.textContent=v; c.onclick=()=>cb(v); el.appendChild(c); }); }
function typeMatches(o){ const fc=financialClass(o); if(activeType==='Toutes')return true; if(activeType==='Aides')return fc==='aid'; if(activeType==='Avantages')return ['benefit','cost','saving'].includes(fc); if(activeType==='Financements')return fc==='financing'; return fc==='service'; }
function renderOpportunities(){
  const list=$('#opp-list'); list.innerHTML=''; let items=DATA.opportunities.slice();
  if(activeVille!=='Toutes')items=items.filter(o=>o.ville===activeVille||isNational(o));
  if(activeCategorie!=='Toutes')items=items.filter(o=>o.categorie===activeCategorie);
  items=items.filter(typeMatches).sort((a,b)=>scoreOpportunity(b)-scoreOpportunity(a));
  if(!items.length){list.innerHTML='<div class="empty-state">Aucune opportunité pour ces filtres.</div>';return;}
  items.forEach(o=>list.appendChild(opportunityCard(o)));
}
function displayAmount(o){
  const v=amountMax(o), fc=financialClass(o), f=(o.frequence||'').toLowerCase(); if(!v)return '';
  if(fc==='financing')return `jusqu’à ${euro(v)}`;
  if(fc==='aid')return f.includes('mensuel')?`jusqu’à ${euro(v)}/mois`:`jusqu’à ${euro(v)}`;
  return `tarif ${euro(v)}`;
}
function opportunityCard(o){
  const card=document.createElement('div'); card.className='card'; const comp=opportunityIsCompatible(o); const conf=confidence(o);
  card.innerHTML=`<div class="card-top"><div class="card-title">${escapeHtml(o.nom||'')}</div><div class="card-amount">${escapeHtml(displayAmount(o))}</div></div>
  <div class="card-meta"><span class="tag">${escapeHtml(o.categorie||'')}</span><span class="tag">${escapeHtml(o.ville||'National')}</span><span class="tag ${comp?'status-green':'status-orange'}">${comp?conf:'Hors profil actuel'}</span></div>
  <div class="card-desc">${escapeHtml((o.description_courte||'').slice(0,130))}${(o.description_courte||'').length>130?'…':''}</div>`;
  card.onclick=()=>openOpportunitySheet(o); return card;
}
function openOpportunitySheet(o){
  const official=(o.statut_verification||'').includes('🟢')?'Source vérifiée':'À revérifier';
  $('#sheet-content').innerHTML=`<h2>${escapeHtml(o.nom||'')}</h2><div class="card-amount">${escapeHtml(displayAmount(o))}</div>
  <p class="sheet-copy">${escapeHtml(o.description_courte||'')}</p>
  <div class="eligibility-note">${opportunityIsCompatible(o)?'Ton profil semble compatible — vérifie les conditions officielles.':'Cette opportunité ne correspond pas complètement aux informations de ton profil.'}</div>
  <div class="sheet-row"><span class="k">Type</span><span class="v">${labelFinancialClass(o)}</span></div>
  <div class="sheet-row"><span class="k">Critères</span><span class="v">${escapeHtml(o.autres_criteres||'À vérifier')}</span></div>
  <div class="sheet-row"><span class="k">Fréquence</span><span class="v">${escapeHtml(o.frequence||'—')}</span></div>
  <div class="sheet-row"><span class="k">Vérification</span><span class="v">${escapeHtml(official)} · ${escapeHtml(o.date_derniere_verif||'date inconnue')}</span></div>
  ${o.date_limite_2026_2027?`<div class="sheet-row"><span class="k">Échéance</span><span class="v">${escapeHtml(o.date_limite_2026_2027)}</span></div>`:''}
  ${o.lien_source_officielle?`<a class="sheet-link" href="${escapeHtml(o.lien_source_officielle)}" target="_blank" rel="noopener">Vérifier sur la source officielle →</a>`:''}`;
  $('#sheet-overlay').classList.add('open');
}
function labelFinancialClass(o){ return ({aid:'Aide / exonération',benefit:'Avantage tarifaire',cost:'Tarif préférentiel',saving:'Économie variable',financing:'Financement',service:'Service'})[financialClass(o)]||'Service'; }

function parseDeadlineDate(d){ const raw=d.date_fin||d.date_debut; if(!raw)return null; const x=new Date(raw+'T12:00:00'); return isNaN(x)?null:x; }
function relevantDeadlines(){ const now=new Date(); return DATA.deadlines.filter(d=>{
  const loc=(d.ville_ou_perimetre||''); const relevant=loc==='France entière'||!PROFILE.ville||loc===PROFILE.ville; const dt=parseDeadlineDate(d); return relevant && (!dt || dt >= new Date(now.getTime()-86400000));
 }).sort((a,b)=>(parseDeadlineDate(a)||new Date('2999-01-01'))-(parseDeadlineDate(b)||new Date('2999-01-01'))); }
function urgencyBucket(d){ const dt=parseDeadlineDate(d); if(!dt)return'green'; const days=(dt-new Date())/86400000; if(days<=14)return'red'; if(days<=60)return'orange'; return'green'; }
function deadlineRow(d){
 const row=document.createElement('div'); row.className='deadline-row'+(COMPLETED.includes(d.id)?' completed':''); const date=d.date_fin||d.date_debut||'date à confirmer';
 row.innerHTML=`<button class="task-check" aria-label="Terminer">${COMPLETED.includes(d.id)?'✓':''}</button><div class="urgency-dot ${urgencyBucket(d)}"></div><div class="deadline-copy"><div class="deadline-title">${escapeHtml(d.titre||'')}</div><div class="deadline-date">${escapeHtml(date)} · ${escapeHtml(d.ville_ou_perimetre||'')}</div></div>`;
 row.querySelector('.task-check').onclick=(e)=>{e.stopPropagation(); toggleCompleted(d.id);}; return row;
}
function toggleCompleted(id){ COMPLETED=COMPLETED.includes(id)?COMPLETED.filter(x=>x!==id):[...COMPLETED,id]; saveCompleted(); renderDeadlines(); renderHome(); }
function renderDeadlines(){ const buckets={red:[],orange:[],green:[]}; relevantDeadlines().forEach(d=>buckets[urgencyBucket(d)].push(d)); ['red','orange','green'].forEach(k=>{const el=$(`#deadlines-${k}`);el.innerHTML='';if(!buckets[k].length)el.innerHTML='<div class="empty-state compact">Rien ici.</div>';buckets[k].forEach(d=>el.appendChild(deadlineRow(d)));}); }

function renderProfileForm(){
 const dataCities=[...new Set([
   ...DATA.opportunities.map(o=>o.ville),
   ...DATA.establishments.map(e=>e.ville)
 ].filter(Boolean))];
 const cities=[...new Set([...FALLBACK_CITIES,...dataCities])].sort((a,b)=>a.localeCompare(b,'fr'));
 $('#f-ville').innerHTML='<option value="">Choisir une ville</option>'+cities.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
 $('#f-ville').value=PROFILE.ville||''; $('#f-ville-residence').value=PROFILE.villeResidence||''; $('#f-age').value=PROFILE.age||''; $('#f-niveau').value=PROFILE.niveau||''; $('#f-logement').value=PROFILE.logement||''; $('#f-transport').value=PROFILE.transport||''; $('#f-qf').value=PROFILE.qf||'';
 updateEstablishments();
 $('#f-ville').onchange=()=>{ PROFILE.ville=$('#f-ville').value; updateEstablishments(); };
 $('#f-etablissement').onchange=()=>{ PROFILE.etablissement=$('#f-etablissement').value; updateFormations(); };
 $$('.toggle-btn').forEach(btn=>{const field=btn.dataset.field,value=btn.dataset.value;btn.classList.toggle('active',PROFILE[field]===value);btn.onclick=()=>{PROFILE[field]=value;$$(`.toggle-btn[data-field="${field}"]`).forEach(b=>b.classList.toggle('active',b===btn));};});
 $('#save-profile').onclick=()=>{PROFILE.ville=$('#f-ville').value;PROFILE.villeResidence=$('#f-ville-residence').value;PROFILE.age=$('#f-age').value;PROFILE.niveau=$('#f-niveau').value;PROFILE.logement=$('#f-logement').value;PROFILE.transport=$('#f-transport').value;PROFILE.qf=$('#f-qf').value;PROFILE.etablissement=$('#f-etablissement').value;PROFILE.formation=$('#f-formation').value;saveProfile();renderIdCard();renderHome();renderDeadlines();navigateTo('accueil');};
}
function updateEstablishments(){ const list=DATA.establishments.filter(e=>!PROFILE.ville||e.ville===PROFILE.ville); $('#f-etablissement').innerHTML='<option value="">Choisir (optionnel)</option>'+list.map(e=>`<option value="${e.id}">${escapeHtml(e.nom)}</option>`).join(''); if(list.some(e=>e.id===PROFILE.etablissement))$('#f-etablissement').value=PROFILE.etablissement; else PROFILE.etablissement=''; updateFormations(); }
function updateFormations(){ const list=DATA.formations.filter(f=>f.etablissement_id===PROFILE.etablissement); $('#f-formation').innerHTML='<option value="">Choisir (optionnel)</option>'+list.map(f=>`<option value="${f.id}">${escapeHtml(f.nom)}</option>`).join(''); if(list.some(f=>f.id===PROFILE.formation))$('#f-formation').value=PROFILE.formation; else PROFILE.formation=''; }

function bindNav(){ $$('[data-nav]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();navigateTo(el.dataset.nav);})); }
function navigateTo(page){ $$('.page').forEach(p=>p.classList.remove('active')); $(`#page-${page}`)?.classList.add('active'); $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.nav===page)); window.scrollTo(0,0); }
function bindSheet(){ const overlay=$('#sheet-overlay'); overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.classList.remove('open');}); }
function escapeHtml(str){ return String(str??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
