# Documentation ContractGen IT - AWB Legal Engine

## Présentation Générale
**ContractGen IT** est une application web de génération déterministe de contrats informatiques. Elle permet aux directions juridiques et achats de produire des contrats cadres et spécifiques en répondant à un questionnaire qualitatif.

L'application s'appuie sur une bibliothèque de clauses (articles) stockée dans Firebase, avec un moteur de règles permettant d'inclure ou d'exclure des clauses en fonction du type de projet (SaaS, Licence, Régie, etc.) et d'autres paramètres critiques (données sensibles, hébergement externe).

## Architecture Technique

### Stack Technologique
- **Frontend** : React 19, TypeScript
- **Build Tool** : Vite
- **Styling** : Tailwind CSS 4.0
- **Animations** : Framer Motion (Motion)
- **Base de données & Auth** : Firebase (Firestore & Authentication)
- **Génération de Documents** : docxtemplater, PizZip, file-saver
- **Icônes** : Lucide React

### Structure du Projet
- `src/App.tsx` : Point d'entrée, gestion de l'authentification et du routage.
- `src/pages/Wizard.tsx` : Interface utilisateur pour la génération de contrats (Questionnaire + Aperçu).
- `src/pages/Admin.tsx` : Interface d'administration pour la gestion des clauses et des règles.
- `src/utils/exportWord.ts` : Moteur de génération de fichiers Word (.docx / .doc).
- `src/firebase.ts` : Configuration et initialisation de Firebase.
- `src/types.ts` : Définitions des types TypeScript pour les Sections et Articles.

## Fonctionnalités Clés

### 1. Assistant de Génération (Wizard)
L'assistant guide l'utilisateur à travers trois étapes :
1. **Qualification** : Choix du type de projet et des options critiques (Hébergement, Données sensibles, Développements spécifiques).
2. **Paramétrage** : Saisie des variables dynamiques requises par les clauses sélectionnées (Noms, Montants, Délais).
3. **Validation & Export** : Aperçu en temps réel du contrat assemblé et export vers Microsoft Word.

### 2. Moteur de Règles Déterministe
Chaque article de la bibliothèque peut être configuré avec une règle d'inclusion :
- **ALWAYS_INCLUDE** (Tronc Commun) : L'article est présent dans tous les contrats.
- **CONDITIONAL** (Conditionnel) : L'article n'est inclus que si une condition spécifique est remplie (ex: `ProjectType == 'SaaS'`).

### 3. Gestion des Variables Dynamiques
Le système supporte l'injection de variables dans le corps des clauses via la syntaxe `{{NOM_VARIABLE}}`. Le Wizard extrait automatiquement ces variables des clauses sélectionnées pour générer le formulaire de saisie.

### 4. Administration Juridique
L'espace Admin permet aux experts juridiques de :
- Créer et ordonner les sections du contrat.
- Rédiger les clauses et définir leurs règles d'inclusion.
- Importer des catalogues de clauses complets au format JSON (compatible ISO 37001).
- Gérer l'ordre d'apparition des articles pour garantir la cohérence structurelle.

## Sécurité et Accès
- **Authentification** : Utilisation de Google Auth via Firebase.
- **Autorisations** : Les droits d'administration sont vérifiés via une collection `admins` dans Firestore.
- **Règles Firestore** : Des règles de sécurité strictes (`firestore.rules`) garantissent que seuls les administrateurs peuvent modifier la bibliothèque de clauses.

## Installation et Déploiement
Voir le fichier [README.md](README.md) pour les instructions de base.

### Variables d'Environnement
L'application nécessite les clés Firebase suivantes dans un fichier `.env` :
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_GEMINI_API_KEY` (Optionnel pour les futures extensions IA)
