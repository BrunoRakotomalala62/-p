# 🛠️ Guide d'utilisation de COMMANDSTORE

## 📝 Description

`commandstore` est un générateur automatique de commandes IA pour votre bot. Il permet de créer rapidement des commandes personnalisées qui se connectent à n'importe quelle API externe.

## 🚀 Utilisation

### Syntaxe de base
```
commandstore <nom_commande> <url_api> [image]
```

### Paramètres
- **nom_commande** : Le nom de votre commande (lettres minuscules et chiffres uniquement)
- **url_api** : L'URL complète de votre API (doit commencer par http:// ou https://)
- **image** : (Optionnel) Ajoutez ce mot-clé pour activer le support des images

## 📌 Exemples d'utilisation

### Exemple 1 : Commande simple sans images
```
commandstore hi https://api.exemple.com/chat
```

Cette commande créera un fichier `commands/hi.js` qui se connecte à l'API spécifiée.

### Exemple 2 : Commande avec support d'images
```
commandstore vision https://api.exemple.com/vision image
```

Cette commande créera un fichier `commands/vision.js` avec support d'analyse d'images.

## 🎯 Fonctionnalités des commandes générées

Chaque commande créée inclut automatiquement :

### 1. **Conversation continue**
- La commande maintient un contexte de conversation avec l'utilisateur
- Utilise l'ID utilisateur pour personnaliser les réponses

### 2. **Formatage avancé**
- Conversion du texte en **gras Unicode** pour les titres
- Support du formatage Markdown (`**texte**` devient gras)
- Messages divisés automatiquement si trop longs

### 3. **Gestion d'images** (si activé)
- L'utilisateur envoie une image
- Le bot confirme la réception
- L'utilisateur pose une question sur l'image
- La commande envoie l'image et la question à l'API

### 4. **Commandes de contrôle**
- `stop` : Désactive la commande active
- `supprimer` : Réinitialise la conversation sans désactiver la commande

## 📡 Format de l'API

Votre API doit accepter ces paramètres :
- `query` : La question de l'utilisateur
- `userId` : L'ID de l'utilisateur
- `imgurl` : (optionnel) L'URL de l'image si le support est activé

### Formats de réponse supportés

L'API peut répondre dans l'un de ces formats :

```json
{
  "data": {
    "response": "Votre réponse ici"
  }
}
```

ou

```json
{
  "response": "Votre réponse ici"
}
```

ou

```json
{
  "message": "Votre réponse ici"
}
```

ou simplement une chaîne de texte.

## 💡 Exemple complet d'utilisation

### 1. Créer la commande
```
Utilisateur : commandstore assistant https://miko-utilis.vercel.app/api/gpt5 image
Bot : ✅ Commande "assistant" créée avec succès! 🎉
```

### 2. Redémarrer le bot
⚠️ **IMPORTANT** : Vous **DEVEZ** redémarrer le bot pour que la nouvelle commande soit active.

Le système de commandes charge toutes les commandes au démarrage du processus. Les nouvelles commandes créées avec `commandstore` ne seront pas disponibles tant que le bot n'aura pas été complètement redémarré.

**Comment redémarrer :**
- Si vous gérez le serveur : Redémarrez le processus Node.js
- Si c'est hébergé : Redéployez ou redémarrez l'application

### 3. Utiliser la commande

#### Sans image :
```
Utilisateur : assistant Qui es-tu ?
Bot : Je suis un assistant IA...
```

#### Avec image :
```
Utilisateur : [Envoie une photo]
Bot : 📸 J'ai bien reçu votre image ! Quelle est votre question concernant cette photo ?
Utilisateur : assistant Décris cette image
Bot : Cette image montre...
```

## 🔧 Gestion des commandes

### Vérifier si une commande existe
Avant de créer une commande, le système vérifie automatiquement si elle existe déjà.

### Supprimer une commande
Pour supprimer une commande, supprimez simplement le fichier correspondant :
```bash
rm commands/nom_commande.js
```

## ⚙️ Détails techniques

### Structure du code généré
Chaque commande créée contient :
- Gestion du contexte utilisateur
- Fonctions de formatage de texte
- Gestion des erreurs API
- Division automatique des messages longs
- Support optionnel des images

### Fichier créé
```
commands/<nom_commande>.js
```

## 📝 Notes importantes

1. **Noms de commandes valides** : 
   - Uniquement lettres minuscules (a-z) et chiffres (0-9)
   - Entre 2 et 20 caractères
   - Pas de noms réservés (stop, supprimer, help, commandstore)
   
2. **URL API** : 
   - Doit être une URL valide avec protocole HTTP ou HTTPS
   - L'URL est validée avant création de la commande
   
3. **Redémarrage OBLIGATOIRE** : 
   - Le bot charge les commandes au démarrage uniquement
   - Les nouvelles commandes ne fonctionneront pas sans redémarrage
   
4. **Format API** : Votre API doit respecter l'un des formats de réponse supportés

5. **Sécurité** :
   - Les entrées utilisateur sont sanitizées
   - Validation stricte des noms de commandes et URLs
   - Protection contre l'injection de code

## 🎨 Personnalisation

Le template généré peut être modifié après création pour :
- Changer l'en-tête et le pied de page des messages
- Ajouter des fonctionnalités spécifiques
- Modifier le formatage du texte
- Ajuster le comportement selon vos besoins

## 🐛 Dépannage

### La commande n'apparaît pas
- Vérifiez que le bot a été redémarré
- Vérifiez que le fichier a bien été créé dans `commands/`

### L'API ne répond pas
- Vérifiez que l'URL API est correcte
- Vérifiez que l'API est accessible
- Vérifiez le format de réponse de l'API

### Erreur "commande invalide"
- Vérifiez que le nom ne contient que des lettres minuscules et chiffres
- Évitez les caractères spéciaux, espaces, ou majuscules

## 📚 Ressources

Pour plus d'informations sur la création d'APIs compatibles, consultez les exemples dans le dossier `commands/` (notamment `ai.js`, `gemini.js`, etc.).
