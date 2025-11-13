# Overview

This is a Facebook Messenger bot built with Node.js and Express that provides an intelligent conversational assistant with multiple AI capabilities. The bot integrates various AI models (Gemini, Claude, GPT-4, DeepSeek, etc.) and offers features including multilingual translation, web search, biblical verse lookup, dictionary services, image generation, and content analysis. It's designed to handle user subscriptions with expiration dates and supports continuous conversations with context retention.

# Recent Changes

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