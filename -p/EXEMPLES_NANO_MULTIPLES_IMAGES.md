# 📸 Exemples de scénarios avec plusieurs images - Commande Nano

La commande `nano` peut maintenant gérer **plusieurs images simultanément** tout en conservant leur ordre (1ère, 2ème, 3ème, etc.).

---

## 🎯 Comment ça fonctionne

### Étape 1 : Envoyer plusieurs images
- Envoyez 2, 3, 4 images ou plus en même temps via Messenger
- Le bot confirme : `🖼️ J'ai bien reçu vos 3 photos !`
- Les images sont stockées dans l'ordre : **1ère, 2ème, 3ème, etc.**

### Étape 2 : Décrire la transformation
- Le bot comprend l'ordre des images
- Vous pouvez référencer les images par leur position

---

## 📋 Exemples de scénarios

### Scénario 1 : Face Swap (Échange de visage)
**📷 Envoyer :** 2 photos (Photo A et Photo B)

**💬 Commande :**
```
changer le visage de la 1ère photo par celui de la 2ème photo
```

**🤖 API reçoit :**
- `imageurl` = Photo A (1ère image)
- `imageurl2` = Photo B (2ème image)
- `prompt` = "changer le visage de la 1ère photo par celui de la 2ème photo"

**✅ Résultat :** Le visage de la photo B est placé sur la photo A

---

### Scénario 2 : Collage simple
**📷 Envoyer :** 3 photos

**💬 Commande :**
```
mettre en collage horizontal
```

**🤖 API reçoit :**
- `imageurl` = Photo 1
- `imageurl2` = Photo 2
- `imageurl3` = Photo 3
- `prompt` = "mettre en collage horizontal"

**✅ Résultat :** Les 3 photos sont alignées horizontalement

---

### Scénario 3 : Fusion d'arrière-plans
**📷 Envoyer :** 2 photos

**💬 Commande :**
```
fusionner les arrière-plans des deux images
```

**🤖 API reçoit :**
- `imageurl` = Photo 1
- `imageurl2` = Photo 2
- `prompt` = "fusionner les arrière-plans des deux images"

**✅ Résultat :** Les arrière-plans des deux photos sont combinés

---

### Scénario 4 : Montage artistique
**📷 Envoyer :** 4 photos

**💬 Commande :**
```
créer un montage artistique en mosaïque avec ces 4 photos
```

**🤖 API reçoit :**
- `imageurl` = Photo 1
- `imageurl2` = Photo 2
- `imageurl3` = Photo 3
- `imageurl4` = Photo 4
- `prompt` = "créer un montage artistique en mosaïque avec ces 4 photos"

**✅ Résultat :** Un montage en mosaïque avec les 4 images

---

### Scénario 5 : Transformation sélective
**📷 Envoyer :** 2 photos

**💬 Commande :**
```
appliquer le style de la 2ème photo sur la 1ère photo
```

**🤖 API reçoit :**
- `imageurl` = Photo 1 (image cible)
- `imageurl2` = Photo 2 (image style)
- `prompt` = "appliquer le style de la 2ème photo sur la 1ère photo"

**✅ Résultat :** La photo 1 avec le style artistique de la photo 2

---

### Scénario 6 : Composition avancée
**📷 Envoyer :** 3 photos (Personne, Arrière-plan, Effet)

**💬 Commande :**
```
placer la personne de la 1ère photo sur l'arrière-plan de la 2ème et appliquer l'effet de la 3ème
```

**🤖 API reçoit :**
- `imageurl` = Photo personne
- `imageurl2` = Photo arrière-plan
- `imageurl3` = Photo effet
- `prompt` = "placer la personne de la 1ère photo sur l'arrière-plan de la 2ème et appliquer l'effet de la 3ème"

**✅ Résultat :** Composition complexe avec les 3 éléments

---

### Scénario 7 : Before/After
**📷 Envoyer :** 2 photos

**💬 Commande :**
```
créer une image avant/après avec ces deux photos
```

**🤖 API reçoit :**
- `imageurl` = Photo "avant"
- `imageurl2` = Photo "après"
- `prompt` = "créer une image avant/après avec ces deux photos"

**✅ Résultat :** Image divisée avec avant à gauche et après à droite

---

## 🔧 Détails techniques

### Structure de l'URL API
```
https://norch-project.gleeze.com/api/gemini/nano-banana
  ?prompt=<transformation>
  &imageurl=<photo1>
  &imageurl2=<photo2>
  &imageurl3=<photo3>
  &imageurl4=<photo4>
  ...
```

### Ordre des images
- **1ère image** → `imageurl`
- **2ème image** → `imageurl2`
- **3ème image** → `imageurl3`
- **4ème image** → `imageurl4`
- Et ainsi de suite...

### Messages du bot
- **1 image :** `🖼️ J'ai bien reçu votre photo !`
- **Plusieurs images :** `🖼️ J'ai bien reçu vos 3 photos !`
- **Pendant transformation :** `🎨 Transformation de vos 3 images en cours...`

---

## 💡 Conseils d'utilisation

1. **Soyez précis** : Mentionnez "1ère photo", "2ème photo" pour être clair
2. **Ordre important** : L'ordre d'envoi des images est conservé
3. **Combinez** : Vous pouvez mélanger plusieurs transformations
4. **Expérimentez** : L'IA comprend des demandes complexes

---

## ⚠️ Limites

- Délai minimum de **3 secondes** entre deux transformations
- Timeout de **60 secondes** pour la génération
- Une seule transformation à la fois par utilisateur

---

## 🚀 Exemples courts

| Nombre d'images | Commande exemple |
|-----------------|------------------|
| 2 photos | `swap les visages` |
| 2 photos | `collage vertical` |
| 3 photos | `montage créatif` |
| 4 photos | `grille 2x2` |
| 2 photos | `fusionner en une image` |
| 3 photos | `style de la 3ème sur les 2 premières` |

---

**Date de création :** 17 novembre 2025  
**Version :** 2.0 - Support multi-images
