// CampusFlow V3 — interface inspirée du prototype Glide, moteur local
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

fetch('data.json?v=3.7')
  .then(r=>{ if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
  .then(json=>{ DATA={...DATA,...json}; init(); })
  .catch(err=>{
    console.error('CampusFlow data loading error', err);
    // L'interface reste utilisable : les villes de lancement sont disponibles en secours.
    init();
    $('#opp-list').innerHTML='<div class="empty-state">La base distante n’a pas pu être chargée. Réessaie en actualisant la page.</div>';
  });

function init(){ renderProfileForm(); renderIdCard(); renderFilters(); renderOpportunities(); renderDeadlines(); renderHome(); bindNav(); bindSheet(); const search=$('#opp-search'); if(search) search.addEventListener('input',renderOpportunities); }

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
  if (o.age_min && PROFILE.age && Number(PROFILE.age)<Number(o.age_min)) return false;
  if (o.age_max && PROFILE.age && Number(PROFILE.age)>Number(o.age_max)) return false;
  if (o.qf_max && PROFILE.qf && Number(PROFILE.qf)>Number(o.qf_max)) return false;
  if (o.residence_requise && PROFILE.villeResidence && PROFILE.villeResidence!==o.residence_requise) return false;
  if (o.etablissements_requis?.length && PROFILE.etablissement && !o.etablissements_requis.includes(PROFILE.etablissement)) return false;
  if (o.formations_requises?.length && PROFILE.formation && !o.formations_requises.includes(PROFILE.formation)) return false;
  if (o.niveaux_requis?.length && PROFILE.niveau && !o.niveaux_requis.includes(PROFILE.niveau)) return false;
  if (o.logements_compatibles?.length && PROFILE.logement && !o.logements_compatibles.includes(PROFILE.logement)) return false;
  return true;
}
function confidence(o){
  let known=0, checks=0;
  if (o.age_min || o.age_max){ checks++; if(PROFILE.age) known++; }
  if (o.qf_max){ checks++; if(PROFILE.qf) known++; }
  if (o.residence_requise){ checks++; if(PROFILE.villeResidence) known++; }
  if (o.etablissements_requis?.length){ checks++; if(PROFILE.etablissement) known++; }
  if (o.formations_requises?.length){ checks++; if(PROFILE.formation) known++; }
  if (o.niveaux_requis?.length){ checks++; if(PROFILE.niveau) known++; }
  if (o.logements_compatibles?.length){ checks++; if(PROFILE.logement) known++; }
  if ((o.boursier_requis||'').toLowerCase()==='oui'){ checks++; known++; }
  if ((o.alternant_requis||'').toLowerCase()==='oui'){ checks++; known++; }
  if (!isNational(o)){ checks++; if(PROFILE.ville) known++; }
  if (!checks) return 'À vérifier';
  return known===checks ? 'Profil compatible' : 'À vérifier';
}
function matchingReasons(o){
  const r=[];
  if(!isNational(o) && PROFILE.ville===o.ville) r.push(`Études à ${PROFILE.ville}`);
  if(o.etablissements_requis?.includes(PROFILE.etablissement)) r.push('Ton établissement');
  if(o.formations_requises?.includes(PROFILE.formation)) r.push('Ta formation');
  if(o.niveaux_requis?.includes(PROFILE.niveau)) r.push(`Niveau ${PROFILE.niveau}`);
  if((o.boursier_requis||'').toLowerCase()==='oui' && PROFILE.boursier==='oui') r.push('Statut boursier');
  if((o.alternant_requis||'').toLowerCase()==='oui' && PROFILE.alternant==='oui') r.push('Statut alternant');
  if((o.age_min||o.age_max) && PROFILE.age) r.push(`${PROFILE.age} ans`);
  if(o.qf_max && PROFILE.qf) r.push(`QF ${PROFILE.qf} €`);
  if(o.logements_compatibles?.includes(PROFILE.logement) && PROFILE.logement) r.push('Situation logement');
  if(isNational(o)) r.push('Dispositif national');
  return r.slice(0,4);
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
function amountMin(o){ return Number(o.montant_min_eur)||0; }
function annualize(v,o){
  if(!v) return 0;
  const f=(o.frequence||'').toLowerCase();
  if(f.includes('mensuel')) return v*12;
  return v;
}
function isCashAid(o){
  const t=(o.type||'').toLowerCase();
  return financialClass(o)==='aid' && (t.includes('aide financière') || t.includes('subvention') || t.includes('allocation') || t.includes('crédit numérique'));
}
function isDirectSaving(o){
  const t=(o.type||'').toLowerCase();
  return t.includes('exonération') || t.includes('remboursement');
}
function potentialAid(o){
  if(financialClass(o)!=='aid') return 0;
  return annualize(amountMax(o),o);
}
function directSaving(o){
  if(!isDirectSaving(o)) return Number(o.economie_estimee_eur)||0;
  return annualize(amountMax(o),o);
}
function euro(n){ return `${Math.round(n).toLocaleString('fr-FR')} €`; }
function isEmergencyAid(o){ return /FNAU|urgence/i.test(`${o.nom||''} ${o.categorie||''}`); }
function isRegularGrant(o){ return /Bourse CROUS sur critères sociaux/i.test(o.nom||''); }
function isAnnualEmergency(o){ return /FNAU.*annuelle/i.test(o.nom||''); }
function isHousingAid(o){ return /APL|ALS|ALF/i.test(o.nom||''); }
function financialSummary(list){
  const aidItems=list.filter(o=>financialClass(o)==='aid');
  const regular=aidItems.filter(o=>!isEmergencyAid(o));
  const emergency=aidItems.filter(isEmergencyAid);
  // Ne jamais additionner automatiquement des aides incompatibles ou conditionnelles.
  // On affiche plutôt le meilleur montant d'aide régulière et les cas exceptionnels séparément.
  const primaryAid=regular.sort((a,b)=>potentialAid(b)-potentialAid(a))[0] || null;
  const primaryAidAmount=primaryAid ? potentialAid(primaryAid) : 0;
  const savings=list.reduce((s,o)=>s+directSaving(o),0);
  const financing=list.filter(o=>financialClass(o)==='financing').reduce((m,o)=>Math.max(m,amountMax(o)),0);
  const benefitItems=list.filter(o=>['benefit','cost','saving'].includes(financialClass(o)));
  const services=list.filter(o=>financialClass(o)==='service');
  const needsCheck=list.filter(o=>confidence(o)!=='Profil compatible');
  return {primaryAid,primaryAidAmount,emergencyCount:emergency.length,savings,financing,aidCount:aidItems.length,benefitCount:benefitItems.length,serviceCount:services.length,checkCount:needsCheck.length,total:list.length};
}
function renderIdCard(){
  $('#id-name').textContent=PROFILE.ville?`Étudiant·e à ${PROFILE.ville}`:'Configure ton profil';
  const pills=[]; if(PROFILE.niveau)pills.push(PROFILE.niveau); if(PROFILE.boursier==='oui')pills.push('Boursier·ère'); if(PROFILE.alternant==='oui')pills.push('Alternant·e'); if(PROFILE.age)pills.push(`${PROFILE.age} ans`);
  $('#id-pills').innerHTML=pills.length?pills.map(x=>`<span class="pill">${escapeHtml(x)}</span>`).join(''):'<span class="pill">Profil à compléter</span>';
}
function renderHome(){
  const compatible=DATA.opportunities.filter(opportunityIsCompatible);
  const s=financialSummary(compatible);
  $('#savings-amount').textContent=s.aidCount?`${s.aidCount} aide${s.aidCount>1?'s':''} à étudier`:'Aucune aide détectée';
  const mainAid=s.primaryAid ? `${s.primaryAid.nom} : jusqu’à ${euro(s.primaryAidAmount)}` : 'Aucune aide régulière chiffrée';
  const emergency=s.emergencyCount ? ` · ${s.emergencyCount} aide${s.emergencyCount>1?'s':''} exceptionnelle${s.emergencyCount>1?'s':''} selon situation` : '';
  $('#savings-count').textContent=`${mainAid}${emergency}. Les montants incompatibles ne sont jamais additionnés.`;
  $('#benefit-amount').textContent=s.savings?euro(s.savings):'Non chiffré';
  $('#financing-amount').textContent=s.financing?`Jusqu’à ${euro(s.financing)}`:'Aucun';
  $('#opportunity-count').textContent=String(s.total);
  $('#summary-aids').textContent=String(s.aidCount);
  $('#summary-benefits').textContent=String(s.benefitCount);
  $('#summary-services').textContent=String(s.serviceCount);
  $('#summary-check').textContent=String(s.checkCount);
  const title=$('#welcome-title');
  const sub=$('#welcome-subtitle');
  if(title) title.textContent=PROFILE.ville?`Bonjour 👋`:'Bienvenue sur CampusFlow 👋';
  if(sub) sub.textContent=PROFILE.ville?`Ton tableau de bord étudiant pour ${PROFILE.ville}.`:'Complète ton profil pour personnaliser les aides et les échéances.';
  const coverage=$('#coverage-note');
  if(coverage){
    const localCount=DATA.opportunities.filter(o=>o.ville===PROFILE.ville).length;
    coverage.hidden=!PROFILE.ville;
    if(PROFILE.ville) coverage.innerHTML=`<strong>${localCount} dispositifs locaux</strong> référencés à ${escapeHtml(PROFILE.ville)} · matching national + local + établissement${PROFILE.formation?' + formation':''}`;
  }
  const dls=relevantDeadlines();
  const homeDl=$('#home-deadlines'); homeDl.innerHTML='';
  if(!dls.length) homeDl.innerHTML='<div class="empty-state compact">Aucune échéance pertinente à venir.</div>';
  dls.slice(0,4).forEach(d=>homeDl.appendChild(deadlineRow(d)));
  const homeOpp=$('#home-opportunities'); homeOpp.innerHTML='';
  if(!compatible.length) homeOpp.innerHTML='<div class="empty-state compact">Complète ton profil pour obtenir des recommandations.</div>';
  compatible.sort((a,b)=>scoreOpportunity(b)-scoreOpportunity(a)).slice(0,4).forEach(o=>homeOpp.appendChild(opportunityCard(o)));
}
function scoreOpportunity(o){ return (financialClass(o)==='aid'?30:0) + (confidence(o)==='Profil compatible'?20:0) + (isNational(o)?0:15) + (o.formations_requises?.includes(PROFILE.formation)?30:0) + (o.etablissements_requis?.includes(PROFILE.etablissement)?20:0) + ((o.statut_verification||'').includes('🟢')?5:0); }

let activeVille='Toutes', activeCategorie='Toutes', activeType='Toutes', activeProfile='Mon profil';
function renderFilters(){
  makeChips('#filter-profile',['Mon profil','Tout explorer'],activeProfile,v=>{activeProfile=v;renderFilters();renderOpportunities();});
  makeChips('#filter-ville',['Toutes',...new Set(DATA.opportunities.map(o=>o.ville).filter(Boolean))],activeVille,v=>{activeVille=v;activeProfile='Tout explorer';renderFilters();renderOpportunities();});
  makeChips('#filter-categorie',['Toutes',...new Set(DATA.opportunities.map(o=>o.categorie).filter(Boolean))],activeCategorie,v=>{activeCategorie=v;renderFilters();renderOpportunities();});
  makeChips('#filter-type',['Toutes','Aides','Avantages','Financements','Services'],activeType,v=>{activeType=v;renderFilters();renderOpportunities();});
}
function makeChips(sel,items,active,cb){ const el=$(sel); el.innerHTML=''; items.forEach(v=>{ const c=document.createElement('button'); c.className='chip'+(v===active?' active':''); c.textContent=v; c.onclick=()=>cb(v); el.appendChild(c); }); }
function typeMatches(o){ const fc=financialClass(o); if(activeType==='Toutes')return true; if(activeType==='Aides')return fc==='aid'; if(activeType==='Avantages')return ['benefit','cost','saving'].includes(fc); if(activeType==='Financements')return fc==='financing'; return fc==='service'; }
function renderOpportunities(){
  const list=$('#opp-list'); list.innerHTML=''; let items=DATA.opportunities.slice();
  if(activeProfile==='Mon profil') items=items.filter(opportunityIsCompatible);
  else if(activeVille!=='Toutes')items=items.filter(o=>o.ville===activeVille||isNational(o));
  if(activeCategorie!=='Toutes')items=items.filter(o=>o.categorie===activeCategorie);
  items=items.filter(typeMatches);
  const q=($('#opp-search')?.value||'').trim().toLowerCase();
  if(q) items=items.filter(o=>`${o.nom||''} ${o.description_courte||''} ${o.categorie||''} ${o.ville||''}`.toLowerCase().includes(q));
  items.sort((a,b)=>scoreOpportunity(b)-scoreOpportunity(a));
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
  const reasons=matchingReasons(o);
  $('#sheet-content').innerHTML=`<h2>${escapeHtml(o.nom||'')}</h2><div class="card-amount">${escapeHtml(displayAmount(o))}</div>
  <p class="sheet-copy">${escapeHtml(o.description_courte||'')}</p>
  <div class="eligibility-note">${opportunityIsCompatible(o)?'Ton profil semble compatible — vérifie les conditions officielles.':'Cette opportunité ne correspond pas complètement aux informations de ton profil.'}${reasons.length?`<div class="reason-list">${reasons.map(r=>`<span>${escapeHtml(r)}</span>`).join('')}</div>`:''}</div>
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
function deadlineMatchesProfile(d){
  const loc=(d.ville_ou_perimetre||'');
  if(!(loc==='France entière'||!PROFILE.ville||loc===PROFILE.ville)) return false;
  if(d.etablissements_requis?.length){ if(!PROFILE.etablissement || !d.etablissements_requis.includes(PROFILE.etablissement)) return false; }
  if(d.formations_requises?.length){ if(!PROFILE.formation || !d.formations_requises.includes(PROFILE.formation)) return false; }
  if(d.niveaux_requis?.length){ if(!PROFILE.niveau || !d.niveaux_requis.includes(PROFILE.niveau)) return false; }
  if(d.logements_requis?.length){ if(!PROFILE.logement || !d.logements_requis.includes(PROFILE.logement)) return false; }
  return true;
}
function relevantDeadlines(){ const now=new Date(); return DATA.deadlines.filter(d=>{
  const dt=parseDeadlineDate(d); return deadlineMatchesProfile(d) && (!dt || dt >= new Date(now.getTime()-86400000));
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
 $('#f-ville').onchange=()=>{ PROFILE.ville=$('#f-ville').value; updateEstablishments(); }; $('#f-niveau').onchange=()=>{ PROFILE.niveau=$('#f-niveau').value; };
 $('#f-etablissement').onchange=()=>{ PROFILE.etablissement=$('#f-etablissement').value; PROFILE.formation=''; updateFormations(); }; $('#f-formation').onchange=()=>{ PROFILE.formation=$('#f-formation').value; const f=DATA.formations.find(x=>x.id===PROFILE.formation); if(f?.niveau){ PROFILE.niveau=f.niveau; $('#f-niveau').value=f.niveau; } };
 $$('.toggle-btn').forEach(btn=>{const field=btn.dataset.field,value=btn.dataset.value;btn.classList.toggle('active',PROFILE[field]===value);btn.onclick=()=>{PROFILE[field]=value;$$(`.toggle-btn[data-field="${field}"]`).forEach(b=>b.classList.toggle('active',b===btn));};});
 $('#save-profile').onclick=()=>{PROFILE.ville=$('#f-ville').value;PROFILE.villeResidence=$('#f-ville-residence').value;PROFILE.age=$('#f-age').value;PROFILE.niveau=$('#f-niveau').value;PROFILE.logement=$('#f-logement').value;PROFILE.transport=$('#f-transport').value;PROFILE.qf=$('#f-qf').value;PROFILE.etablissement=$('#f-etablissement').value;PROFILE.formation=$('#f-formation').value;saveProfile();renderIdCard();renderHome();renderDeadlines();navigateTo('accueil');};
}
function updateEstablishments(){ const list=DATA.establishments.filter(e=>!PROFILE.ville||e.ville===PROFILE.ville); $('#f-etablissement').innerHTML='<option value="">Choisir (optionnel)</option>'+list.map(e=>`<option value="${e.id}">${escapeHtml(e.nom)}</option>`).join(''); if(list.some(e=>e.id===PROFILE.etablissement))$('#f-etablissement').value=PROFILE.etablissement; else PROFILE.etablissement=''; updateFormations(); }
function updateFormations(){ let list=DATA.formations.filter(f=>f.etablissement_id===PROFILE.etablissement); list.sort((a,b)=>(a.nom||'').localeCompare(b.nom||'','fr')); $('#f-formation').innerHTML='<option value="">Choisir une formation</option>'+list.map(f=>`<option value="${f.id}">${escapeHtml(f.nom)}</option>`).join(''); if(list.some(f=>f.id===PROFILE.formation)){ $('#f-formation').value=PROFILE.formation; const selected=list.find(f=>f.id===PROFILE.formation); if(selected?.niveau){ PROFILE.niveau=selected.niveau; $('#f-niveau').value=selected.niveau; } } else PROFILE.formation=''; }

function bindNav(){ $$('[data-nav]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();navigateTo(el.dataset.nav);})); }
function navigateTo(page){ $$('.page').forEach(p=>p.classList.remove('active')); $(`#page-${page}`)?.classList.add('active'); $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.nav===page)); window.scrollTo(0,0); }
function bindSheet(){ const overlay=$('#sheet-overlay'); overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.classList.remove('open');}); const x=$('#sheet-x'); if(x)x.onclick=()=>overlay.classList.remove('open'); }
function escapeHtml(str){ return String(str??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
