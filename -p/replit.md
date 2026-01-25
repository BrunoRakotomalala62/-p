# Overview

This project is a Facebook Messenger bot built with Node.js and Express, designed to act as an intelligent conversational assistant. It integrates multiple AI models (Gemini, Claude, GPT-4, DeepSeek, Mixtral) to offer a wide range of features, including multilingual translation, web search, biblical verse lookup, dictionary services, image generation, content analysis, and a VIP subscription system for exclusive commands like PDF library access and video search/download. The bot supports continuous conversations with context retention and aims to provide a versatile and engaging user experience.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Backend Architecture

The backend is an Express.js server running on Node.js, featuring a modular command system where each bot command resides in its own file. Message handling is centralized, and conversation context is maintained through in-memory session management using Map objects for individual commands and user sessions. The architecture employs a command pattern for bot functionalities and a middleware chain for request processing. File uploads are handled in-memory up to 10MB. A VIP subscription system manages user access with expiration dates via flat-file storage.

## Frontend Architecture

The bot interacts with users exclusively through the Facebook Messenger Platform. It utilizes webhook verification, integrates with the Messenger Reactions API, and supports various message types including text, image, audio, and files. Long responses are automatically split into 2000-character chunks and sent with rate limiting for a smoother user experience.

## System Design Choices

- **Multilingual Support**: Extensive translation capabilities with language detection and specific language targeting.
- **Dynamic Content Delivery**: Intelligent handling of file sizes for downloads (e.g., direct attachment for small files, link for large files).
- **AI Integration**: Seamlessly switches between multiple AI models based on the query, including specialized models for image analysis and general conversation.
- **Session Management**: Maintains conversation state and context for interactive commands like video search, book selection, and AI conversations.
- **Automated Command Generation**: Allows for the creation of custom AI commands from API URLs, supporting continuous conversation and optional image analysis.
- **Image Processing**: Images from Messenger are uploaded to a public hosting service (Catbox.moe) for accessibility by serverless functions and external AI APIs, ensuring compatibility with platforms like Vercel.
- **Account Verification Automation**: Integrates CapSolver and Puppeteer for automated CAPTCHA resolution and Facebook account verification, streamlining account creation processes.
- **Deployment**: Configured for serverless deployment on Vercel, with development support via Nodemon.

# External Dependencies

## AI Services

- **Google Generative AI**: Gemini models for various AI tasks.
- **Claude API**: Accessed via `rapido.zetsu.xyz` and `haji-mix-api.gleeze.com`.
- **GPT-4**: Via custom endpoints.
- **DeepSeek API**: For specialized AI capabilities.
- **Mixtral models**: For specific query types.
- **Custom Gemini API (`api-geminiplusieursphoto2026.vercel.app`)**: For image analysis with conversation history.

## Third-Party APIs

- **Facebook Graph API v11.0**: For sending messages and handling reactions.
- **YouTube APIs (`@distube/ytdl-core`, `simple-youtube-api`)**: For video content search and download.
- **Bible API**: For retrieving biblical verses.
- **Dictionary APIs**: For English and French word definitions.
- **Translation API (MyMemory)**: For multilingual translation.
- **Weather/Date API**: For location-based time information.
- **WikiJS**: For Wikipedia content access.
- **Image Generation APIs**: Including DALL-E and Bing.
- **Catbox.moe**: Free image hosting for Messenger attachments.
- **`scraping-video.vercel.app`**: For video search and download (command `x`).
- **`clip-dai.onrender.com`**: For Dailymotion clip search and download (command `clip`).
- **`translation-neon.vercel.app`**: For advanced translation services.
- **`livre-pdf-gratuit.vercel.app`**: For the VIP PDF book library (command `livre`).
- **`pdf-0r0j.onrender.com`**: For educational PDF resources (command `education`).
- **CapSolver API**: For automatic CAPTCHA resolution.
- Various specialized APIs for cocktails, citations, grammar checking.

## Core Libraries and Tools

- **`axios`**: HTTP client.
- **`express`**: Web server framework.
- **`dotenv`**: Environment variable management.
- **`multer`**: File upload handling.
- **`cheerio`**: HTML parsing.
- **`moment-timezone`**: Date/time manipulation.
- **`fs-extra`**: Enhanced file system operations.
- **`form-data`**: Multipart form data handling.
- **Puppeteer**: For browser automation (e.g., Facebook login checkpoints).