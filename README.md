# CampusFlow — prototype web

Prototype fonctionnel de CampusFlow : site statique (HTML/CSS/JS pur, aucun framework, aucune installation nécessaire), qui lit les données depuis `data.json` (exporté depuis le Google Sheets du projet).

## Fichiers

- `index.html` — les 4 écrans (Accueil, Opportunités, Planning, Profil)
- `style.css` — l'identité visuelle
- `app.js` — la logique : matching profil ↔ opportunités, calcul des économies, tri des deadlines par urgence, filtres
- `data.json` — les données (aides, deadlines, établissements, formations, sources)

## Comment le tester tout de suite, sans rien installer

Double-clique sur `index.html` — ça s'ouvre dans ton navigateur. (Certains navigateurs bloquent le chargement de `data.json` en local par sécurité ; si l'app reste vide, utilise l'option "héberger en ligne" ci-dessous, ou lance un petit serveur local avec `python3 -m http.server` puis ouvre `http://localhost:8000`.)

## Mettre en ligne gratuitement avec GitHub Pages

1. Va sur [github.com](https://github.com), connecte-toi, clique sur **New repository**. Donne-lui un nom (ex: `campusflow`), coche "Public", ne coche rien d'autre, clique **Create repository**.
2. Sur la page du repo vide, clique **uploading an existing file**.
3. Glisse les 5 fichiers de ce dossier (`index.html`, `style.css`, `app.js`, `data.json`, `README.md`) dans la zone, puis clique **Commit changes**.
4. Va dans l'onglet **Settings** du repo → section **Pages** (menu de gauche) → sous "Build and deployment", choisis **Deploy from a branch**, branche `main`, dossier `/ (root)`, clique **Save**.
5. Attends 1-2 minutes, rafraîchis la page : un lien apparaît en haut, du type `https://tonpseudo.github.io/campusflow/` — c'est ton app en ligne, gratuite, mise à jour à chaque fois que tu modifies un fichier sur GitHub.

## Mettre à jour les données

Quand la base Google Sheets évolue, il suffit de régénérer `data.json` à partir du classeur et de remplacer le fichier sur GitHub (dans le repo, ouvre `data.json`, clique le crayon "Edit", colle le nouveau contenu, "Commit changes"). Le site se met à jour automatiquement, sans toucher au reste du code.

## Ce que ce prototype fait déjà

- Profil étudiant simple (ville, âge, niveau, boursier, alternant), sauvegardé dans le navigateur (localStorage — propre à chaque appareil, pas de compte ni de base de données côté serveur)
- Matching basique : filtre les opportunités nationales + celles de la ville choisie, en tenant compte des critères boursier/alternant/âge quand ils sont renseignés
- Calcul automatique du total d'économies potentielles pour le profil actuel
- Planning des deadlines classé par urgence (rouge/orange/vert selon la proximité de la date)
- Liste des opportunités filtrable par ville et catégorie
- Fiche détail de chaque opportunité avec lien vers la source officielle

## Ce qui manque encore (prochaines étapes possibles)

- **Comptes utilisateurs réels** : aujourd'hui le profil est local à l'appareil, pas de compte partagé entre appareils — il faudrait un backend (Firebase, Supabase...) pour ça
- **Paiement Premium** : le bouton existe visuellement mais Stripe n'est pas branché
- **Écrans établissements/formations** : les données existent dans `data.json` mais ne sont pas encore affichées dans une page dédiée
- **Design** : c'est un point de départ solide, mais rien n'empêche de l'ajuster (couleurs, polices, mise en page) une fois en ligne
