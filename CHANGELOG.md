# Changelog

Toutes les modifications notables de **Canal+ Watched Marker** sont documentées ici.

## [1.5.4] - 2026-09-30

- Déduplication des overlays lorsque plusieurs liens CANAL+ correspondent à une même vignette.
- Suppression des couches « Déjà vu » en double déjà présentes sur un même hôte.
- Correction de l'affichage du bouton ✓ au survol lorsque CANAL+ fournit déjà un conteneur positionné.

## [1.5.3] - 2026-09-30

- Sélection de la plus grande image visible d'une carte comme référence d'overlay.
- Correction des cartes contenant plusieurs images, logos ou badges.

## [1.5.2] - 2026-09-30

- Positionnement de l'overlay sur le rectangle exact de l'image.
- Correction du décalage horizontal observé dans la grille « Tous les films ».

## [1.5.1] - 2026-09-29

- Ancrage de l'overlay sur le bloc visuel de la vignette plutôt que sur un wrapper CANAL+ instable.

## [1.5.0] - 2026-09-29

- Ajout de l'import des films vus depuis Notion en CSV ou JSON.
- Stockage séparé des données Notion dans `notionWatched`.
- Correspondance basée sur le titre, le titre original et l'année lorsqu'elle est disponible.
