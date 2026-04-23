<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AWB Legal Engine - ContractGen IT

**ContractGen IT** est une plateforme intelligente de génération de contrats informatiques bancaires. Elle automatise la création de documents contractuels complexes (SaaS, Maintenance, Acquisition, etc.) en s'appuyant sur un moteur de règles juridiques déterministes.

## 🚀 Fonctionnalités
- 📝 **Génération Guidée** : Questionnaire dynamique pour qualifier le besoin.
- ⚙️ **Moteur de Règles** : Inclusion intelligente de clauses selon le contexte du projet.
- 🔍 **Aperçu Temps Réel** : Visualisation instantanée du contrat assemblé.
- 📂 **Export Word** : Génération de fichiers `.docx` compatibles avec les standards bancaires.
- 🔐 **Admin Panel** : Gestion complète de la bibliothèque de clauses et des conditions d'inclusion.

## 📚 Documentation
Pour plus de détails sur l'architecture technique et le fonctionnement du moteur, consultez la [Documentation Détaillée](DOCUMENTATION.md).

## 🛠️ Installation

### Prérequis
- Node.js (v18+)
- Compte Firebase

### Configuration
1. Clonez le dépôt.
2. Installez les dépendances :
   ```bash
   npm install
   ```
3. Configurez vos variables d'environnement dans un fichier `.env` (voir `.env.example`).
4. Lancez le serveur de développement :
   ```bash
   npm run dev
   ```

## 🏗️ Structure du Projet
- `/src/pages/Wizard.tsx` : Interface de génération.
- `/src/pages/Admin.tsx` : Gestion des clauses.
- `/src/utils/exportWord.ts` : Moteur d'exportation.
- `/firestore.rules` : Sécurité de la base de données.

---
*Développé pour l'automatisation des processus juridiques IT.*
