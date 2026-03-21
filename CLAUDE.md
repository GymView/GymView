# CLAUDE.md — CRI Dashboard (GymView)

Dashboard de gestion de salle de sport pour le projet CRI 2026.

---

## Stack technique

| Couche | Techno |
|--------|--------|
| Frontend | React 19 + Vite, Mantine UI, Recharts, Framer Motion, Lucide React |
| Grille | GridStack 24 colonnes, `cellHeight: 58`, `float: true`, `margin: 4` |
| Backend | FastAPI + SQLModel + Pydantic v2 |
| Base de données | PostgreSQL hébergée sur **Neon Cloud** |
| Temps réel | Socket.io (WebSocket) |
| IoT | MQTT via HiveMQ Cloud |

---

## Structure du projet

```
src/
  App.jsx                        # Routeur principal (state `active` + MantineProvider)
  index.css                      # Design tokens CSS (--bg-primary, --accent-primary…)
  constants/config.js            # CONFIG: GYM_ID=1, SOCKET_URL, API_KEY, STORAGE_KEY
  services/gymApi.js             # Toutes les requêtes API (GymApi.*)
  hooks/useMachineSocket.js      # Socket.io — écoute les états machines en temps réel
  components/
    Navbar.jsx / Navbar.css      # Sidebar de navigation (logo V-zion blanc, titre fenêtre)
    NavbarSimple.module.css      # CSS module de la navbar
    MachineEditor.jsx            # Modal d'édition d'une machine (label, type, icône)
  utils/iconLoader.js            # import.meta.glob — charge tous les SVG de src/assets/icons/
  assets/icons/                  # SVG machines : dark body (fill="#222"), invert(1) → blanc
  pages/
    Home/        Home.jsx/.css   # Vue temps réel — état de toutes les machines
    Dashboard/   Dashboard.jsx/.css  # Analytics — fréquentation horaire + journalière (Recharts)
    GymPlanner/  GymPlanner.jsx/.css # Grille drag & drop GridStack + pins signalements
    Maintenance/ Maintenance.jsx/.css# Santé parc machine — barre de progression par machine
    Messages/    Messages.jsx/.css   # CRUD signalements (reports) — persisté en BDD

backend/
  database.py   # Modèles SQLModel : GymMap, Report, UsageEvent, Gym
  main.py       # FastAPI : routes CRUD + MQTT handler + Socket.io
  seed_data.py  # Seed maintenance (total_minutes, last_maintenance_date…)
  seed_usage.py # Seed 22 441 UsageEvents + 14 Reports
```

---

## Modèles BDD (SQLModel)

### GymMap
Chaque machine sur le plan. `gymview_id` = entier 1–26.
Champs maintenance : `total_minutes`, `minutes_since_last_maint`, `last_maintenance_date`, `first_usage`, `maintenance_threshold`.

### Report (signalements)
`id, gym_id, title, category, priority, machine, description, status, date, resolved_date`
- `priority` : `urgente | haute | normale | faible`
- `status` : `ouvert | en_cours | resolu`

### UsageEvent
`id, gym_id, machine_id, gymview_id, machine_type, machine_label, started_at, ended_at, duration_minutes`
Créé/fermé automatiquement par le handler MQTT quand une machine passe en `utilise/occupe` puis `libre`.

---

## Routes API principales

```
GET  /{gym_id}/get_map            # Carte complète (machines + état)
POST /{gym_id}/update_map/        # Sauvegarde grille (X-API-Key requis)
POST /reset_maintenance/{id}      # Reset compteur maintenance

GET  /{gym_id}/reports/           # Liste signalements
POST /{gym_id}/reports/           # Créer signalement
PATCH /reports/{id}               # Modifier statut
DELETE /reports/{id}              # Supprimer

GET  /{gym_id}/usage/hourly       # Stats par heure (param: days=30)
GET  /{gym_id}/usage/daily        # Stats par jour  (param: days=60)
GET  /{gym_id}/usage/by_machine   # Stats par machine
```

---

## Points critiques / pièges connus

### GridStack → Pydantic 422
`cellHeight: auto` renvoie des coordonnées float. Pydantic v2 rejette float pour `int`.
**Fix :** `Math.round()` sur tous les champs x/y/w/h dans `persistLayout`.

### Icônes SVG
Les SVG ont `fill="#222" stroke="#333"` (sombre). Le CSS applique `filter: invert(1)` → blanc sur fond sombre. Ne pas mettre `fill="white"` directement dans le SVG.

### Socket.io
`useMachineSocket.js` se connecte à `SOCKET_URL` (localhost:8000). Les mises à jour d'état machine arrivent en temps réel et modifient le state React.

### MQTT
Le backend écoute le topic `"1"` (gym_id). Quand une machine passe en `utilise/occupe`, un `UsageEvent` s'ouvre. Quand elle repasse `libre`, il se ferme avec `duration_minutes`.

### MachineEditor (dropdown type)
Les `<select>` dans MachineEditor doivent avoir un fond explicite en dark mode — sinon texte blanc sur fond blanc. Vérifier la couleur de fond du `<select>` si le dropdown est illisible.

---

## Thème couleurs (actuel — professionnel neutre bleu)

Défini dans `index.css` via CSS custom properties :

```css
--bg-primary:     #0b0c0e      /* fond principal */
--bg-secondary:   #13151a      /* navbar, cards */
--bg-card:        rgba(255,255,255,0.04)
--accent-primary: #3b82f6      /* bleu (plus d'indigo/violet) */
--accent-dark:    #2563eb
--accent-glow:    rgba(59,130,246,0.2)
--text-main:      #e2e8f0
--text-muted:     #64748b
--border-color:   rgba(255,255,255,0.08)
```

**Éviter** toute couleur indigo/violet (`#6366f1`, `#818cf8`, `#a78bfa`, `#141420`, `#0d0d12`).

---

## Pins signalements sur GymPlanner

Les badges de signalement sont injectés en DOM pur dans `.grid-stack-item-content` (pas en JSX) car GridStack gère ses éléments en dehors du cycle React.
- `reportsRef` + `setPinModalRef` = refs pour accéder au state depuis les listeners DOM
- `.machine-pin.pin-{urgente|haute|normale|faible}` = classes CSS pour la couleur
- `matchesLabel` compare `report.machine` au `label` de la machine (case-insensitive)
- `refreshAllPins(reports)` doit être appelé après chaque chargement du plan ET quand les reports changent

---

## Commandes utiles

```bash
# Backend
cd backend && uvicorn main:app --reload

# Frontend
npm run dev

# Re-seed usage data
cd backend && python seed_usage.py

# Re-seed maintenance data
cd backend && python seed_data.py
```

---

## Gym de test

- **Nom** : Basic Fit Labège
- **gym_id** : 1
- **26 machines** réparties en 4 zones (Cardio, Musculation, Functional, Boxing/Stretching)
- **API Key** : voir `CONFIG.API_KEY` dans `src/constants/config.js`
