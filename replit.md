# Overview

This is a Facebook Messenger bot built with Node.js and Express that provides an intelligent conversational assistant with multiple AI capabilities. The bot integrates various AI models (Gemini, Claude, GPT-4, DeepSeek, etc.) and offers features including multilingual translation, web search, biblical verse lookup, dictionary services, image generation, and content analysis. It's designed to handle user subscriptions with expiration dates and supports continuous conversations with context retention.

# Recent Changes

**December 4, 2025 - Nouvelle Commande VIP Livre (Bibliothèque PDF)**
- Nouvelle commande VIP `livre` pour accéder à une bibliothèque de livres PDF gratuits
- API utilisée: `https://livre-pdf-gratuit.vercel.app/livres`
- Fonctionnalités :
  - Affichage de 5 livres par page avec titre et image en pièce jointe
  - Navigation par pages: `page 2`, `page 3`, etc.
  - Téléchargement en envoyant le numéro du livre (1-5)
  - Logique d'envoi intelligente :
    - PDF < 25 Mo: envoi direct en pièce jointe Messenger
    - PDF > 25 Mo: envoi du lien de téléchargement cliquable
  - Gestion des sessions utilisateurs pour la sélection
- Commandes disponibles:
  - `livre` - Affiche les 5 premiers livres
  - `page X` - Va à la page X
  - `1-5` - Télécharge le livre correspondant
  - `livre aide` - Affiche le guide d'utilisation

**December 4, 2025 - Ajout Matière Anglais dans la Commande Education**
- Ajout de la matière "Anglais" dans la liste des matières disponibles pour la commande VIP `education`
- Emoji: 🇬🇧, Aliases: ang, english, eng
- Séries disponibles pour Anglais :
  - Série A (1999-2022)
  - Série C-D (1999-2023) 
  - Série A-C-D (Remplacement 2000-2002)
  - Série OSE (2022)
- Exemples d'utilisation :
  - `education anglais A 2017` - Anglais série A, année 2017
  - `education anglais C sujet` - Sujets Anglais série C-D
  - `education anglais OSE` - Anglais série OSE
- Mise à jour de l'aide avec les nouvelles séries supportées (ACD, CD)
- API utilisée: `https://pdf-0r0j.onrender.com/recherche?pdf=anglais&serie=<SERIE>&type=sujet&annee=<ANNEE>`

**December 3, 2025 - Amélioration Commande Clip Dailymotion**
- Suppression du paramètre `qualite` de l'URL de téléchargement (qualité par défaut de l'API)
- Suppression de l'utilisation du dossier temporaire `/tmp/clips`
- Téléchargement en mémoire (Buffer) au lieu du disque
- Envoi direct à Facebook Messenger via FormData avec Readable stream
- Logique d'envoi améliorée :
  1. Téléchargement en mémoire (Buffer)
  2. Vérification de la taille (< 25 MB)
  3. Envoi direct via FormData avec stream
  4. Lien de téléchargement si l'envoi échoue
- Compatible avec les environnements serverless (Vercel, etc.)
- Endpoints API utilisés : `/recherche?clip=<query>`, `/download?video=<URL>&type=<MP3|MP4>`, `/videoinfo?video=<id>`

**December 2, 2025 - Commande Clip Dailymotion**
- Nouvelle commande VIP `clip` pour rechercher et télécharger des clips Dailymotion
- Utilise l'API externe `https://clip-dai.onrender.com/`
- Fonctionnalités :
  - Recherche de clips par mots-clés (`clip <recherche>`)
  - Affichage des résultats avec titre, durée, taille estimée et image
  - Sélection interactive en plusieurs étapes :
    1. Envoi du numéro de la vidéo (1-10)
    2. Choix du format (MP3 ou MP4)
  - Envoi automatique du fichier en pièce jointe (si < 25 MB)
  - Envoi du lien de téléchargement dynamique dans tous les cas
  - Gestion des sessions utilisateurs pour le flux de sélection
- Endpoints API utilisés : `/recherche`, `/download`, `/videoinfo`

**November 26, 2025 - Système de Commandes VIP**
- Nouveau répertoire `VIP/` pour les commandes réservées aux membres VIP
- La commande `x` (recherche vidéo) est maintenant une commande VIP exclusive
- Fichier `FacebookVip/uidvip.txt` pour gérer les abonnements VIP
- Nouveau module `utils/vipSubscription.js` pour la gestion des statuts VIP
- Fonctionnalités :
  - Vérification du statut VIP avant l'exécution des commandes VIP
  - Les administrateurs ont automatiquement accès VIP
  - Notification automatique lors de l'expiration du statut VIP
  - Correspondance exacte des commandes (évite les conflits de préfixe)
  - Sessions VIP persistantes avec gestion d'état propre
- Priorité de traitement des commandes :
  1. Commandes VIP détectées (si utilisateur VIP)
  2. Sessions VIP actives
  3. Commandes normales détectées
  4. Sessions normales actives
  5. Fallback vers Gemini

**November 26, 2025 - Amélioration Commande X avec Qualité 360p**
- Ajout de la fonctionnalité d'envoi direct de vidéo MP4 en qualité 360p
- Logique de taille intelligente :
  - Si la vidéo 360p < 24 Mo : envoi direct du fichier MP4 dans Messenger
  - Si la vidéo 360p > 24 Mo : envoi du lien de téléchargement dynamique
- Nouvelle route `/download/:id?slug=video&quality=360` pour les téléchargements dynamiques
- Fonctions utilitaires ajoutées :
  - `getVideoSize()` : récupère la taille du fichier via requête HEAD
  - `getBaseUrl()` : génère l'URL de base dynamique (Replit ou localhost)
- Messages utilisateur améliorés avec indication de la taille et qualité

**November 26, 2025 - Commande X Video Search & Download**
- Ajout de la commande `x` pour rechercher et télécharger des vidéos
- Utilise l'API externe `https://scraping-video.vercel.app/`
- Fonctionnalités :
  - Recherche de vidéos par mots-clés (`x <recherche>`)
  - Affichage de la liste des résultats avec image de couverture
  - Téléchargement en envoyant le numéro de la vidéo (1-10)
  - Gestion des sessions utilisateurs pour la sélection
  - Support de la pagination
  - Lien de téléchargement alternatif pour les vidéos volumineuses
- Endpoints API utilisés : `/recherche`, `/video/:id`, `/stream`, `/download/:id`

**November 21, 2025 - Système de Génération Automatique de Commandes IA**
- Ajout de la commande `commandstore` pour créer automatiquement des commandes IA personnalisées
- Génération de code à partir d'une URL API fournie par l'utilisateur
- Support optionnel de l'analyse d'images dans les commandes générées
- Validation stricte des entrées utilisateur (noms de commandes et URLs)
- Sanitization des entrées pour prévenir l'injection de code
- Template robuste gérant plusieurs formats de réponse API
- Documentation complète dans `COMMANDSTORE_GUIDE.md`
- Caractéristiques des commandes générées :
  - Conversation continue avec contexte utilisateur
  - Formatage avancé avec texte en gras Unicode
  - Division automatique des messages longs
  - Gestion d'erreurs robuste
  - Support optionnel des images
- Commandes de contrôle : `stop` (désactiver), `supprimer` (réinitialiser)
- Nécessite un redémarrage du bot pour activer les nouvelles commandes

**November 17, 2025 - Support Multi-Images pour la Commande Nano**
- Ajout de la capacité d'envoyer et traiter plusieurs images simultanément (2, 3, 4+ photos)
- Conservation de l'ordre des images : 1ère, 2ème, 3ème, etc.
- Construction dynamique de l'URL API avec `imageurl`, `imageurl2`, `imageurl3`, etc.
- Messages adaptatifs selon le nombre d'images reçues
- Support de transformations complexes : face swap, collage, fusion, montage, etc.
- Exemples de scénarios documentés dans `EXEMPLES_NANO_MULTIPLES_IMAGES.md`
- L'API peut maintenant traiter des commandes comme "changer le visage de la 1ère photo par celui de la 2ème"

**November 13, 2025 - Automatic CAPTCHA Resolution for Facebook Account Creation**
- Integrated CapSolver API for automatic CAPTCHA solving in `fbcreate` command
- Added Puppeteer for browser automation to handle Facebook login checkpoints
- Implemented `solveCaptchaWithCapSolver()` function that:
  - Downloads CAPTCHA images from URLs and converts to base64
  - Extracts clean base64 from data URLs (strips prefixes)
  - Sends images to CapSolver API and polls for solutions
  - Includes comprehensive error logging with errorId and errorCode
- Implemented `loginToFacebookAndSolveCaptcha()` function that:
  - Launches headless browser with anti-detection settings
  - Detects CAPTCHA challenges after login
  - Captures CAPTCHA images via multiple methods (screenshot, src extraction)
  - Automatically fills and submits CAPTCHA solutions
  - Verifies account is fully accessible after CAPTCHA resolution
- Modified `fbcreate` workflow to automatically verify accounts post-creation
- Accounts now show status "Vérifié et Prêt ✅✅" when fully verified
- Requires `CAPSOLVER_API_KEY` environment variable (stored securely in Replit Secrets)

**November 9, 2025 - Image Processing for Vercel Deployment**
- Fixed image processing issue on Vercel by implementing cloud-based image hosting
- Added `uploadImageToCatbox()` function that downloads Facebook Messenger images to memory and uploads them to catbox.moe (free hosting service without API key requirement)
- Modified `handleImageMessage()` to use public image URLs instead of local file storage
- Implemented robust error handling with URL validation and size limit removal for large images
- Solution is fully compatible with Vercel's serverless environment (no local file persistence required)

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Backend Architecture

**Framework**: Express.js server running on Node.js 14+
- REST API endpoints for Facebook Messenger webhook integration
- Modular command system with individual command files in `/commands` directory
- Centralized message handling through `/handles/handleMessage.js` and `/handles/handlePostback.js`
- Session management using in-memory Map objects for conversation history

**Key Design Patterns**:
- Command pattern: Each bot command is a separate module with standardized exports
- Middleware chain: Body-parser, JSON, and URL-encoded parsers for request handling
- File upload handling via Multer with memory storage (10MB limit)

**Conversation Management**:
- User sessions stored per command in memory using `Map()` or plain objects
- Conversation history tracked by sender ID to maintain context across interactions
- Image attachments temporarily stored pending user questions

## Frontend Architecture

**Interface**: Facebook Messenger Platform
- Webhook verification using `VERIFY_TOKEN`
- Message reactions API integration for user engagement
- Support for text, image, audio, and file attachments
- Multi-part message sending for long responses (2000 character chunks)

## External Dependencies

**AI Services**:
- Google Generative AI (`@google/generative-ai`) - Gemini models
- Claude API via `rapido.zetsu.xyz` and `haji-mix-api.gleeze.com`
- GPT-4 via custom endpoints
- DeepSeek API for additional AI capabilities
- Mixtral models for specialized queries

**Third-Party APIs**:
- Facebook Graph API v11.0 - Message sending and reactions
- YouTube APIs (`@distube/ytdl-core`, `simple-youtube-api`) - Video content
- Bible API - Random verse retrieval
- Dictionary APIs - Word definitions (English/French)
- Translation API (MyMemory) - Multilingual support
- Weather/Date API - Location-based time information
- WikiJS - Wikipedia content access
- Image generation APIs (DALL-E, Bing)
- Catbox.moe - Free image hosting for Messenger attachments (no API key required)
- Custom Gemini API (`api-geminiplusieursphoto2026.vercel.app`) - Image analysis with conversation history
- Various specialized APIs for cocktails, citations, grammar checking, etc.

**Core Dependencies**:
- `axios` - HTTP client for API requests
- `express` - Web server framework
- `dotenv` - Environment variable management
- `multer` - File upload handling
- `cheerio` - HTML parsing
- `moment-timezone` - Date/time manipulation
- `fs-extra` - Enhanced file system operations
- `form-data` - Multipart form data handling for image uploads

**Authentication**:
- Facebook Page Access Token (`FB_ACCESS_TOKEN`) for API calls
- Webhook verification token (`VERIFY_TOKEN`)
- API keys for various third-party services stored in environment variables

**Data Storage**:
- Flat file storage for user subscriptions (`/Facebook/uid.txt`)
- Format: `UID|Expiration_Date` with pipe-delimited entries
- No database required - subscription management via file I/O

**Deployment**:
- Vercel configuration included (`vercel.json`)
- Serverless function setup targeting `index.js`
- Development mode via nodemon for hot reloading

**Subscription System**:
- Admin-controlled user access with expiration dates
- File-based whitelist in `/Facebook/uid.txt`
- Date format: YYYY-MM-DD
- Centralized subscription utilities in `/utils/subscription.js`

**Message Handling Strategy**:
- Smart message splitting at natural breakpoints (sentences, paragraphs)
- Automatic chunking for responses exceeding 2000 characters
- Rate limiting through delayed sending (1-2 second intervals)
- Support for rich media attachments (images, audio, files)

**Image Processing Workflow**:
- Facebook Messenger image URLs are downloaded to memory (not saved to disk)
- Images are uploaded to catbox.moe to obtain public URLs accessible from Vercel
- Public URLs are sent to the external Gemini API with conversation context
- Process is serverless-compatible and works identically on both Replit and Vercel
- Supports unlimited image sizes with robust error handling and URL validation