# Canal+ Watched Marker — version Firefox

Cette variante est adaptée à **Firefox 140 ou plus récent**.

## Changements effectués

- remplacement du service worker Chromium (`background.service_worker`) par un script d’arrière-plan Firefox (`background.scripts`) ;
- utilisation de l’API WebExtensions `browser.*` et de ses Promises ;
- ajout de la permission `activeTab` pour lire et marquer l’onglet Canal+ actif depuis le popup ;
- ajout d’un identifiant Gecko requis pour signer une extension Manifest V3 ;
- déclaration Firefox indiquant qu’aucune donnée n’est collectée ou transmise hors du navigateur.

## Tester temporairement dans Firefox

1. Décompressez l’archive.
2. Dans Firefox, ouvrez `about:debugging#/runtime/this-firefox`.
3. Cliquez sur **Charger un module complémentaire temporaire…**.
4. Sélectionnez le fichier `manifest.json` du dossier décompressé.
5. Ouvrez ou rechargez une page `canalplus.com` ou `mycanal.fr`.
6. Épinglez éventuellement l’extension dans la barre d’outils afin d’accéder à son popup.

L’installation temporaire disparaît au redémarrage de Firefox.

## Développement avec web-ext

Installez Node.js, puis dans le dossier de l’extension :

```bash
npm install --global web-ext
web-ext lint
web-ext run
```

`web-ext run` démarre un profil Firefox temporaire avec l’extension chargée et recharge automatiquement l’extension après les modifications.

## Installation permanente / distribution

Firefox stable exige normalement une extension signée :

1. créez un compte développeur Mozilla ;
2. envoyez le ZIP sur le portail Add-ons Mozilla, soit pour publication sur AMO, soit en auto-distribution ;
3. téléchargez ensuite le fichier `.xpi` signé ;
4. ouvrez ce `.xpi` dans Firefox pour installer durablement l’extension.

Pour préparer le ZIP avec `web-ext` :

```bash
web-ext lint
web-ext build --overwrite-dest
```

Le fichier à envoyer se trouvera dans `web-ext-artifacts/`.

## Débogage

- Extension : `about:debugging#/runtime/this-firefox`, puis **Inspecter**.
- Script injecté dans Canal+ : ouvrez les outils de développement de la page et consultez la console ; les logs commencent par `[CPWM]`.
- Après chaque changement manuel, cliquez sur **Recharger** dans `about:debugging`, puis rechargez la page Canal+.
