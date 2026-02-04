const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const MOLTBOOK_API_KEY = 'moltbook_sk_yiEtkeeReGKFfFuSdNG-sRC3nK22-LSo';
const MOLTBOOK_BASE_URL = 'https://www.moltbook.com/api/v1';
const GEMINI_API_URL = 'https://gemini-api-wrapper--cznxih.replit.app/gemini';
const LAST_CHECKED_FILE = path.join(__dirname, 'last_checked_comments.json');

/**
 * Charge les IDs des derniers commentaires traités pour éviter les doublons
 */
function loadLastChecked() {
    try {
        if (fs.existsSync(LAST_CHECKED_FILE)) {
            return JSON.parse(fs.readFileSync(LAST_CHECKED_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Erreur chargement last_checked:', e);
    }
    return {};
}

/**
 * Sauvegarde les IDs des derniers commentaires traités
 */
function saveLastChecked(data) {
    try {
        fs.writeFileSync(LAST_CHECKED_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Erreur sauvegarde last_checked:', e);
    }
}

/**
 * Appelle l'API Gemini pour générer une réponse
 */
async function getGeminiResponse(commentText) {
    try {
        const response = await axios.get(GEMINI_API_URL, {
            params: { pro: commentText }
        });
        if (response.data && response.data.status === 'success') {
            return response.data.answer;
        }
    } catch (e) {
        console.error('Erreur Gemini API:', e.message);
    }
    return null;
}

/**
 * Récupère les commentaires d'un post
 */
async function getComments(postId) {
    try {
        const response = await axios.get(`${MOLTBOOK_BASE_URL}/posts/${postId}/comments`, {
            headers: { 'Authorization': `Bearer ${MOLTBOOK_API_KEY}` }
        });
        return response.data.comments || [];
    } catch (e) {
        console.error(`Erreur récupération commentaires pour ${postId}:`, e.message);
        return [];
    }
}

/**
 * Répond à un commentaire sur Moltbook
 */
async function replyToComment(postId, commentId, content) {
    try {
        await axios.post(`${MOLTBOOK_BASE_URL}/posts/${postId}/comments`, {
            content: content,
            parent_id: commentId // Si l'API supporte les réponses imbriquées
        }, {
            headers: {
                'Authorization': `Bearer ${MOLTBOOK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`Répondu au commentaire ${commentId} sur le post ${postId}`);
        return true;
    } catch (e) {
        console.error(`Erreur réponse commentaire ${commentId}:`, e.message);
        return false;
    }
}

/**
 * Fonction principale de surveillance
 */
async function monitorComments() {
    console.log('🔍 Vérification des nouveaux commentaires sur Moltbook...');
    
    const lastChecked = loadLastChecked();
    
    try {
        // 1. Récupérer les posts de l'agent (on suppose qu'on surveille ses propres posts)
        // Note: L'endpoint exact peut varier, ici on simule la récupération des posts de l'utilisateur
        const postsResponse = await axios.get(`${MOLTBOOK_BASE_URL}/agents/me/posts`, {
            headers: { 'Authorization': `Bearer ${MOLTBOOK_API_KEY}` }
        });
        
        const posts = postsResponse.data.posts || [];
        
        for (const post of posts) {
            const comments = await getComments(post.id);
            const lastCommentId = lastChecked[post.id];
            
            // Filtrer les nouveaux commentaires (ceux après le dernier traité)
            // Si c'est la première fois, on ne répond pas à tout l'historique pour éviter le spam
            const newComments = lastCommentId 
                ? comments.filter(c => c.id > lastCommentId)
                : []; // On commence à surveiller à partir de maintenant
            
            for (const comment of newComments) {
                // Ne pas répondre à ses propres commentaires
                if (comment.agent && comment.agent.name === 'Buddy_Logic_GO_Bot') continue;
                
                console.log(`Nouveau commentaire de ${comment.agent ? comment.agent.name : 'Inconnu'}: ${comment.content}`);
                
                // Obtenir une réponse dynamique via Gemini
                const aiReply = await getGeminiResponse(comment.content);
                
                if (aiReply) {
                    await replyToComment(post.id, comment.id, aiReply);
                }
            }
            
            // Mettre à jour le dernier ID traité pour ce post
            if (comments.length > 0) {
                lastChecked[post.id] = comments[0].id; // On suppose que le premier est le plus récent
            }
        }
        
        saveLastChecked(lastChecked);
        
    } catch (e) {
        console.error('Erreur lors de la surveillance Moltbook:', e.message);
    }
}

module.exports = { monitorComments };
