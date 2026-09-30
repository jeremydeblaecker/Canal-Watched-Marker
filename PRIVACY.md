# Politique de confidentialité — Canal+ Watched Marker

**Dernière mise à jour : 30 septembre 2026**

Canal+ Watched Marker fonctionne localement dans Firefox.

## Données traitées

L'extension peut enregistrer localement :

- les identifiants et URL des contenus CANAL+ / myCANAL reconnus ;
- leur état « vu » et leur progression de lecture ;
- les réglages de l'extension ;
- les informations de films importées volontairement depuis un fichier CSV ou JSON Notion ;
- des sauvegardes locales de ces données avant certaines opérations sensibles.

## Transmission de données

**Aucune de ces données n'est transmise par l'extension à un serveur externe.**

L'extension :

- n'utilise pas de service d'analyse ou de télémétrie ;
- n'utilise pas de publicité ;
- ne vend ni ne partage les données de l'utilisateur ;
- ne charge pas de code JavaScript distant ;
- ne transmet pas les fichiers CSV ou JSON importés.

## Stockage

Les données sont enregistrées dans le stockage local de l'extension via `browser.storage.local`.

Elles restent sur le profil Firefox de l'utilisateur jusqu'à leur suppression par l'utilisateur, la suppression des données du navigateur ou la désinstallation de l'extension selon le comportement de Firefox.

## Permissions

Les permissions d'accès à `canalplus.com` et `mycanal.fr` sont utilisées uniquement pour détecter les vignettes de contenus, afficher les marqueurs et suivre localement la progression des vidéos.

La permission `activeTab` est utilisée lorsque l'utilisateur ouvre le popup afin de pouvoir identifier et marquer explicitement la page CANAL+ active.

## Contact et code source

Le code source et le suivi des problèmes sont disponibles sur :

https://github.com/jeremydeblaecker/Canal-Watched-Marker
