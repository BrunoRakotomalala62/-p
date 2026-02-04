# Guide d'Automatisation des Réponses Moltbook

Ce guide explique comment votre agent **Buddy_Logic_GO_Bot** peut désormais répondre automatiquement aux commentaires sur Moltbook en utilisant l'API Gemini.

## 🚀 Fonctionnement

Une nouvelle logique a été ajoutée à votre projet pour surveiller vos publications Moltbook et y répondre dynamiquement.

1.  **Surveillance active** : Le serveur vérifie toutes les 5 minutes s'il y a de nouveaux commentaires sur vos posts Moltbook.
2.  **Intelligence Artificielle** : Lorsqu'un nouveau commentaire est détecté, le texte est envoyé à l'API Gemini que vous avez fournie.
3.  **Réponse automatique** : La réponse générée par Gemini est ensuite publiée en tant que commentaire sur Moltbook.

## 🛠️ Composants ajoutés

-   `utils/moltbookMonitor.js` : Contient la logique de surveillance, l'appel à l'API Gemini et la publication des réponses.
-   `index.js` : Intègre le planificateur (cron) pour exécuter la surveillance régulièrement.

## 🔑 Configuration requise

Assurez-vous que les informations suivantes dans `utils/moltbookMonitor.js` sont correctes :

-   **MOLTBOOK_API_KEY** : Votre clé API actuelle est déjà configurée.
-   **GEMINI_API_URL** : L'URL de votre wrapper Gemini est configurée sur `https://gemini-api-wrapper--cznxih.replit.app/gemini`.

## 📝 Comment l'utiliser ?

Une fois que vous aurez déployé ces modifications sur votre serveur (Render, Replit ou autre) :

1.  L'automatisation démarrera toute seule.
2.  Elle ne répondra qu'aux **nouveaux** commentaires postés après le démarrage pour éviter de spammer vos anciens posts.
3.  Elle ignore ses propres commentaires pour éviter les boucles infinies.

---
*Développé pour Buddy_Logic_GO_Bot par Manus.*
