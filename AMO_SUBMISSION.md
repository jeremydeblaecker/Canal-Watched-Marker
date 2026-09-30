# Publication sur Firefox Add-ons (AMO)

Ce document prépare la première publication publique de **Canal+ Watched Marker** sur addons.mozilla.org.

## Canal de distribution

Choisir **On this site / Sur ce site** afin que l'extension soit listée publiquement sur AMO et que Firefox puisse distribuer automatiquement les futures mises à jour.

## Fichier à envoyer

Utiliser l'archive produite par la Release GitHub :

```text
Canal-Watched-Marker-v1.6.0.xpi
```

Le paquet contient uniquement les fichiers nécessaires à l'exécution de l'extension. Le `manifest.json` est placé à la racine de l'archive.

## Informations de la fiche

### Nom

```text
Canal+ Watched Marker
```

### Résumé

```text
Marque les films, séries et programmes déjà vus sur CANAL+ / myCANAL et permet d'importer son historique local ou sa filmothèque Notion.
```

### Description

```text
Canal+ Watched Marker ajoute des indicateurs visuels aux vignettes CANAL+ / myCANAL afin d'identifier facilement les contenus déjà regardés.

Fonctionnalités :
- badge « Déjà vu » sur les contenus regardés ;
- marquage manuel depuis les vignettes ;
- suivi local de la progression de lecture ;
- marquage d'une série lorsque la structure du contenu le permet ;
- import d'un historique JSON ;
- import d'une filmothèque Notion au format CSV ou JSON ;
- option permettant de masquer les contenus déjà vus ;
- sauvegardes locales avant certaines opérations sensibles.

Toutes les données sont stockées localement dans Firefox. L'extension n'utilise pas de service d'analyse, ne charge pas de code distant et ne transmet pas l'historique de visionnage.
```

### Site d'assistance

```text
https://github.com/jeremydeblaecker/Canal-Watched-Marker
```

### Suivi des problèmes

```text
https://github.com/jeremydeblaecker/Canal-Watched-Marker/issues
```

## Confidentialité

L'extension déclare :

```json
"data_collection_permissions": {
  "required": ["none"]
}
```

Elle ne transmet pas de données hors du navigateur. Le détail est disponible dans [PRIVACY.md](PRIVACY.md).

## Notes pour les reviewers AMO

```text
Canal+ Watched Marker is a Firefox Manifest V3 extension for canalplus.com and mycanal.fr.

There is no remote code, minified code, bundler output, analytics SDK, or third-party JavaScript library.

The extension uses:
- storage: to keep watched/progress state, aliases, local backups, settings, and locally imported Notion data.
- activeTab: the popup can read/mark the currently active CANAL+ page after the user explicitly opens the extension.
- host permissions for canalplus.com and mycanal.fr: content scripts add watched overlays to catalog cards and observe local video playback progress.

CSV/JSON files selected by the user are parsed entirely locally. No file contents or viewing history are uploaded.

The source in the submitted XPI is the readable project source; no build/minification step is required to inspect it.
```

## Licence

AMO demande de sélectionner une licence pour la fiche. Ce choix doit être fait par le propriétaire du projet avant la soumission finale.

## Après la première publication

Pour chaque nouvelle version :

1. incrémenter `manifest.json.version` ;
2. mettre à jour `CHANGELOG.md` ;
3. fusionner le changement sur `master` avec un commit de release ;
4. récupérer le nouvel XPI depuis GitHub Releases ;
5. l'envoyer comme nouvelle version depuis la page AMO existante de l'extension.
