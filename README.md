# CampusFlow V2

Prototype web statique mobile-first de CampusFlow, prêt à être hébergé sur GitHub Pages, Vercel ou Netlify.

## Changements V2

- Calcul financier corrigé : les aides, avantages tarifaires, services et financements ne sont plus additionnés ensemble.
- Matching profil amélioré : ville, âge, boursier, alternant, établissement, formation, logement, transport et quotient familial peuvent être stockés.
- Planning personnalisé : filtrage national + ville, classement par échéance et tâches cochables persistantes.
- Opportunités classées par nature : aides / avantages / financements / services.
- Fiches prudentes : jamais de promesse d'éligibilité, renvoi vers la source officielle et date de vérification.
- Base élargie à Grenoble avec données officielles 2026 (M réso, tarification solidaire, piscines Grenoble) et établissements/formations de démarrage.
- Base XLSX V2 synchronisée avec `data.json`.

## Lancer en local

Le site charge `data.json` avec `fetch`, donc il faut un petit serveur HTTP et non ouvrir directement `index.html` en `file://`.

Exemple :

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.

## Mise en ligne GitHub Pages

1. Créer un repository GitHub.
2. Mettre `index.html`, `style.css`, `app.js` et `data.json` à la racine.
3. GitHub > Settings > Pages > Deploy from branch > `main` / root.
4. La version actuelle n'a pas besoin de backend.

## Étape suivante recommandée

Tester le MVP avec de vrais étudiants avant de brancher un backend. Si l'usage est validé : migration de `data.json` et du profil local vers Supabase, puis authentification, rappels et éventuellement Stripe.


## V2.1
- Correctif du sélecteur de ville d’étude sur GitHub Pages.
- Paris, Lyon, Lille, Bordeaux, Toulouse et Grenoble sont disponibles même en cas de problème de chargement de data.json.
- Cache-busting sur app.js, style.css et data.json pour éviter que Safari conserve une ancienne version.

## V3.4 — Grenoble pilote
- Couverture Grenoble enrichie : campus, santé, alimentation solidaire, logement, culture, sport.
- Matching par établissement, formation, niveau et logement en plus des critères existants.
- Planning contextualisé par formation (ex. PASS / DFGSM2 / DFGSM3) et niveau UGA.
- Fiches détaillées avec raisons de recommandation.

## V3.4 — Grenoble renforcé
Ajouts vérifiés le 22/08/2026 : Carte Emblem 2026/2027 et offre ski Les 2 Alpes, mutuelle communale -30% étudiants, aide mobilité CCAS QF ≤ 715 €, Théâtre municipal tarifs étudiant/boursier, Au Local -15% étudiants, La Chaufferie 15-25 ans. Les offres commerciales sont explicitement distinguées des dispositifs publics.


## V3.5 — audit Grenoble
- correction M réso : âge 18–24 ans ;
- tarification solidaire M réso : QF ≤ 900 pris en compte par le matching ;
- Carte Emblem : moins de 30 ans ;
- conservation du statut « À vérifier » lorsqu'une condition nécessaire manque au profil ;
- contrôle de profils types Grenoble avant extension nationale.


## V3.6
Audit matching Grenoble renforcé : critères requis explicites, aucune addition naïve des aides, prêts séparés, statut À vérifier pour les profils incomplets.


## V3.7 — audit profils réels
Correction structurelle des cursus médecine Grenoble (PASS, DFGSM2, DFGSM3), deadlines rattachées aux bonnes formations et filtrage strict des échéances précises.
