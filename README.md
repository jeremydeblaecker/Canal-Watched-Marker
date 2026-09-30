# Canal+ Watched Marker

<img width="1915" height="850" alt="Canal+ Watched Marker" src="https://github.com/user-attachments/assets/97bff443-2fe2-4085-a175-8da394d610a5" />

Extension **Firefox (Manifest V3)** qui marque les programmes déjà regardés sur **CANAL+ / myCANAL**.

Version actuelle : **1.5.4**

## Fonctionnalités

- ✅ Badge **« Déjà vu »** sur les films et épisodes marqués comme regardés.
- 🖱️ Marquage manuel depuis les vignettes grâce au bouton ✓ au survol.
- 📺 Marquage d'une série entière pour les contenus détectés comme épisodes.
- 📊 Suivi de progression pendant la lecture et marquage automatique au-delà du seuil configuré.
- 🙈 Option permettant de masquer les contenus déjà vus.
- 📥 Import d'un historique JSON provenant d'une ancienne installation.
- 🟣 Import des films vus depuis une base Notion exportée en **CSV ou JSON**.
- 💾 Export / restauration des données locales.
- 🔒 Données conservées localement dans `browser.storage.local`.

Les données issues de Notion sont stockées séparément de l'historique CANAL+ afin de pouvoir les remplacer sans supprimer les contenus suivis directement par l'extension.

## Compatibilité

- Firefox **140 ou version ultérieure**
- `canalplus.com`
- `mycanal.fr`

Identifiant Firefox stable :

```text
canalplus-watched-marker@jeremy.local
```

Conserver cet identifiant lors des mises à jour permet à Firefox de rattacher l'extension à son stockage local existant.

## Installation en mode développeur

1. Télécharge ou clone le dépôt.
2. Ouvre Firefox.
3. Va sur :

```text
about:debugging#/runtime/this-firefox
```

4. Clique sur **Charger un module complémentaire temporaire…**.
5. Sélectionne `manifest.json`.
6. Ouvre CANAL+ et recharge la page si nécessaire.

Une extension chargée temporairement doit être rechargée après un redémarrage de Firefox.

### Mise à jour sans perdre les données

Ne supprime pas l'extension avant une mise à jour.

Remplace les fichiers dans le dossier local, puis utilise **Recharger** dans `about:debugging`. Le `browser.storage.local` reste ainsi associé au même identifiant Gecko.

## Import Notion

La base Notion peut contenir notamment les colonnes :

- `Titre`
- `Titre originel` / `Titre original`
- `Année`
- `Vu`

Dans le popup de l'extension, utilise **Importer les films vus de Notion** puis sélectionne le CSV ou JSON exporté.

L'importeur reconnaît notamment comme valeurs vues :

```text
Yes
Oui
true
1
Vu
__YES__
✓
✔
☑
```

La correspondance avec CANAL+ utilise le titre français ou le titre original normalisé. L'année est utilisée lorsqu'elle est disponible.

Voir aussi [NOTION.md](NOTION.md).

## Import d'un historique JSON

L'import JSON permet de restaurer un historique provenant des précédentes versions du Watched Marker.

Voir :

- [IMPORT_JSON.md](IMPORT_JSON.md)
- [MIGRATION.md](MIGRATION.md)

## Fonctionnement

### Suivi de lecture

`content.js` surveille les balises `<video>`, calcule la progression puis enregistre l'état du programme dans `watchedItems`.

Le seuil par défaut est de **90 %** et peut être modifié depuis le popup.

### Détection des vignettes

CANAL+ étant une SPA React, les classes CSS peuvent changer. La détection ne dépend donc pas uniquement de classes fixes.

Le script :

1. détecte les liens correspondant à des contenus ;
2. recherche la plus grande image visible du lien ;
3. associe cette image à une seule vignette ;
4. ajoute un overlay exactement dimensionné sur cette image ;
5. déduplique les overlays lorsque plusieurs liens CANAL+ pointent vers la même vignette.

Cette logique est notamment nécessaire sur la page **Tous les films**, où une carte peut contenir plusieurs images ou plusieurs liens vers le même programme.

### Navigation dynamique

Un `MutationObserver` et le suivi des changements d'URL relancent la détection lorsque CANAL+ charge de nouveaux éléments sans rechargement complet de la page.

## Structure

```text
Canal-Watched-Marker/
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── background.js
├── content.js
├── content.css
├── import.html
├── import.js
├── import.css
├── notion.js
├── popup.html
├── popup.js
├── popup.css
├── manifest.json
├── README.md
├── README_FIREFOX.md
├── NOTION.md
├── IMPORT_JSON.md
├── MIGRATION.md
└── CHANGELOG.md
```

## Développement

Il n'y a pas de dépendances npm nécessaires pour exécuter l'extension.

Les fichiers JavaScript peuvent être vérifiés avec :

```bash
node --check background.js
node --check content.js
node --check import.js
node --check notion.js
node --check popup.js
```

Et le manifeste avec :

```bash
python -m json.tool manifest.json
```

GitHub Actions exécute automatiquement ces vérifications sur les pushes et pull requests.

## Limites connues

Le DOM de CANAL+ peut évoluer sans préavis. Si une future mise à jour du site change la structure des cartes, les fonctions de détection dans `content.js` pourront nécessiter un ajustement.

## Versions

L'historique des versions est disponible dans [CHANGELOG.md](CHANGELOG.md).

## Confidentialité

Aucune donnée de visionnage n'est envoyée par l'extension vers un serveur tiers. Les historiques CANAL+ et Notion importés sont enregistrés dans le stockage local de Firefox.

## Avertissement

Ce projet est indépendant et n'est pas affilié à CANAL+, myCANAL, Vivendi ou Groupe Canal+.
