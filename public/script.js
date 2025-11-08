// Fonction pour générer un ID utilisateur unique
function getUID() {
    if (!localStorage.getItem('chatUID')) {
        localStorage.setItem('chatUID', 'user_' + Math.random().toString(36).substr(2, 9));
    }
    return localStorage.getItem('chatUID');
}

// Variables globales
const uid = getUID();
let selectedFiles = [];
let selectedFileURLs = [];
let currentConversationId = null;
let conversations = {};

// Éléments DOM
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const clearButton = document.getElementById('clearButton');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const sidebar = document.getElementById('sidebar');
const closeSidebar = document.getElementById('closeSidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const newChatBtn = document.getElementById('newChatBtn');
const conversationsList = document.getElementById('conversationsList');

// Ajuster automatiquement la hauteur du textarea
userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = (userInput.scrollHeight) + 'px';
});

// Gérer l'envoi par la touche Entrée (Shift+Entrée pour un saut de ligne)
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Gérer le clic sur le bouton d'envoi
sendButton.addEventListener('click', sendMessage);

// Gérer la sélection de fichier
fileInput.addEventListener('change', handleFileSelect);

// Gérer le clic sur le bouton d'effacement
clearButton.addEventListener('click', clearConversation);

// Gérer le sidebar
hamburgerBtn.addEventListener('click', openSidebar);
closeSidebar.addEventListener('click', closeSidebarMenu);
sidebarOverlay.addEventListener('click', closeSidebarMenu);
newChatBtn.addEventListener('click', createNewConversation);

// Initialiser l'historique au chargement
document.addEventListener('DOMContentLoaded', () => {
    loadConversationsFromStorage();
    if (!currentConversationId) {
        createNewConversation();
    }
    renderConversationsList();
});

// Fonction pour gérer la sélection de fichier
function handleFileSelect(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Vérifier les types de fichiers autorisés
        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf';
        const isDoc = file.type === 'application/msword' || 
                     file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const isPpt = file.type === 'application/vnd.ms-powerpoint' || 
                     file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

        if (!isImage && !isPdf && !isDoc && !isPpt) {
            alert(`Le type de fichier "${file.name}" n'est pas pris en charge`);
            continue;
        }

        // Ajouter le fichier à la sélection
        selectedFiles.push(file);
        const fileURL = URL.createObjectURL(file);
        selectedFileURLs.push(fileURL);

        // Créer un aperçu pour chaque fichier
        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.className = 'file-thumbnail';
        thumbnailDiv.dataset.index = selectedFiles.length - 1;

        if (isImage) {
            thumbnailDiv.innerHTML = `
                <img src="${fileURL}" alt="Aperçu">
                <div class="file-name">${file.name}</div>
                <button class="remove-file" onclick="removeFileAtIndex(${selectedFiles.length - 1})">×</button>
            `;
        } else {
            // Icône pour les autres types de fichiers
            let icon = '📄';
            if (isPdf) icon = '📑';
            if (isDoc) icon = '📝';
            if (isPpt) icon = '📊';

            thumbnailDiv.innerHTML = `
                <div class="file-icon">${icon}</div>
                <div class="file-name">${file.name}</div>
                <button class="remove-file" onclick="removeFileAtIndex(${selectedFiles.length - 1})">×</button>
            `;
        }

        filePreview.appendChild(thumbnailDiv);
    }

    // Réinitialiser l'input file pour permettre la sélection des mêmes fichiers
    fileInput.value = '';
}

// Fonction pour supprimer un fichier spécifique
function removeFileAtIndex(index) {
    if (index < 0 || index >= selectedFiles.length) return;

    // Révoquer l'URL et supprimer le fichier du tableau
    URL.revokeObjectURL(selectedFileURLs[index]);
    selectedFiles.splice(index, 1);
    selectedFileURLs.splice(index, 1);

    // Mettre à jour l'affichage
    updateFilePreview();
}

// Fonction pour mettre à jour l'aperçu des fichiers
function updateFilePreview() {
    filePreview.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.className = 'file-thumbnail';
        thumbnailDiv.dataset.index = index;

        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf';
        const isDoc = file.type === 'application/msword' || 
                     file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const isPpt = file.type === 'application/vnd.ms-powerpoint' || 
                     file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

        if (isImage) {
            thumbnailDiv.innerHTML = `
                <img src="${selectedFileURLs[index]}" alt="Aperçu">
                <div class="file-name">${file.name}</div>
                <button class="remove-file" onclick="removeFileAtIndex(${index})">×</button>
            `;
        } else {
            // Icône pour les autres types de fichiers
            let icon = '📄';
            if (isPdf) icon = '📑';
            if (isDoc) icon = '📝';
            if (isPpt) icon = '📊';

            thumbnailDiv.innerHTML = `
                <div class="file-icon">${icon}</div>
                <div class="file-name">${file.name}</div>
                <button class="remove-file" onclick="removeFileAtIndex(${index})">×</button>
            `;
        }

        filePreview.appendChild(thumbnailDiv);
    });
}

// Fonction pour supprimer tous les fichiers sélectionnés
function removeAllFiles() {
    // Révoquer les URLs
    selectedFileURLs.forEach(url => URL.revokeObjectURL(url));

    // Réinitialiser les tableaux
    selectedFiles = [];
    selectedFileURLs = [];

    // Vider l'aperçu
    filePreview.innerHTML = '';
    fileInput.value = '';
}

// Fonction pour ajouter un message au chat
function addMessage(text, isUser = false, imageUrls = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    let messageContent = `<div class="message-content"><p>${formatMessage(text)}</p>`;

    // Gérer plusieurs images ou fichiers
    if (imageUrls) {
        if (Array.isArray(imageUrls)) {
            // Plusieurs fichiers
            messageContent += `<div class="files-container">`;
            imageUrls.forEach(url => {
                const fileName = selectedFiles.find((_, index) => selectedFileURLs[index] === url)?.name || '';

                // Vérifier si c'est une image
                if (url.startsWith('blob:') && (
                    fileName.endsWith('.jpg') || 
                    fileName.endsWith('.jpeg') || 
                    fileName.endsWith('.png') || 
                    fileName.endsWith('.gif') ||
                    fileName.endsWith('.webp')
                )) {
                    messageContent += `
                        <div class="file-item">
                            <img src="${url}" alt="Fichier envoyé" class="message-file">
                            <div class="file-caption">${fileName}</div>
                        </div>
                    `;
                } else {
                    // Afficher une icône pour les autres types de fichiers
                    let fileIcon = '📄';
                    if (fileName.endsWith('.pdf')) fileIcon = '📑';
                    else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) fileIcon = '📝';
                    else if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) fileIcon = '📊';

                    messageContent += `
                        <div class="file-item">
                            <div class="file-icon-large">${fileIcon}</div>
                            <div class="file-caption">${fileName}</div>
                        </div>
                    `;
                }
            });
            messageContent += `</div>`;
        } else {
            // Un seul fichier (ancienne méthode)
            messageContent += `<img src="${imageUrls}" alt="Image envoyée" class="message-file">`;
        }
    }

    messageContent += `<div class="message-time">${getCurrentTime()}</div></div>`;

    messageDiv.innerHTML = messageContent;
    chatMessages.appendChild(messageDiv);

    // Rendre les équations mathématiques si c'est un message du bot
    if (!isUser) {
        // Attendre que KaTeX soit chargé avant de rendre
        setTimeout(() => {
            renderMath(messageDiv);
        }, 100);
    }

    // Faire défiler vers le bas
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Fonction pour formater le message (markdown simple + équations mathématiques)
function formatMessage(text) {
    // D'abord, protéger les expressions mathématiques existantes en LaTeX
    let formatted = text;

    // Convertir les patterns mathématiques communs en LaTeX
    formatted = convertMathToLatex(formatted);

    // Appliquer le formatage markdown
    formatted = formatted
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');

    return formatted;
}

// Fonction pour convertir les expressions mathématiques en LaTeX
function convertMathToLatex(text) {
    let result = text;

    // Convertir les fractions (ex: 11/4, 4Un/4, Un = 11/4)
    result = result.replace(/(\d+|\w+)\s*\/\s*(\d+)/g, (match, num, den) => {
        return `$\\frac{${num}}{${den}}$`;
    });

    // Convertir les exposants numériques (ex: x², 4², Un²)
    result = result.replace(/([a-zA-Z0-9]+)²/g, '$1^2');
    result = result.replace(/([a-zA-Z0-9]+)³/g, '$1^3');
    
    // Convertir les indices (ex: 4Un devient 4U_n, mais seulement si pas déjà dans une expression)
    result = result.replace(/(\d+)([A-Z])([a-z])/g, (match, num, upper, lower) => {
        return `${num}${upper}_${lower}`;
    });

    // Détecter les équations complètes et les encadrer avec $$...$$
    // Ex: "4Un - 8 + 8 = 3 + 8" ou "4Un = 11"
    result = result.replace(/^(\s*)([A-Za-z0-9_\^\{\}]+\s*[-+*/=]\s*[A-Za-z0-9_\^\{\}\s\-+*/=]+)(\s*)$/gm, (match, pre, equation, post) => {
        // Vérifier si c'est vraiment une équation (contient =)
        if (equation.includes('=')) {
            return `${pre}$$${equation}$$${post}`;
        }
        return match;
    });

    return result;
}

// Fonction pour rendre les équations mathématiques avec KaTeX
function renderMath(element) {
    if (typeof renderMathInElement !== 'undefined') {
        try {
            renderMathInElement(element, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false},
                    {left: '\\[', right: '\\]', display: true}
                ],
                throwOnError: false,
                errorColor: '#cc0000',
                strict: false
            });
        } catch (error) {
            console.error('Erreur lors du rendu mathématique:', error);
        }
    }
}

// Fonction pour effacer la conversation
async function clearConversation() {
    if (confirm("Voulez-vous vraiment effacer toute la conversation ?")) {
        // Vider l'interface utilisateur
        chatMessages.innerHTML = '';

        // Ajouter le message de bienvenue initial
        addMessage("Bonjour ! Je suis votre assistant IA. Comment puis-je vous aider aujourd'hui ?", false);

        // Réinitialiser l'ID utilisateur pour créer une nouvelle session
        localStorage.removeItem('chatUID');
        const newUid = getUID();

        try {
            // Note: L'API externe ne nécessite pas de réinitialisation explicite
            // La nouvelle UID suffit à créer une nouvelle session
            console.log("Conversation réinitialisée avec succès");
        } catch (error) {
            console.error("Erreur lors de la réinitialisation de la conversation:", error);
        }
    }
}

// Fonction pour obtenir l'heure actuelle
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Fonction pour afficher un indicateur de chargement
function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot-message loading';
    loadingDiv.id = 'loadingIndicator';
    loadingDiv.innerHTML = `
        <div class="message-content">
            <div class="loading-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Fonction pour supprimer l'indicateur de chargement
function hideLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
}

// Fonction pour envoyer un message
async function sendMessage() {
    const message = userInput.value.trim();

    if (!message && selectedFiles.length === 0) {
        return;
    }

    // Réinitialiser l'entrée utilisateur
    userInput.value = '';
    userInput.style.height = 'auto';

    // Si nous avons des fichiers, les envoyer tous ensemble
    if (selectedFiles.length > 0) {
        // Afficher les fichiers dans le chat
        const fileURLs = [...selectedFileURLs]; // Copie pour éviter les problèmes si removeAllFiles est appelé

        // Ajouter le message utilisateur au chat avec tous les fichiers
        addMessage(message, true, fileURLs);

        // Afficher l'indicateur de chargement
        showLoading();

        try {
            // Convertir les fichiers en URLs base64 ou data URLs
            const imageUrls = await Promise.all(
                selectedFiles.map(file => {
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(file);
                    });
                })
            );

            // Construire l'URL avec les paramètres
            let apiUrl = `https://api-geminiplusieursphoto2026.vercel.app/gemini?uid=${encodeURIComponent(uid)}&pro=${encodeURIComponent(message || 'Analysez ces images')}`;
            
            // Ajouter les images comme paramètres (note: data URLs peuvent être longs)
            imageUrls.forEach((url, index) => {
                apiUrl += `&image${index + 1}=${encodeURIComponent(url)}`;
            });

            const response = await fetch(apiUrl, {
                method: 'GET'
            });

            const data = await response.json();

            // Supprimer l'indicateur de chargement
            hideLoading();

            // Ajouter la réponse au chat
            if (data.response) {
                // Remplacer Gemini par Bruno dans la réponse
                let modifiedResponse = data.response.replace(/Gemini/g, 'Bruno').replace(/gemini/g, 'bruno');
                // Remplacer la phrase d'identification de l'IA avec plusieurs variantes
                modifiedResponse = modifiedResponse.replace(/Je suis un grand modèle de langage, entraîné par Google/g, 'Je suis une création de ❤️Bruno Rakotomalala❤️, conçue pour vous aider');
                modifiedResponse = modifiedResponse.replace(/Je suis un modèle de langage IA/g, 'Je suis un assistant développé par ❤️Bruno Rakotomalala❤️');
                modifiedResponse = modifiedResponse.replace(/Je suis un assistant IA entraîné par Google/g, 'Je suis l\'assistant intelligent de ❤️Bruno Rakotomalala❤️');
                modifiedResponse = modifiedResponse.replace(/Je suis une IA créée par Google/g, 'Je suis l\'IA personnelle de ❤️Bruno Rakotomalala❤️');
                addMessage(modifiedResponse);
            } else if (data.erreur) {
                addMessage(`Erreur : ${data.erreur}`);
            }
        } catch (error) {
            console.error('Erreur:', error);
            hideLoading();
            addMessage('Erreur de communication avec le serveur. Veuillez réessayer plus tard.');
        }

        // Réinitialiser les fichiers
        removeAllFiles();
    } else {
        // Ajouter le message utilisateur au chat
        addMessage(message, true);

        // Afficher l'indicateur de chargement
        showLoading();

        try {
            // Envoi de requête standard sans fichier
            const apiUrl = `https://api-geminiplusieursphoto2026.vercel.app/gemini?uid=${encodeURIComponent(uid)}&pro=${encodeURIComponent(message)}`;
            
            const response = await fetch(apiUrl, {
                method: 'GET'
            });

            const data = await response.json();

            // Supprimer l'indicateur de chargement
            hideLoading();

            // Ajouter la réponse au chat
            if (data.response) {
                // Remplacer Gemini par Bruno dans la réponse
                let modifiedResponse = data.response.replace(/Gemini/g, 'Bruno').replace(/gemini/g, 'bruno');
                // Remplacer la phrase d'identification de l'IA avec plusieurs variantes
                modifiedResponse = modifiedResponse.replace(/Je suis un grand modèle de langage, entraîné par Google/g, 'Je suis une création de ❤️Bruno Rakotomalala❤️, conçue pour vous aider');
                modifiedResponse = modifiedResponse.replace(/Je suis un modèle de langage IA/g, 'Je suis un assistant développé par ❤️Bruno Rakotomalala❤️');
                modifiedResponse = modifiedResponse.replace(/Je suis un assistant IA entraîné par Google/g, 'Je suis l\'assistant intelligent de ❤️Bruno Rakotomalala❤️');
                modifiedResponse = modifiedResponse.replace(/Je suis une IA créée par Google/g, 'Je suis l\'IA personnelle de ❤️Bruno Rakotomalala❤️');
                addMessage(modifiedResponse);
            } else if (data.erreur) {
                addMessage(`Erreur: ${data.erreur}`);
            }
        } catch (error) {
            console.error('Erreur:', error);
            hideLoading();
            addMessage('Erreur de communication avec le serveur. Veuillez réessayer plus tard.');
        }
    }
    
    // Sauvegarder la conversation après chaque message
    saveCurrentConversation();
}

// ========== GESTION DE L'HISTORIQUE DES CONVERSATIONS ==========

// Ouvrir le sidebar
function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
}

// Fermer le sidebar
function closeSidebarMenu() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
}

// Créer une nouvelle conversation
function createNewConversation() {
    // Sauvegarder la conversation actuelle avant d'en créer une nouvelle
    if (currentConversationId) {
        saveCurrentConversation();
    }

    // Générer un nouvel ID unique
    const newId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Créer la nouvelle conversation
    conversations[newId] = {
        id: newId,
        title: 'Nouvelle conversation',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    // Définir comme conversation active
    currentConversationId = newId;

    // Effacer l'interface
    chatMessages.innerHTML = '';
    addMessage("Bonjour ! Je suis une création de ❤️Bruno Rakotomalala❤️, conçue pour vous aider. Comment puis-je vous être utile aujourd'hui ?", false);

    // Sauvegarder et mettre à jour l'affichage
    saveConversationsToStorage();
    renderConversationsList();
    closeSidebarMenu();
}

// Charger les conversations depuis localStorage
function loadConversationsFromStorage() {
    const stored = localStorage.getItem('chatConversations');
    const currentId = localStorage.getItem('currentConversationId');
    
    if (stored) {
        conversations = JSON.parse(stored);
    }
    
    if (currentId && conversations[currentId]) {
        currentConversationId = currentId;
        loadConversation(currentId);
    }
}

// Sauvegarder les conversations dans localStorage
function saveConversationsToStorage() {
    localStorage.setItem('chatConversations', JSON.stringify(conversations));
    localStorage.setItem('currentConversationId', currentConversationId);
}

// Sauvegarder la conversation actuelle
function saveCurrentConversation() {
    if (!currentConversationId) return;

    // Extraire tous les messages de l'interface
    const messages = [];
    const messageElements = chatMessages.querySelectorAll('.message');
    
    messageElements.forEach(msgEl => {
        const isUser = msgEl.classList.contains('user-message');
        const content = msgEl.querySelector('.message-content p')?.innerHTML || '';
        
        messages.push({
            text: content,
            isUser: isUser,
            timestamp: new Date().toISOString()
        });
    });

    // Mettre à jour la conversation
    if (conversations[currentConversationId]) {
        conversations[currentConversationId].messages = messages;
        conversations[currentConversationId].updatedAt = new Date().toISOString();
        
        // Mettre à jour le titre si c'est le premier message utilisateur
        if (messages.length >= 2 && conversations[currentConversationId].title === 'Nouvelle conversation') {
            const firstUserMsg = messages.find(m => m.isUser);
            if (firstUserMsg) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = firstUserMsg.text;
                const plainText = tempDiv.textContent || tempDiv.innerText || '';
                conversations[currentConversationId].title = plainText.substring(0, 50) + (plainText.length > 50 ? '...' : '');
            }
        }
    }

    saveConversationsToStorage();
    renderConversationsList();
}

// Charger une conversation spécifique
function loadConversation(conversationId) {
    if (!conversations[conversationId]) return;

    const conversation = conversations[conversationId];
    currentConversationId = conversationId;

    // Effacer l'interface
    chatMessages.innerHTML = '';

    // Recharger les messages
    conversation.messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msg.isUser ? 'user-message' : 'bot-message'}`;
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${msg.text}</p>
                <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        `;
        chatMessages.appendChild(messageDiv);

        // Rendre les équations mathématiques
        if (!msg.isUser) {
            setTimeout(() => renderMath(messageDiv), 100);
        }
    });

    // Faire défiler vers le bas
    chatMessages.scrollTop = chatMessages.scrollHeight;

    saveConversationsToStorage();
    renderConversationsList();
}

// Changer de conversation
function switchConversation(conversationId) {
    if (conversationId === currentConversationId) {
        closeSidebarMenu();
        return;
    }

    // Sauvegarder la conversation actuelle
    saveCurrentConversation();

    // Charger la nouvelle conversation
    loadConversation(conversationId);

    closeSidebarMenu();
}

// Supprimer une conversation
function deleteConversation(conversationId, event) {
    event.stopPropagation();

    if (confirm('Voulez-vous vraiment supprimer cette conversation ?')) {
        delete conversations[conversationId];

        // Si c'est la conversation active, en créer une nouvelle
        if (conversationId === currentConversationId) {
            currentConversationId = null;
            createNewConversation();
        }

        saveConversationsToStorage();
        renderConversationsList();
    }
}

// Afficher la liste des conversations
function renderConversationsList() {
    conversationsList.innerHTML = '';

    // Trier les conversations par date de mise à jour (plus récentes en premier)
    const sortedConversations = Object.values(conversations).sort((a, b) => {
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    sortedConversations.forEach(conv => {
        const convItem = document.createElement('div');
        convItem.className = `conversation-item ${conv.id === currentConversationId ? 'active' : ''}`;
        
        const date = new Date(conv.updatedAt);
        const formattedDate = formatRelativeDate(date);

        convItem.innerHTML = `
            <div class="conversation-content">
                <div class="conversation-title">${conv.title}</div>
                <div class="conversation-date">${formattedDate}</div>
            </div>
            <button class="conversation-menu-btn" onclick="deleteConversation('${conv.id}', event)">
                <i class="fas fa-ellipsis-v"></i>
            </button>
        `;

        convItem.addEventListener('click', (e) => {
            if (!e.target.closest('.conversation-menu-btn')) {
                switchConversation(conv.id);
            }
        });

        conversationsList.appendChild(convItem);
    });
}

// Formater la date relative
function formatRelativeDate(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}