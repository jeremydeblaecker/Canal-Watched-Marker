# Import JSON Canal+ — v1.4.1

Cette version convertit automatiquement les identifiants techniques comme
`43019292_50889` vers la clé locale `h:43019292_50889`, afin qu'ils correspondent
aux liens Canal+ de forme `/h/43019292_50889`.

Après une mise à jour depuis la v1.4.0, il faut réimporter le même JSON. Les
anciennes clés sans préfixe peuvent rester dans le stockage sans empêcher le
fonctionnement.
