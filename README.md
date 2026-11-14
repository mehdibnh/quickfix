# QuickFix Tunisia

Application web progressive Next.js, pensée d'abord pour mobile, qui met en relation clients et artisans de proximité.

## Démarrage

1. Installer Node.js 20.9 ou supérieur.
2. Copier `.env.example` vers `.env.local` et y renseigner l'URI de votre base MongoDB ainsi que `OPENAI_API_KEY` pour activer l'assistant IA.
3. Installer les dépendances avec `npm install`.
4. Lancer l'application avec `npm run dev`, puis ouvrir [http://localhost:3000](http://localhost:3000).

La connexion à MongoDB est centralisée dans `src/lib/mongodb.ts`. Les modèles Mongoose du domaine QuickFix se trouvent dans `src/models/`. La route `GET /api/health/db` vérifie la connexion sans exposer l'URI. La route `GET /api/artisans` renvoie les profils vérifiés sans leurs coordonnées privées.

Ne partagez pas votre URI MongoDB dans le chat et ne la commitez jamais. Gardez-la dans `.env.local`, un fichier ignoré par Git.

QuickFix peut être installé comme application web progressive (PWA) depuis un navigateur compatible. Le déploiement doit utiliser HTTPS. Sur Android, utilisez le menu du navigateur ou le bouton « Installer l’app » ; sur iPhone/iPad, ouvrez le site dans Safari, appuyez sur « Partager », puis « Sur l’écran d’accueil ».

L’assistant IA, disponible depuis l’accueil, aide à orienter le client vers une filière artisanale. Il utilise l’API OpenAI côté serveur ; la clé `OPENAI_API_KEY` ne doit jamais être exposée dans le navigateur ou partagée. Les conversations ne sont pas enregistrées dans la base QuickFix. Évitez de saisir des informations personnelles ; les messages sont envoyés à OpenAI pour générer une réponse. Sans clé, l’interface affiche une erreur de configuration.

## Créer un compte artisan

Les clients peuvent créer un compte depuis le site. Les artisans se connectent avec leur compte après création par `npm run create:artisan`. Cette commande demande les informations dans le terminal, masque le mot de passe et crée chaque compte ainsi que son profil dans une transaction. Après chaque artisan, choisissez si vous souhaitez en saisir un autre. Utilisez uniquement les informations de personnes ayant donné leur accord. Chaque profil reste en attente de vérification ; seuls les profils vérifiés apparaissent sur le site. Les comptes connectés peuvent changer leur mot de passe dans l’onglet Profil ; les autres sessions sont alors révoquées.

Créez un compte administrateur depuis le terminal avec `npm run create:admin`. Le mot de passe est masqué et n'est jamais demandé par une route publique. Connectez-vous ensuite normalement : l'onglet Administration contient les pages « Vérification » et « Gestion des artisans ». La première permet d'approuver les profils en attente ou de les refuser avec un motif. La seconde permet de créer, modifier, désactiver et réactiver les comptes artisans. Un compte créé par l'administration reçoit un mot de passe temporaire, affiché une seule fois ; l'artisan doit le changer dans son profil avant d'utiliser les fonctions de l'application. La désactivation conserve les demandes et l'historique, mais masque le profil.

Les clients connectés peuvent envoyer une demande à un artisan disponible ; les artisans connectés peuvent consulter leurs demandes, les accepter ou les refuser, puis suivre leur avancement. Un client peut annuler une demande en attente ou acceptée. Les adresses d'intervention ne sont accessibles qu'aux deux participants.

## Périmètre initial

- Interface client responsive avec recherche et catégories de services.
- Comptes clients et artisans avec sessions HTTPOnly, inscription/connexion/déconnexion.
- Tableau d'administration protégé par rôle pour vérifier et gérer les profils artisans.
- Assistant IA optionnel pour orienter un client vers une catégorie d’artisan.
- Demandes de service persistantes avec contrôle des rôles et transitions de statut.
- Consultation des profils d'artisans vérifiés depuis MongoDB et filtres de disponibilité/note.
- Manifest, icône et service worker avec cache hors ligne de la page d'accueil.
- Installation PWA avec guide adapté à iOS et aux autres navigateurs mobiles.
- Modèles MongoDB pour les comptes, profils artisans, demandes et leur historique, avis, signalements et notifications.

La messagerie, les paiements, les avis, les notifications et les procédures de récupération de compte restent à développer. Avant une mise en production publique, ajouter notamment la vérification d'adresse e-mail, la récupération de mot de passe, une politique anti-abus, et les vérifications légales et opérationnelles nécessaires.
