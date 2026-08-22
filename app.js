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

fetch('data.json?v=4.1')
  .then(r=>{ if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
  .then(json=>{ DATA={...DATA,...json}; init(); })
  .catch(err=>{
    console.error('CampusFlow data loading error', err);
    // L'interface reste utilisable : les villes de lancement sont disponibles en secours.
    init();
    $('#opp-list').innerHTML='<div class="empty-state">La base distante n’a pas pu être chargée. Réessaie en actualisant la page.</div>';
  });

function init(){ renderProfileForm(); renderIdCard(); renderFilters(); renderOpportunities(); renderDeadlines(); renderHome(); renderCalendarSummary(); renderFocus(); renderSmartProfile(); bindNav(); bindSheet(); bindNotifications(); const search=$('#opp-search'); if(search) search.addEventListener('input',renderOpportunities); }

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

function originMeta(item){
 const key=item.origine||'national';
 const map={national:{label:'National',cls:'origin-national'},universite:{label:'Université',cls:'origin-universite'},local:{label:'Local',cls:'origin-local'}};
 return map[key]||map.national;
}
function profileCompletion(){
 const fields=[
  ['ville','Ville d’études'],['age','Âge'],['etablissement','Établissement'],['formation','Formation'],
  ['niveau','Année / niveau'],['boursier','Statut boursier'],['logement','Logement'],
  ['transport','Transport'],['qf','Quotient familial'],['villeResidence','Ville de résidence']
 ];
 const done=fields.filter(([k])=>PROFILE[k]!==undefined&&PROFILE[k]!==null&&PROFILE[k]!=='').length;
 return {pct:Math.round(done/fields.length*100),missing:fields.filter(([k])=>PROFILE[k]===undefined||PROFILE[k]===null||PROFILE[k]==='')};
}
function countPotentialUnlock(field){
 const aliases={qf:['qf_max','qf_min'],villeResidence:['ville_residence'],etablissement:['etablissement'],formation:['formation'],logement:['type_logement'],boursier:['boursier'],age:['age_min','age_max']};
 const keys=aliases[field]||[];
 return DATA.opportunities.filter(o=>keys.some(k=>o[k]!==undefined&&o[k]!==null&&o[k]!=='')).length;
}
function renderSmartProfile(){
 const card=$('#smart-profile-card');if(!card)return;
 const c=profileCompletion();$('#profile-completion').textContent=`${c.pct} %`;$('#completion-bar').style.width=`${c.pct}%`;
 const ranked=c.missing.map(([key,label])=>({key,label,n:countPotentialUnlock(key)})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n).slice(0,3);
 $('#profile-unlocks').innerHTML=ranked.length?ranked.map(x=>`<button class="unlock-item" data-nav="profil"><span>+</span><div><strong>Renseigne ${escapeHtml(x.label.toLowerCase())}</strong><small>${x.n} dispositif${x.n>1?'s':''} pourront être vérifiés plus précisément</small></div></button>`).join(''):`<div class="profile-complete-msg">Ton profil contient déjà les principaux critères de matching.</div>`;
 $('#profile-unlocks').querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>navigateTo('profil'));
}
function recommendationReasons(o){
 const r=[];
 if(PROFILE.ville&&o.ville&&o.ville===PROFILE.ville)r.push(`${PROFILE.ville} ✓`);
 if(PROFILE.age&&o.age_max&&Number(PROFILE.age)<=Number(o.age_max))r.push(`Âge compatible ✓`);
 if(PROFILE.age&&o.age_min&&Number(PROFILE.age)>=Number(o.age_min))r.push(`Âge minimum ✓`);
 if(PROFILE.qf&&o.qf_max&&Number(PROFILE.qf)<=Number(o.qf_max))r.push(`QF compatible ✓`);
 if(PROFILE.boursier&&o.boursier===true)r.push(`Statut boursier ✓`);
 if(PROFILE.etablissement&&o.etablissement===PROFILE.etablissement)r.push(`Ton établissement ✓`);
 if(PROFILE.formation&&o.formation===PROFILE.formation)r.push(`Ta formation ✓`);
 if(!r.length)r.push(o.origine==='national'?'Dispositif national':'Correspond à ton profil actuel');
 return r.slice(0,4);
}
function confidenceLabel(o){
 const req=o.required_profile_fields||[];
 const missing=req.filter(k=>{
  const map={quotient_familial:'qf',ville_residence:'villeResidence',type_logement:'logement'};
  const pk=map[k]||k;return PROFILE[pk]===undefined||PROFILE[pk]===null||PROFILE[pk]==='';
 });
 if(missing.length)return {label:'À vérifier',cls:'confidence-check'};
 const reasons=recommendationReasons(o);
 if(reasons.length>=3)return {label:'Éligible selon ton profil',cls:'confidence-high'};
 return {label:'Probablement éligible',cls:'confidence-medium'};
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
  card.innerHTML=`${(()=>{const om=originMeta(o);return `<div class="origin-chip ${om.cls}">${om.label}</div>`})()}<div class="card-top"><div class="card-title">${escapeHtml(o.nom||'')}</div><div class="card-amount">${escapeHtml(displayAmount(o))}</div></div>
  <div class="card-meta"><span class="tag">${escapeHtml(o.categorie||'')}</span><span class="tag">${escapeHtml(o.ville||'National')}</span><span class="tag ${comp?'status-green':'status-orange'}">${comp?conf:'Hors profil actuel'}</span></div>
  <div class="card-desc">${escapeHtml((o.description_courte||'').slice(0,130))}${(o.description_courte||'').length>130?'…':''}</div><div class="recommendation-proof">${(()=>{const c=confidenceLabel(o);return `<span class="confidence ${c.cls}">${c.label}</span>`})()}<div class="reason-mini">${recommendationReasons(o).map(r=>`<span>${escapeHtml(r)}</span>`).join('')}</div></div>`;
  card.onclick=()=>openOpportunitySheet(o); return card;
}
function openOpportunitySheet(o){
  const official=(o.statut_verification||'').includes('🟢')?'Source vérifiée':'À revérifier';
  const reasons=matchingReasons(o);
  $('#sheet-content').innerHTML=`<h2>${escapeHtml(o.nom||'')}</h2><div class="sheet-origin-row"><span class="origin-chip ${originMeta(o).cls}">${originMeta(o).label}</span><span class="confidence ${confidenceLabel(o).cls}">${confidenceLabel(o).label}</span></div><div class="why-box"><strong>Pourquoi CampusFlow te montre ça</strong><div>${recommendationReasons(o).map(r=>`<span>${escapeHtml(r)}</span>`).join('')}</div></div><div class="card-amount">${escapeHtml(displayAmount(o))}</div>
  <p class="sheet-copy">${escapeHtml(o.description_courte||'')}</p>
  <div class="eligibility-note">${opportunityIsCompatible(o)?'Ton profil semble compatible — vérifie les conditions officielles.':'Cette opportunité ne correspond pas complètement aux informations de ton profil.'}${reasons.length?`<div class="reason-list">${reasons.map(r=>`<span>${escapeHtml(r)}</span>`).join('')}</div>`:''}</div>
  <div class="sheet-row"><span class="k">Type</span><span class="v">${labelFinancialClass(o)}</span></div>
  <div class="sheet-row"><span class="k">Critères</span><span class="v">${escapeHtml(o.autres_criteres||'À vérifier')}</span></div>
  <div class="sheet-row"><span class="k">Fréquence</span><span class="v">${escapeHtml(o.frequence||'—')}</span></div>
  <div class="sheet-row"><span class="k">Vérification</span><span class="v">${escapeHtml(official)} · ${escapeHtml(o.date_derniere_verif||'date inconnue')}</span></div>
  ${o.date_limite_2026_2027?`<div class="sheet-row"><span class="k">Échéance</span><span class="v">${escapeHtml(o.date_limite_2026_2027)}</span></div>`:''}
  ${o.lien_source_officielle?`<a class="sheet-link" href="${escapeHtml(o.lien_source_officielle)}" target="_blank" rel="noopener">Ouvrir l’offre / démarche officielle →</a>`:''}`;
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
 const row=document.createElement('div'); row.className='deadline-row'+(COMPLETED.includes(d.id)?' completed':'');
 row.innerHTML=`<button class="task-check" aria-label="Terminer">${COMPLETED.includes(d.id)?'✓':''}</button><div class="urgency-dot ${urgencyBucket(d)}"></div><div class="deadline-copy"><div class="deadline-title-line"><span class="origin-chip ${originMeta(d).cls}">${originMeta(d).label}</span><div class="deadline-title">${escapeHtml(d.titre||'')}</div></div><div class="deadline-date">${escapeHtml(formatDateRange(d))} · ${escapeHtml(d.ville_ou_perimetre||'')}</div><div class="deadline-action">Voir quoi faire →</div></div>`;
 row.querySelector('.task-check').onclick=(e)=>{e.stopPropagation();toggleCompleted(d.id);}; row.onclick=()=>openDeadlineSheet(d); return row;
}
function formatDateFR(raw){if(!raw)return'Date à confirmer';const dt=new Date(raw+'T12:00:00');if(isNaN(dt))return raw;return dt.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});}
function formatDateRange(d){if(d.date_debut&&d.date_fin&&d.date_debut!==d.date_fin)return `${formatDateFR(d.date_debut)} → ${formatDateFR(d.date_fin)}`;return formatDateFR(d.date_fin||d.date_debut);}
function googleCalendarUrl(d){const start=(d.date_debut||d.date_fin||'').replaceAll('-','');let end='';if(d.date_fin||d.date_debut){const x=new Date((d.date_fin||d.date_debut)+'T12:00:00');x.setDate(x.getDate()+1);end=x.toISOString().slice(0,10).replaceAll('-','');}if(!start)return'';const details=[d.action_detail||d.description||'',d.lien_source_officielle||''].filter(Boolean).join('\n\n');return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(d.titre||'CampusFlow')}&dates=${start}/${end||start}&details=${encodeURIComponent(details)}`;}
function openDeadlineSheet(d){const cal=googleCalendarUrl(d);$('#sheet-content').innerHTML=`<div class="sheet-type">DATE CLÉ</div><h2>${escapeHtml(d.titre||'')}</h2><div class="deadline-big-date">${escapeHtml(formatDateRange(d))}</div><p class="sheet-copy">${escapeHtml(d.description||'')}</p><div class="action-box"><strong>Ce que tu dois faire</strong><p>${escapeHtml(d.action_detail||d.description||'Consulte la source officielle pour la démarche exacte.')}</p></div><div class="sheet-row"><span class="k">Statut</span><span class="v">${COMPLETED.includes(d.id)?'Terminé':'À faire'}</span></div><div class="sheet-actions">${d.lien_source_officielle?`<a class="sheet-link" href="${escapeHtml(d.lien_source_officielle)}" target="_blank" rel="noopener">Ouvrir la page officielle →</a>`:''}${cal?`<a class="sheet-link secondary-sheet-link" href="${escapeHtml(cal)}" target="_blank" rel="noopener">Ajouter à Google Agenda</a>`:''}</div>`;$('#sheet-overlay').classList.add('open');}
function renderCalendarSummary(){const el=$('#calendar-summary');if(!el)return;const upcoming=relevantDeadlines().filter(d=>!COMPLETED.includes(d.id)).slice(0,5);el.innerHTML=upcoming.length?upcoming.map(d=>`<button class="date-pill" data-dl="${escapeHtml(d.id)}"><strong>${escapeHtml(formatDateFR(d.date_fin||d.date_debut))}</strong><span>${escapeHtml((d.titre||'').slice(0,36))}</span></button>`).join(''):'<span class="empty-calendar">Aucune échéance à venir pour ce profil.</span>';el.querySelectorAll('[data-dl]').forEach(b=>b.onclick=()=>openDeadlineSheet(DATA.deadlines.find(d=>d.id===b.dataset.dl)));}
function renderFocus(){const c=DATA.opportunities.filter(opportunityIsCompatible),up=relevantDeadlines().filter(d=>!COMPLETED.includes(d.id))[0],aid=c.filter(o=>financialClass(o)==='aid').sort((a,b)=>scoreOpportunity(b)-scoreOpportunity(a))[0],ben=c.filter(o=>['benefit','cost','saving'].includes(financialClass(o))).sort((a,b)=>scoreOpportunity(b)-scoreOpportunity(a))[0];if($('#focus-deadline-title'))$('#focus-deadline-title').textContent=up?.titre||'Aucune échéance urgente';if($('#focus-deadline-date'))$('#focus-deadline-date').textContent=up?formatDateRange(up):'Profil à jour';if($('#focus-aid-title'))$('#focus-aid-title').textContent=aid?.nom||'Aucune aide identifiée';if($('#focus-aid-meta'))$('#focus-aid-meta').textContent=aid?(displayAmount(aid)||confidence(aid)):'Complète ton profil';if($('#focus-benefit-title'))$('#focus-benefit-title').textContent=ben?.nom||'Aucun avantage identifié';if($('#focus-benefit-meta'))$('#focus-benefit-meta').textContent=ben?`${ben.ville||'National'} · ${confidence(ben)}`:'Complète ton profil';}
function bindNotifications(){const btn=$('#enable-notifications');if(!btn)return;if(!('Notification'in window)){btn.textContent='Rappels non pris en charge';btn.disabled=true;return;}const sync=()=>btn.textContent=Notification.permission==='granted'?'Rappels activés':'Activer les rappels';sync();btn.onclick=async()=>{const p=await Notification.requestPermission();sync();if(p==='granted')new Notification('CampusFlow',{body:'Rappels activés. Les notifications web restent dépendantes du navigateur.'});};}
function toggleCompleted(id){ COMPLETED=COMPLETED.includes(id)?COMPLETED.filter(x=>x!==id):[...COMPLETED,id]; saveCompleted(); renderDeadlines(); renderHome(); renderCalendarSummary(); renderFocus(); }
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
 $('#save-profile').onclick=()=>{PROFILE.ville=$('#f-ville').value;PROFILE.villeResidence=$('#f-ville-residence').value;PROFILE.age=$('#f-age').value;PROFILE.niveau=$('#f-niveau').value;PROFILE.logement=$('#f-logement').value;PROFILE.transport=$('#f-transport').value;PROFILE.qf=$('#f-qf').value;PROFILE.etablissement=$('#f-etablissement').value;PROFILE.formation=$('#f-formation').value;saveProfile();renderIdCard();renderHome();renderDeadlines();renderFocus();renderSmartProfile();navigateTo('accueil');};
}
function updateEstablishments(){ const list=DATA.establishments.filter(e=>!PROFILE.ville||e.ville===PROFILE.ville); $('#f-etablissement').innerHTML='<option value="">Choisir (optionnel)</option>'+list.map(e=>`<option value="${e.id}">${escapeHtml(e.nom)}</option>`).join(''); if(list.some(e=>e.id===PROFILE.etablissement))$('#f-etablissement').value=PROFILE.etablissement; else PROFILE.etablissement=''; updateFormations(); }
function updateFormations(){ let list=DATA.formations.filter(f=>f.etablissement_id===PROFILE.etablissement); list.sort((a,b)=>(a.nom||'').localeCompare(b.nom||'','fr')); $('#f-formation').innerHTML='<option value="">Choisir une formation</option>'+list.map(f=>`<option value="${f.id}">${escapeHtml(f.nom)}</option>`).join(''); if(list.some(f=>f.id===PROFILE.formation)){ $('#f-formation').value=PROFILE.formation; const selected=list.find(f=>f.id===PROFILE.formation); if(selected?.niveau){ PROFILE.niveau=selected.niveau; $('#f-niveau').value=selected.niveau; } } else PROFILE.formation=''; }

function bindNav(){ $$('[data-nav]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();navigateTo(el.dataset.nav);})); }
function navigateTo(page){ $$('.page').forEach(p=>p.classList.remove('active')); $(`#page-${page}`)?.classList.add('active'); $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.nav===page)); window.scrollTo(0,0); }
function bindSheet(){ const overlay=$('#sheet-overlay'); overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.classList.remove('open');}); const x=$('#sheet-x'); if(x)x.onclick=()=>overlay.classList.remove('open'); }
function escapeHtml(str){ return String(str??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
