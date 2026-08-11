// ============================================================
// CampusFlow — logique front-end (données locales, sans backend)
// ============================================================

let DATA = { opportunities: [], deadlines: [], establishments: [], formations: [], sources: [] };
let PROFILE = loadProfile();

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function loadProfile(){
  try {
    return JSON.parse(localStorage.getItem('campusflow_profile')) || {
      ville:"", age:"", niveau:"", boursier:"non", alternant:"non"
    };
  } catch(e){
    return { ville:"", age:"", niveau:"", boursier:"non", alternant:"non" };
  }
}
function saveProfile(){
  localStorage.setItem('campusflow_profile', JSON.stringify(PROFILE));
}

// ---------------- data loading ----------------
fetch('data.json')
  .then(r => r.json())
  .then(json => {
    DATA.opportunities = json.opportunities || [];
    DATA.deadlines = json.deadlines || [];
    DATA.establishments = json.establishments || [];
    DATA.formations = json.formations || [];
    DATA.sources = json.sources || [];
    init();
  })
  .catch(err => {
    console.error('Erreur de chargement des données', err);
    $('#opp-list').innerHTML = '<div class="empty-state">Impossible de charger data.json — vérifie qu\'il est bien à la racine du site.</div>';
  });

// ---------------- init ----------------
function init(){
  renderProfileForm();
  renderIdCard();
  renderFilters();
  renderOpportunities();
  renderDeadlines();
  renderHome();
  bindNav();
  bindSheet();
}

// ---------------- matching logic ----------------
function opportunityMatchesProfile(opp){
  // Une opportunité "matche" si son périmètre est national,
  // ou si sa ville correspond à celle du profil.
  const perimetre = (opp.perimetre || '').toLowerCase();
  const ville = (opp.ville || '').trim();
  if (perimetre === 'national') return true;
  if (!PROFILE.ville) return true; // pas de ville renseignée -> on montre tout
  return ville === PROFILE.ville;
}

function opportunityIsCompatible(opp){
  // Vérifie les critères connus (boursier, alternant, âge max)
  if (!opportunityMatchesProfile(opp)) return false;
  if ((opp.boursier_requis || '').toLowerCase() === 'oui' && PROFILE.boursier !== 'oui') return false;
  if ((opp.alternant_requis || '').toLowerCase() === 'oui' && PROFILE.alternant !== 'oui') return false;
  if (opp.age_max && PROFILE.age && Number(PROFILE.age) > Number(opp.age_max)) return false;
  return true;
}

function estimateAmount(opp){
  const min = Number(opp.montant_min_eur) || 0;
  const max = Number(opp.montant_max_eur) || min;
  return max || min;
}

// ---------------- ID card ----------------
function renderIdCard(){
  const nameEl = $('#id-name');
  const pillsEl = $('#id-pills');
  if (PROFILE.ville) {
    nameEl.textContent = `Étudiant·e à ${PROFILE.ville}`;
  } else {
    nameEl.textContent = "Configure ton profil";
  }
  pillsEl.innerHTML = '';
  const pills = [];
  if (PROFILE.niveau) pills.push(PROFILE.niveau);
  if (PROFILE.boursier === 'oui') pills.push({t:'Boursier·ère', mint:true});
  if (PROFILE.alternant === 'oui') pills.push({t:'Alternant·e', mint:true});
  if (PROFILE.age) pills.push(`${PROFILE.age} ans`);
  if (!pills.length) {
    pillsEl.innerHTML = '<span class="pill">Aucune info renseignée</span>';
    return;
  }
  pills.forEach(p => {
    const span = document.createElement('span');
    if (typeof p === 'object'){
      span.className = 'pill mint';
      span.textContent = p.t;
    } else {
      span.className = 'pill';
      span.textContent = p;
    }
    pillsEl.appendChild(span);
  });
}

// ---------------- home ----------------
function renderHome(){
  const compatible = DATA.opportunities.filter(opportunityIsCompatible);
  const total = compatible.reduce((sum, o) => sum + estimateAmount(o), 0);
  $('#savings-amount').textContent = `${Math.round(total).toLocaleString('fr-FR')} €`;
  $('#savings-count').textContent = `${compatible.length} opportunité${compatible.length>1?'s':''} détectée${compatible.length>1?'s':''}`;

  // upcoming deadlines (first 3)
  const homeDl = $('#home-deadlines');
  homeDl.innerHTML = '';
  const sortedDl = sortDeadlinesByUrgency(DATA.deadlines).slice(0,3);
  if (!sortedDl.length){
    homeDl.innerHTML = '<div class="empty-state">Aucune échéance pour le moment.</div>';
  }
  sortedDl.forEach(d => homeDl.appendChild(deadlineRow(d)));

  // top opportunities (first 4 compatible)
  const homeOpp = $('#home-opportunities');
  homeOpp.innerHTML = '';
  if (!compatible.length){
    homeOpp.innerHTML = '<div class="empty-state">Renseigne ton profil pour voir tes opportunités.</div>';
  }
  compatible.slice(0,4).forEach(o => homeOpp.appendChild(opportunityCard(o)));
}

// ---------------- opportunities page ----------------
let activeVille = 'Toutes';
let activeCategorie = 'Toutes';

function renderFilters(){
  const villes = ['Toutes', ...new Set(DATA.opportunities.map(o => o.ville).filter(Boolean))];
  const cats = ['Toutes', ...new Set(DATA.opportunities.map(o => o.categorie).filter(Boolean))];

  const villeEl = $('#filter-ville');
  villeEl.innerHTML = '';
  villes.forEach(v => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (v === activeVille ? ' active' : '');
    chip.textContent = v;
    chip.onclick = () => { activeVille = v; renderFilters(); renderOpportunities(); };
    villeEl.appendChild(chip);
  });

  const catEl = $('#filter-categorie');
  catEl.innerHTML = '';
  cats.forEach(c => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (c === activeCategorie ? ' active' : '');
    chip.textContent = c;
    chip.onclick = () => { activeCategorie = c; renderFilters(); renderOpportunities(); };
    catEl.appendChild(chip);
  });
}

function renderOpportunities(){
  const list = $('#opp-list');
  list.innerHTML = '';
  let items = DATA.opportunities.slice();
  if (activeVille !== 'Toutes') items = items.filter(o => o.ville === activeVille || (o.perimetre||'').toLowerCase() === 'national');
  if (activeCategorie !== 'Toutes') items = items.filter(o => o.categorie === activeCategorie);
  if (!items.length){
    list.innerHTML = '<div class="empty-state">Aucune opportunité pour ces filtres.</div>';
    return;
  }
  items.forEach(o => list.appendChild(opportunityCard(o)));
}

function opportunityCard(o){
  const card = document.createElement('div');
  card.className = 'card';
  const amount = estimateAmount(o);
  const statusClass = (o.statut_verification || '').includes('🟢') ? 'status-green' : 'status-orange';
  card.innerHTML = `
    <div class="card-top">
      <div class="card-title">${escapeHtml(o.nom || '')}</div>
      ${amount ? `<div class="card-amount">${Math.round(amount).toLocaleString('fr-FR')} €</div>` : ''}
    </div>
    <div class="card-meta">
      <span class="tag">${escapeHtml(o.categorie || '')}</span>
      <span class="tag">${escapeHtml(o.ville || 'National')}</span>
      <span class="tag ${statusClass}">${escapeHtml((o.statut_verification||'').replace('🟢','').replace('🟠','').trim() || 'statut inconnu')}</span>
    </div>
    <div class="card-desc">${escapeHtml((o.description_courte || '').slice(0,110))}${(o.description_courte||'').length>110?'…':''}</div>
  `;
  card.onclick = () => openOpportunitySheet(o);
  return card;
}

function openOpportunitySheet(o){
  const content = $('#sheet-content');
  const amount = estimateAmount(o);
  content.innerHTML = `
    <h2>${escapeHtml(o.nom || '')}</h2>
    ${amount ? `<div class="card-amount">${Math.round(amount).toLocaleString('fr-FR')} € estimé</div>` : ''}
    <p style="color:var(--muted); font-size:14px; margin-top:14px; line-height:1.6;">${escapeHtml(o.description_courte || '')}</p>
    <div class="sheet-row"><span class="k">Catégorie</span><span class="v">${escapeHtml(o.categorie||'—')}</span></div>
    <div class="sheet-row"><span class="k">Périmètre</span><span class="v">${escapeHtml(o.ville || o.perimetre || '—')}</span></div>
    <div class="sheet-row"><span class="k">Fréquence</span><span class="v">${escapeHtml(o.frequence||'—')}</span></div>
    <div class="sheet-row"><span class="k">Critères</span><span class="v">${escapeHtml(o.autres_criteres||'—')}</span></div>
    <div class="sheet-row"><span class="k">Statut</span><span class="v">${escapeHtml(o.statut_verification||'—')}</span></div>
    <div class="sheet-row"><span class="k">Deadline</span><span class="v">${escapeHtml(o.date_limite_2026_2027||'—')}</span></div>
    ${o.lien_source_officielle ? `<a class="sheet-link" href="${o.lien_source_officielle}" target="_blank" rel="noopener">Vérifier sur la source officielle →</a>` : ''}
  `;
  $('#sheet-overlay').classList.add('open');
}

// ---------------- planning page ----------------
function parseDeadlineDate(d){
  const raw = d.date_fin || d.date_debut;
  if (!raw) return null;
  const dt = new Date(raw);
  return isNaN(dt) ? null : dt;
}

function sortDeadlinesByUrgency(list){
  const now = new Date();
  return list.slice().sort((a,b) => {
    const da = parseDeadlineDate(a); const db = parseDeadlineDate(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return Math.abs(da-now) - Math.abs(db-now);
  });
}

function urgencyBucket(d){
  const dt = parseDeadlineDate(d);
  if (!dt) return 'green';
  const now = new Date();
  const diffDays = (dt - now) / 86400000;
  if (diffDays <= 14 && diffDays >= -30) return 'red';
  if (diffDays <= 60) return 'orange';
  return 'green';
}

function deadlineRow(d){
  const row = document.createElement('div');
  row.className = 'deadline-row';
  const bucket = urgencyBucket(d);
  const dateLabel = d.date_fin || d.date_debut || 'date à confirmer';
  row.innerHTML = `
    <div class="urgency-dot ${bucket}"></div>
    <div>
      <div class="deadline-title">${escapeHtml(d.titre || '')}</div>
      <div class="deadline-date">${escapeHtml(dateLabel)} · ${escapeHtml(d.ville_ou_perimetre || '')}</div>
    </div>
  `;
  return row;
}

function renderDeadlines(){
  const buckets = { red:[], orange:[], green:[] };
  DATA.deadlines.forEach(d => buckets[urgencyBucket(d)].push(d));
  ['red','orange','green'].forEach(key => {
    const el = $(`#deadlines-${key}`);
    el.innerHTML = '';
    if (!buckets[key].length){
      el.innerHTML = '<div class="empty-state">Rien ici pour le moment.</div>';
      return;
    }
    sortDeadlinesByUrgency(buckets[key]).forEach(d => el.appendChild(deadlineRow(d)));
  });
}

// ---------------- profile form ----------------
function renderProfileForm(){
  $('#f-ville').value = PROFILE.ville || '';
  $('#f-age').value = PROFILE.age || '';
  $('#f-niveau').value = PROFILE.niveau || '';
  $$('.toggle-btn').forEach(btn => {
    const field = btn.dataset.field;
    const value = btn.dataset.value;
    btn.classList.toggle('active', PROFILE[field] === value);
    btn.onclick = () => {
      PROFILE[field] = value;
      $$(`.toggle-btn[data-field="${field}"]`).forEach(b => b.classList.toggle('active', b === btn));
    };
  });
  $('#save-profile').onclick = () => {
    PROFILE.ville = $('#f-ville').value;
    PROFILE.age = $('#f-age').value;
    PROFILE.niveau = $('#f-niveau').value;
    saveProfile();
    renderIdCard();
    renderHome();
    navigateTo('accueil');
  };
}

// ---------------- nav ----------------
function bindNav(){
  $$('[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(el.dataset.nav);
    });
  });
}
function navigateTo(page){
  $$('.page').forEach(p => p.classList.remove('active'));
  $(`#page-${page}`).classList.add('active');
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.nav === page));
  window.scrollTo(0,0);
}

// ---------------- sheet ----------------
function bindSheet(){
  const overlay = $('#sheet-overlay');
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
}

// ---------------- utils ----------------
function escapeHtml(str){
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
