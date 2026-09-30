# Canal+ Watched Marker

Extension Chrome (Manifest V3) qui marque automatiquement les programmes déjà
regardés sur **canalplus.com** / **mycanal.fr**, sur le même principe que
*Netflix Watched Marker* ou *Disney Plus Watched Marker* :

- ✅ **Badge "vu"** (coche jaune + léger assombrissement) sur les vignettes
  entièrement regardées.
- 🖱️ **Marquage manuel** : survolez n'importe quelle vignette pour faire
  apparaître un bouton ✓ en haut à droite, cliquez pour marquer/démarquer
  instantanément un film ou une série déjà vue (utile pour tout ce que vous
  avez regardé avant d'installer l'extension).
- 📺 **Marquage par série** : sur les vignettes d'épisodes, un second bouton
  "Série" apparaît en haut à gauche au survol. Il marque tous les épisodes
  de la série comme vus en un clic — un marquage manuel sur un épisode
  précis reste toujours prioritaire (permet de "démarquer" une exception).
- 🙈 **Masquer les contenus vus** : réglage activable dans le popup, qui
  fait disparaître du catalogue les vignettes déjà marquées comme vues.
- 📊 **Barre de progression** sur les vignettes en cours de visionnage.
- ⚙️ Popup pour activer/désactiver le marquage, régler le seuil "vu" (par
  défaut 90 % de la vidéo) et effacer l'historique.
- 🔒 100 % local : les données sont stockées uniquement dans
  `chrome.storage.local`, rien n'est envoyé à un serveur externe.

## Installation (mode développeur)

1. Téléchargez/dézippez ce dossier.
2. Ouvrez `chrome://extensions` dans Chrome (ou Edge/Brave, compatibles
   Manifest V3).
3. Activez le **Mode développeur** (coin supérieur droit).
4. Cliquez sur **Charger l'extension non empaquetée** et sélectionnez le
   dossier `canalplus-watched-marker`.
5. Allez sur canalplus.com ou mycanal.fr, regardez un programme : il sera
   marqué automatiquement dès qu'un seuil de progression est atteint.

## Comment ça marche

- **content.js** surveille la balise `<video>` de la page de lecture,
  calcule `currentTime / duration`, et enregistre la progression associée à
  un identifiant de contenu extrait de l'URL (`extractContentId`).
- Sur les pages de catalogue/accueil/recherche, le script repère tous les
  liens `<a>` pointant vers une fiche/vidéo Canal+, retrouve la vignette
  associée (`findCardElement`) et y superpose un badge selon l'état stocké.
- Un `MutationObserver` + une interception de `history.pushState` gèrent le
  fait que Canal+ est une application React (SPA) qui charge le contenu
  dynamiquement sans recharger la page.

## ⚠️ Si le marquage ne s'affiche pas correctement

Canal+ étant une SPA dont les classes CSS sont générées automatiquement (et
peuvent changer après une mise à jour du site), deux fonctions dans
`content.js` sont prévues pour être ajustées si besoin, en vous aidant de
l'inspecteur DOM (F12) sur canalplus.com :

1. **`extractContentId(url)`** — doit produire un identifiant unique et
   stable par programme/épisode à partir de l'URL. Adaptez les regex si le
   format d'URL détecté diffère (ex. `/h/XXXX`, `/series/.../s1/e2`, etc.).
2. **`isContentLink(href)`** — filtre les `<a href>` considérés comme des
   liens vers un contenu (fiche/lecture). Élargissez ou resserrez le motif
   si des vignettes ne sont pas détectées ou si trop de liens non pertinents
   sont marqués.
3. **`findCardElement(anchor)`** — remonte dans le DOM depuis le lien pour
   trouver le conteneur visuel de la vignette (contenant une image). Si les
   badges apparaissent mal positionnés, augmentez/diminuez le nombre de
   niveaux parcourus (actuellement 6) ou ajoutez une condition plus précise.
4. **`extractSeriesId(url)`** — regroupe les épisodes d'une même série (basé
   sur les 2 premiers segments du chemin d'URL). Si le bouton "Série" marque
   les mauvais épisodes ensemble (ou pas assez), ajustez cette logique de
   regroupement selon le format d'URL réel des séries Canal+.
5. **`isEpisodeUrl(url)`** — détermine si une URL est un épisode (pour
   afficher le bouton "Série") via des mots-clés (`saison`, `episode`,
   `s1e2`...). Complétez la regex si des épisodes ne sont pas détectés.

## Structure des fichiers

```
canalplus-watched-marker/
├── manifest.json      # Déclaration de l'extension (MV3)
├── background.js      # Service worker (réglages par défaut, relais de messages)
├── content.js          # Suivi vidéo + marquage des vignettes
├── content.css          # Styles des badges superposés
├── popup.html/.css/.js  # Interface du popup (stats, réglages, reset)
└── icons/                # Icônes de l'extension
```

## Confidentialité

Aucune donnée n'est transmise à un serveur tiers. L'extension n'est pas
affiliée à Canal+/Vivendi/Groupe Canal+.


## 1.5.2
- Correction du positionnement des badges sur les grilles et carrousels CANAL+.
- L’overlay est désormais ancré au bloc visuel de la vignette plutôt qu’au wrapper de lien.


### 1.5.2
- Correction du positionnement des overlays sur la grille « Tous les films ».
- L’overlay suit désormais exactement le rectangle de l’image, même quand le conteneur CANAL+ est plus large.


## v1.5.4

- Correction CANAL+ "Tous les films" : lorsqu'une carte contient plusieurs images (affiche + logos/badges), l'extension utilise désormais la plus grande image visible comme référence pour l'overlay.
- Évite les badges "DÉJÀ VU" tronqués ou collés au bord gauche.
