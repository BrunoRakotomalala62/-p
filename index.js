const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');
const multer = require('multer');
const cron = require('node-cron');
const { monitorComments } = require('./utils/moltbookMonitor');

// Charger les variables d'environnement
dotenv.config();

// Importation des modules existants
const handleMessage = require('./handles/handleMessage');
const handlePostback = require('./handles/handlePostback');

const app = express();

// Configuration des middlewares
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// Servir les fichiers temporaires pour les rendre accessibles publiquement (depuis /tmp pour Vercel)
app.use('/temp', express.static('/tmp'));

// Configuration de multer pour le téléchargement de fichiers
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // Limite de 10MB
});

// API pour gérer les réactions
const api = {
    setMessageReaction: async (reaction, messageID) => {
        try {
            const accessToken = process.env.FB_ACCESS_TOKEN;
            const url = `https://graph.facebook.com/v11.0/${messageID}/reactions`;

            const response = await axios.post(url, {
                access_token: accessToken,
                type: reaction,
            });
            console.log('Réaction ajoutée:', response.data);
        } catch (error) {
            console.error('Erreur lors de l\'ajout de la réaction:', error);
        }
    }
};

// Route pour le webhook Facebook
app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// Route pour recevoir les messages entrants via Messenger
app.post('/webhook', (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(entry => {
            const event = entry.messaging[0];
            if (event.message) {
                handleMessage(event, api); // Passer `api` pour permettre les réactions
            } else if (event.postback) {
                handlePostback(event);
            }
        });
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// Route pour le chatbot web
app.get('/chatbot', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route API pour le chat avec Gemini
app.post('/gemini/chat', async (req, res) => {
    try {
        const { prompt, uid } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ erreur: 'Le prompt est requis' });
        }

        const geminiModule = require('./auto/gemini');
        const response = await geminiModule.chat(prompt, uid || 'web_user');
        
        res.json({ response });
    } catch (error) {
        console.error('Erreur Gemini:', error);
        res.status(500).json({ erreur: 'Erreur lors de la génération de la réponse' });
    }
});

// Route API pour le chat avec plusieurs fichiers
app.post('/gemini/chat-with-files', upload.array('files', 10), async (req, res) => {
    try {
        const { prompt, uid } = req.body;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ erreur: 'Aucun fichier fourni' });
        }

        const geminiModule = require('./auto/gemini');
        const fs = require('fs');
        
        // Utiliser /tmp pour Vercel (compatible avec les fonctions serverless)
        const tempDir = '/tmp';
        
        // S'assurer que le répertoire /tmp existe (il existe toujours sur Vercel)
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Sauvegarder les fichiers et créer des URLs publiques
        const imageUrls = [];
        const filePaths = [];
        
        for (const file of files) {
            const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.originalname}`;
            const tempPath = path.join(tempDir, uniqueName);
            fs.writeFileSync(tempPath, file.buffer);
            filePaths.push(tempPath);
            
            // Créer l'URL publique
            const baseUrl = process.env.RENDER_EXTERNAL_URL || (process.env.REPLIT_DEV_DOMAIN 
                ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
                : `http://localhost:${process.env.PORT || 5000}`);
            const imageUrl = `${baseUrl}/temp/${uniqueName}`;
            imageUrls.push(imageUrl);
        }

        const response = await geminiModule.chatWithMultipleImages(
            prompt || 'Analysez ces images', 
            uid || 'web_user', 
            imageUrls
        );
        
        // Nettoyer les fichiers temporaires après un délai
        setTimeout(() => {
            filePaths.forEach(filePath => {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (error) {
                    console.error('Erreur lors de la suppression du fichier:', error);
                }
            });
        }, 60000); // Supprimer après 1 minute
        
        res.json({ response });
    } catch (error) {
        console.error('Erreur Gemini avec fichiers:', error);
        res.status(500).json({ erreur: error.message || 'Erreur lors du traitement des fichiers' });
    }
});

// Route API pour réinitialiser la conversation
app.post('/gemini/reset', async (req, res) => {
    try {
        const { uid } = req.body;
        
        if (!uid) {
            return res.status(400).json({ erreur: 'UID requis' });
        }

        const geminiModule = require('./auto/gemini');
        await geminiModule.resetConversation(uid);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors de la réinitialisation:', error);
        res.status(500).json({ erreur: 'Erreur lors de la réinitialisation' });
    }
});

// Route pour le téléchargement dynamique de vidéos avec qualité
app.get('/download/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { slug, quality } = req.query;
        
        if (!id) {
            return res.status(400).json({ erreur: 'ID de vidéo requis' });
        }
        
        const API_BASE = 'https://scraping-video.vercel.app';
        const downloadUrl = `${API_BASE}/download/${id}?slug=${encodeURIComponent(slug || '')}&quality=${encodeURIComponent(quality || '360')}`;
        
        console.log('Téléchargement vidéo:', downloadUrl);
        
        // Faire une requête HEAD pour obtenir la taille du fichier
        try {
            const headResponse = await axios.head(downloadUrl, {
                timeout: 30000,
                maxRedirects: 5
            });
            
            const contentLength = parseInt(headResponse.headers['content-length'] || '0');
            const contentType = headResponse.headers['content-type'] || 'video/mp4';
            
            console.log(`Taille du fichier: ${contentLength} bytes (${(contentLength / (1024 * 1024)).toFixed(2)} MB)`);
            
            // Rediriger vers l'URL de téléchargement
            res.redirect(downloadUrl);
            
        } catch (headError) {
            console.log('Erreur HEAD, redirection directe:', headError.message);
            res.redirect(downloadUrl);
        }
        
    } catch (error) {
        console.error('Erreur téléchargement:', error.message);
        res.status(500).json({ erreur: 'Erreur lors du téléchargement', details: error.message });
    }
});

// Route par défaut - redirection vers le chatbot
app.get('/', (req, res) => {
    res.redirect('/chatbot');
});

// Route de santé pour le ping
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auto-ping de 06:00 à 23:55 toutes les 14 minutes pour économiser le quota Render (750h/mois)
// Cela fait environ 18 heures d'activité par jour, soit environ 558 heures par mois (31 jours).
// On respecte toujours largement la limite des 750h.
cron.schedule('*/14 6-23 * * *', async () => {
    try {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();

        // Arrêt à 23h55
        if (hour === 23 && minute > 55) return;

        const appUrl = process.env.RENDER_EXTERNAL_URL || process.env.RENDER_URL;
        if (!appUrl) return;

        const response = await axios.get(`${appUrl}/health`, {
            headers: { 'User-Agent': 'Render-Auto-Ping-Bot' }
        });
        console.log(`Auto-ping économique réussi sur ${appUrl}: ${response.status}`);
    } catch (error) {
        console.error(`Erreur auto-ping: ${error.message}`);
    }
});

// Planifier la surveillance des commentaires Moltbook toutes les 5 minutes
cron.schedule('*/5 * * * *', () => {
    monitorComments().catch(err => console.error('Erreur moniteur Moltbook:', err));
});

// Démarrer le serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur démarré sur http://0.0.0.0:${PORT}`);
});
