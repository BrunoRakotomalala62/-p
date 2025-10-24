const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');
const multer = require('multer');

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

// Route API pour le chat avec fichier
app.post('/gemini/chat-with-file', upload.single('file'), async (req, res) => {
    try {
        const { prompt, uid } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ erreur: 'Aucun fichier fourni' });
        }

        const geminiModule = require('./auto/gemini');
        
        // Créer un chemin temporaire pour le fichier
        const tempPath = path.join(__dirname, 'temp', file.originalname);
        require('fs').writeFileSync(tempPath, file.buffer);

        const response = await geminiModule.chatWithImage(prompt || 'Décrivez cette image', uid || 'web_user', tempPath);
        
        // Nettoyer le fichier temporaire
        require('fs').unlinkSync(tempPath);
        
        res.json({ response });
    } catch (error) {
        console.error('Erreur Gemini avec fichier:', error);
        res.status(500).json({ erreur: 'Erreur lors du traitement du fichier' });
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

// Route par défaut - redirection vers le chatbot
app.get('/', (req, res) => {
    res.redirect('/chatbot');
});

// Démarrer le serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur démarré sur http://0.0.0.0:${PORT}`);
});
