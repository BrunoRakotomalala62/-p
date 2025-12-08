from flask import Flask, request, jsonify
import requests
import urllib.parse
import json

app = Flask(__name__)

LANGUAGES = {
    "FR": {"code": "fr", "name": "français"},
    "EN": {"code": "en", "name": "anglais"},
    "MLG": {"code": "mg", "name": "malgache"},
    "ES": {"code": "es", "name": "espagnol"},
    "DE": {"code": "de", "name": "allemand"},
    "IT": {"code": "it", "name": "italien"},
    "PT": {"code": "pt", "name": "portugais"},
    "ZH": {"code": "zh", "name": "chinois"},
    "JA": {"code": "ja", "name": "japonais"},
    "AR": {"code": "ar", "name": "arabe"},
    "RU": {"code": "ru", "name": "russe"},
    "KO": {"code": "ko", "name": "coréen"},
    "NL": {"code": "nl", "name": "néerlandais"},
    "PL": {"code": "pl", "name": "polonais"},
    "TR": {"code": "tr", "name": "turc"},
    "VI": {"code": "vi", "name": "vietnamien"},
    "TH": {"code": "th", "name": "thaï"},
    "ID": {"code": "id", "name": "indonésien"},
    "HI": {"code": "hi", "name": "hindi"},
    "SW": {"code": "sw", "name": "swahili"},
}

CODE_TO_LANG = {info["code"]: code for code, info in LANGUAGES.items()}

def translate_with_auto_detect(text, target_lang, source_lang=None):
    if target_lang not in LANGUAGES:
        return None, None, f"Langue cible '{target_lang}' non supportée"
    
    if source_lang and source_lang not in LANGUAGES:
        return None, None, f"Langue source '{source_lang}' non supportée"
    
    source_code = LANGUAGES[source_lang]["code"] if source_lang else "auto"
    target_code = LANGUAGES[target_lang]["code"]
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
    
    try:
        encoded_text = urllib.parse.quote(text)
        url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={source_code}&tl={target_code}&dt=t&q={encoded_text}"
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        result = response.json()
        
        translated_text = None
        detected_lang_code = None
        
        if result and isinstance(result, list) and len(result) > 0:
            translated_parts = []
            if result[0]:
                for part in result[0]:
                    if part and len(part) > 0 and part[0]:
                        translated_parts.append(part[0])
            
            if translated_parts:
                translated_text = ''.join(translated_parts)
            
            if len(result) > 2 and result[2]:
                detected_lang_code = result[2]
        
        if translated_text:
            detected_lang = CODE_TO_LANG.get(detected_lang_code, None)
            return translated_text, detected_lang, None
        
        return None, None, "Impossible d'extraire la traduction de la réponse"
        
    except requests.exceptions.Timeout:
        return None, None, "Délai d'attente dépassé lors de la connexion au service de traduction"
    except requests.exceptions.RequestException as e:
        return None, None, f"Erreur de connexion: {str(e)}"
    except json.JSONDecodeError:
        return None, None, "Erreur lors du décodage de la réponse"
    except Exception as e:
        return None, None, f"Erreur inattendue: {str(e)}"

@app.route('/')
def home():
    return jsonify({
        "message": "API de Traduction",
        "usage": "/translate?texte=<texte>&langue=<CODE_LANGUE>",
        "parametres": {
            "texte": "Le texte à traduire (obligatoire)",
            "langue": "Code de la langue cible: FR, EN, MLG, ES, DE, IT, etc. (obligatoire)",
            "source": "Code de la langue source (optionnel, détection automatique si absent)"
        },
        "langues_supportees": list(LANGUAGES.keys()),
        "exemples": [
            "/translate?texte=Salama inona ny vaovao?&langue=FR",
            "/translate?texte=Bonjour comment allez-vous?&langue=MLG",
            "/translate?texte=Hello how are you?&langue=FR&source=EN",
            "/translate?texte=Hola como estas?&langue=FR"
        ]
    })

@app.route('/translate', methods=['GET'])
def translate():
    texte = request.args.get('texte', '').strip()
    langue_cible = request.args.get('langue', '').upper().strip()
    langue_source = request.args.get('source', '').upper().strip() or None
    
    if not texte:
        return jsonify({
            "erreur": "Paramètre 'texte' manquant",
            "usage": "/translate?texte=<texte>&langue=<CODE_LANGUE>"
        }), 400
    
    if not langue_cible:
        return jsonify({
            "erreur": "Paramètre 'langue' manquant",
            "usage": "/translate?texte=<texte>&langue=<CODE_LANGUE>",
            "langues_disponibles": list(LANGUAGES.keys())
        }), 400
    
    if langue_cible not in LANGUAGES:
        return jsonify({
            "erreur": f"Langue cible '{langue_cible}' non supportée",
            "langues_disponibles": list(LANGUAGES.keys())
        }), 400
    
    if langue_source and langue_source not in LANGUAGES:
        return jsonify({
            "erreur": f"Langue source '{langue_source}' non supportée",
            "langues_disponibles": list(LANGUAGES.keys())
        }), 400
    
    detection_auto = langue_source is None
    
    traduction, detected_lang, erreur = translate_with_auto_detect(texte, langue_cible, langue_source)
    
    if erreur:
        return jsonify({
            "erreur": erreur,
            "texte_original": texte,
            "langue_source": langue_source,
            "langue_cible": langue_cible,
            "detection_automatique": detection_auto
        }), 500
    
    final_source_lang = langue_source if langue_source else detected_lang
    
    if final_source_lang and final_source_lang == langue_cible:
        return jsonify({
            "texte_original": texte,
            "traduction": texte,
            "langue_source": final_source_lang,
            "langue_source_nom": LANGUAGES.get(final_source_lang, {}).get("name", "inconnue"),
            "langue_cible": langue_cible,
            "langue_cible_nom": LANGUAGES[langue_cible]["name"],
            "detection_automatique": detection_auto,
            "note": "Les langues source et cible sont identiques"
        })
    
    response_data = {
        "texte_original": texte,
        "traduction": traduction,
        "langue_cible": langue_cible,
        "langue_cible_nom": LANGUAGES[langue_cible]["name"],
        "detection_automatique": detection_auto
    }
    
    if final_source_lang:
        response_data["langue_source"] = final_source_lang
        response_data["langue_source_nom"] = LANGUAGES.get(final_source_lang, {}).get("name", "inconnue")
    elif detected_lang:
        response_data["langue_source"] = detected_lang
        response_data["langue_source_nom"] = LANGUAGES.get(detected_lang, {}).get("name", "inconnue")
    else:
        response_data["langue_source"] = "auto"
        response_data["langue_source_nom"] = "détectée automatiquement"
    
    return jsonify(response_data)

@app.route('/langues', methods=['GET'])
def get_languages():
    return jsonify({
        "langues": {code: info["name"] for code, info in LANGUAGES.items()}
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
