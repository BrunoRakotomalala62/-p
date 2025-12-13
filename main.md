from flask import Flask, request, jsonify
import requests
from bs4 import BeautifulSoup
import urllib.parse
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

app = Flask(__name__)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
}

BOOK_TYPES = {
    'roman': ['roman pdf', 'novel pdf', 'fiction pdf', 'livre roman'],
    'educatif': ['textbook pdf', 'cours pdf', 'education pdf', 'manuel scolaire pdf'],
    'technique': ['programming pdf', 'tutorial pdf', 'guide technique pdf'],
    'science': ['science pdf', 'research paper pdf', 'scientific pdf'],
    'all': ['book pdf', 'livre pdf', 'ebook pdf']
}

BACC_SERIES = ['A', 'C', 'D', 'OSE', 'S', 'L']
BACC_MATIERES = {
    'mathematiques': ['maths', 'math', 'mathematiques'],
    'physique': ['physique', 'physique-chimie', 'pc'],
    'chimie': ['chimie', 'sciences physiques'],
    'svt': ['svt', 'biologie', 'sciences naturelles'],
    'philosophie': ['philosophie', 'philo'],
    'francais': ['francais', 'français', 'dissertation'],
    'anglais': ['anglais', 'english'],
    'histoire-geo': ['histoire', 'geographie', 'histoire-geo', 'hg'],
    'malagasy': ['malagasy', 'malgache'],
    'economie': ['economie', 'eco', 'economique']
}

EDUCMAD_COURSES = {
    'mathematiques': {'A': 817, 'C': 129, 'D': 816},
    'physique': {'C': 130, 'D': 818},
    'svt': {'D': 819},
    'philosophie': {'A': 820, 'C': 821, 'D': 822}
}


def extract_real_url(href):
    """Extrait l'URL reelle depuis un lien DuckDuckGo"""
    if 'uddg=' in href:
        try:
            match = re.search(r'uddg=([^&]+)', href)
            if match:
                return urllib.parse.unquote(match.group(1))
        except:
            pass
    if href.startswith('//'):
        return 'https:' + href
    return href


def extract_filename(url):
    """Extrait le nom du fichier PDF depuis l'URL"""
    try:
        path = urllib.parse.urlparse(url).path
        filename = path.split('/')[-1]
        if filename:
            filename = urllib.parse.unquote(filename)
            if not filename.lower().endswith('.pdf'):
                filename = filename + '.pdf'
            return filename
    except:
        pass
    return "document.pdf"


def search_duckduckgo(query, num_results=30):
    """Recherche via DuckDuckGo HTML"""
    search_query = f"{query} filetype:pdf"
    encoded_query = urllib.parse.quote(search_query)
    url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        results = []
        for result in soup.find_all('div', class_='result'):
            link_tag = result.find('a', class_='result__a')
            if link_tag:
                href = link_tag.get('href', '')
                title = link_tag.get_text()
                
                snippet_tag = result.find('a', class_='result__snippet')
                description = snippet_tag.get_text() if snippet_tag else ''
                
                real_url = extract_real_url(href)
                
                if '.pdf' in real_url.lower() or 'pdf' in title.lower():
                    results.append({
                        "titre": title.replace('PDF ', '').strip(),
                        "nom_fichier": extract_filename(real_url),
                        "lien_pdf": real_url,
                        "url_image": None,
                        "description": description[:300],
                        "source": "duckduckgo"
                    })
                    
                    if len(results) >= num_results:
                        break
        
        return results
        
    except Exception as e:
        return []


def search_archive_org(query, num_results=20):
    """Recherche sur Archive.org pour des livres gratuits"""
    encoded_query = urllib.parse.quote(query)
    url = f"https://archive.org/advancedsearch.php?q={encoded_query}+mediatype:texts&fl[]=identifier,title,description,format&rows={num_results}&output=json"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        data = response.json()
        
        results = []
        for doc in data.get('response', {}).get('docs', []):
            identifier = doc.get('identifier', '')
            title = doc.get('title', 'Sans titre')
            description = doc.get('description', '')
            
            if isinstance(description, list):
                description = ' '.join(description)
            
            pdf_url = f"https://archive.org/download/{identifier}/{identifier}.pdf"
            image_url = f"https://archive.org/services/img/{identifier}"
            
            results.append({
                "titre": title,
                "nom_fichier": f"{identifier}.pdf",
                "lien_pdf": pdf_url,
                "url_image": image_url,
                "description": str(description)[:300] if description else '',
                "source": "archive.org"
            })
        
        return results
        
    except Exception as e:
        return []


def search_openlibrary(query, num_results=20):
    """Recherche sur Open Library"""
    encoded_query = urllib.parse.quote(query)
    url = f"https://openlibrary.org/search.json?q={encoded_query}&limit={num_results}"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        data = response.json()
        
        results = []
        for doc in data.get('docs', []):
            title = doc.get('title', 'Sans titre')
            author = doc.get('author_name', ['Inconnu'])[0] if doc.get('author_name') else 'Inconnu'
            key = doc.get('key', '')
            
            ia_id = doc.get('ia', [''])[0] if doc.get('ia') else ''
            cover_i = doc.get('cover_i')
            isbn_list = doc.get('isbn', [])
            olid = key.replace('/works/', '') if key else ''
            edition_key = doc.get('edition_key', [''])[0] if doc.get('edition_key') else ''
            
            image_url = None
            if cover_i:
                image_url = f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg"
            elif isbn_list:
                image_url = f"https://covers.openlibrary.org/b/isbn/{isbn_list[0]}-L.jpg"
            elif edition_key:
                image_url = f"https://covers.openlibrary.org/b/olid/{edition_key}-L.jpg"
            elif ia_id:
                image_url = f"https://archive.org/services/img/{ia_id}"
            
            if ia_id:
                pdf_url = f"https://archive.org/download/{ia_id}/{ia_id}.pdf"
                nom_fichier = f"{ia_id}.pdf"
            else:
                pdf_url = f"https://openlibrary.org{key}"
                nom_fichier = f"{title.replace(' ', '_')[:50]}.pdf"
            
            results.append({
                "titre": f"{title} - {author}",
                "nom_fichier": nom_fichier,
                "lien_pdf": pdf_url,
                "url_image": image_url,
                "description": f"Auteur: {author}. Annee: {doc.get('first_publish_year', 'N/A')}",
                "source": "openlibrary"
            })
        
        return results
        
    except Exception as e:
        return []


def search_gutenberg(query, num_results=15):
    """Recherche sur Project Gutenberg"""
    encoded_query = urllib.parse.quote(query)
    url = f"https://gutendex.com/books/?search={encoded_query}"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        data = response.json()
        
        results = []
        for book in data.get('results', [])[:num_results]:
            title = book.get('title', 'Sans titre')
            authors = book.get('authors', [])
            author = authors[0].get('name', 'Inconnu') if authors else 'Inconnu'
            
            formats = book.get('formats', {})
            pdf_url = formats.get('application/pdf', '')
            if not pdf_url:
                pdf_url = formats.get('text/html', '')
            if not pdf_url:
                pdf_url = formats.get('text/plain; charset=utf-8', '')
            
            image_url = formats.get('image/jpeg')
            
            if pdf_url:
                results.append({
                    "titre": f"{title} - {author}",
                    "nom_fichier": extract_filename(pdf_url),
                    "lien_pdf": pdf_url,
                    "url_image": image_url,
                    "description": f"Auteur: {author}. Livre classique du domaine public.",
                    "source": "gutenberg"
                })
        
        return results
        
    except Exception as e:
        return []


def search_all_sources(query, book_type='all', limite=50):
    """Recherche sur toutes les sources en parallele"""
    all_results = []
    
    search_queries = [query]
    if book_type in BOOK_TYPES:
        for suffix in BOOK_TYPES[book_type][:2]:
            search_queries.append(f"{query} {suffix}")
    
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = []
        
        for q in search_queries[:2]:
            futures.append(executor.submit(search_duckduckgo, q, limite // 2))
        
        futures.append(executor.submit(search_archive_org, query, limite // 3))
        futures.append(executor.submit(search_openlibrary, query, limite // 3))
        futures.append(executor.submit(search_gutenberg, query, limite // 4))
        
        for future in as_completed(futures):
            try:
                results = future.result()
                all_results.extend(results)
            except:
                pass
    
    seen_urls = set()
    unique_results = []
    for r in all_results:
        url = r.get('lien_pdf', '')
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique_results.append(r)
    
    return unique_results[:limite]


search_cache = {}
bacc_cache = {}


def search_educmad(matiere, serie, annee_debut=1999, annee_fin=2025):
    """Scrape EDUCMAD pour les sujets Bacc Madagascar - extrait les vrais liens PDF"""
    results = []
    
    if matiere not in EDUCMAD_COURSES:
        return results
    
    series_courses = EDUCMAD_COURSES.get(matiere, {})
    if serie and serie.upper() in series_courses:
        course_ids = {serie.upper(): series_courses[serie.upper()]}
    else:
        course_ids = series_courses
    
    for serie_name, course_id in course_ids.items():
        for section in [1, 2]:
            url = f"http://mediatheque.accesmad.org/educmad/course/view.php?id={course_id}&section={section}"
            is_corrige_section = (section == 2)
            
            try:
                response = requests.get(url, headers=HEADERS, timeout=15)
                soup = BeautifulSoup(response.text, 'html.parser')
                
                for activity in soup.find_all('div', {'data-activityname': True}):
                    activity_name = activity.get('data-activityname', '')
                    
                    link = activity.find('a', class_='aalink')
                    if link and link.get('href'):
                        href = link.get('href', '')
                        
                        if '/mod/resource/view.php' in href:
                            pdf_url = href + ('&redirect=1' if '?' in href else '?redirect=1')
                            
                            for year in range(annee_debut, annee_fin + 1):
                                if str(year) in activity_name:
                                    is_corrige = 'corrig' in activity_name.lower() or is_corrige_section
                                    
                                    results.append({
                                        "titre": activity_name.strip(),
                                        "url_image": "http://mediatheque.accesmad.org/educmad/theme/image.php/academi/core/1759829907/f/pdf",
                                        "lien_pdf": pdf_url,
                                        "annee": year,
                                        "serie": serie_name,
                                        "matiere": matiere,
                                        "type": "corrige" if is_corrige else "enonce",
                                        "source": "educmad"
                                    })
                                    break
            except Exception as e:
                pass
    
    return results


def search_exocorriges(matiere, serie, annee_debut=1999, annee_fin=2025):
    """Recherche sur ExoCorreiges pour les sujets Bacc Madagascar"""
    results = []
    
    query = f"bacc madagascar {matiere} serie {serie}" if serie else f"bacc madagascar {matiere}"
    encoded_query = urllib.parse.quote(query)
    url = f"https://exocorriges.com/ssearch.php?id_search={encoded_query}"
    
    try:
        search_url = f"https://html.duckduckgo.com/html/?q=site:exocorriges.com+{encoded_query}+pdf"
        response = requests.get(search_url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        for result in soup.find_all('div', class_='result'):
            link_tag = result.find('a', class_='result__a')
            if link_tag:
                href = link_tag.get('href', '')
                title = link_tag.get_text()
                real_url = extract_real_url(href)
                
                for year in range(annee_debut, annee_fin + 1):
                    if str(year) in title or str(year) in real_url:
                        is_corrige = 'corrig' in title.lower()
                        detected_serie = serie or 'C'
                        for s in BACC_SERIES:
                            if f'serie {s.lower()}' in title.lower() or f'série {s.lower()}' in title.lower():
                                detected_serie = s
                                break
                        
                        results.append({
                            "titre": title.strip(),
                            "url_image": None,
                            "lien_pdf": real_url,
                            "annee": year,
                            "serie": detected_serie,
                            "matiere": matiere,
                            "type": "corrige" if is_corrige else "enonce",
                            "source": "exocorriges"
                        })
                        break
    except Exception as e:
        pass
    
    return results


def search_bac_madagascar(matiere, serie, annee_debut=1999, annee_fin=2025):
    """Recherche sur bac-madagascar.net"""
    results = []
    
    query = f"site:bac-madagascar.net bacc {matiere} serie {serie} pdf" if serie else f"site:bac-madagascar.net bacc {matiere} pdf"
    encoded_query = urllib.parse.quote(query)
    
    try:
        search_url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
        response = requests.get(search_url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        for result in soup.find_all('div', class_='result'):
            link_tag = result.find('a', class_='result__a')
            if link_tag:
                href = link_tag.get('href', '')
                title = link_tag.get_text()
                real_url = extract_real_url(href)
                
                for year in range(annee_debut, annee_fin + 1):
                    if str(year) in title or str(year) in real_url:
                        is_corrige = 'corrig' in title.lower()
                        detected_serie = serie or ''
                        for s in BACC_SERIES:
                            if f'serie {s.lower()}' in title.lower() or f'série {s.lower()}' in title.lower():
                                detected_serie = s
                                break
                        
                        results.append({
                            "titre": title.strip(),
                            "url_image": None,
                            "lien_pdf": real_url,
                            "annee": year,
                            "serie": detected_serie,
                            "matiere": matiere,
                            "type": "corrige" if is_corrige else "enonce",
                            "source": "bac-madagascar"
                        })
                        break
    except Exception as e:
        pass
    
    return results


def generate_bacc_results(matiere=None, serie=None, annee=None):
    """Ne génère plus de résultats placeholder - on utilise uniquement les vrais liens scrapés"""
    return []


def search_all_bacc_sources(matiere=None, serie=None, annee=None, limite=100):
    """Recherche sur toutes les sources Bacc en parallèle"""
    all_results = []
    annee_debut = annee if annee else 1999
    annee_fin = annee if annee else 2025
    
    mat = matiere.lower() if matiere else 'mathematiques'
    ser = serie.upper() if serie else None
    
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [
            executor.submit(search_educmad, mat, ser, annee_debut, annee_fin),
            executor.submit(search_exocorriges, mat, ser, annee_debut, annee_fin),
            executor.submit(search_bac_madagascar, mat, ser, annee_debut, annee_fin),
        ]
        
        for future in as_completed(futures):
            try:
                results = future.result()
                all_results.extend(results)
            except:
                pass
    
    if len(all_results) < limite:
        generated = generate_bacc_results(mat, ser, annee)
        all_results.extend(generated)
    
    seen = set()
    unique_results = []
    for r in all_results:
        key = f"{r.get('annee')}_{r.get('serie')}_{r.get('matiere')}_{r.get('type')}"
        if key not in seen:
            seen.add(key)
            unique_results.append(r)
    
    unique_results.sort(key=lambda x: (x.get('annee', 0), x.get('serie', '')), reverse=True)
    
    return unique_results[:limite]


@app.route('/sujets', methods=['GET'])
def sujets():
    """Endpoint pour les sujets Bacc Madagascar"""
    matiere = request.args.get('matiere', request.args.get('sujet', ''))
    serie = request.args.get('serie', '')
    annee = request.args.get('annee', '')
    type_doc = request.args.get('type', '').lower()
    page = request.args.get('page', '1')
    par_page = request.args.get('par_page', '50')
    
    try:
        page = max(1, int(page))
    except:
        page = 1
    
    try:
        par_page = min(max(1, int(par_page)), 200)
    except:
        par_page = 50
    
    try:
        annee = int(annee) if annee else None
    except:
        annee = None
    
    cache_key = f"bacc_{matiere}_{serie}_{annee}"
    
    if cache_key in bacc_cache:
        all_results = bacc_cache[cache_key]
    else:
        all_results = search_all_bacc_sources(
            matiere=matiere if matiere else None,
            serie=serie if serie else None,
            annee=annee,
            limite=500
        )
        bacc_cache[cache_key] = all_results
        if len(bacc_cache) > 30:
            oldest_key = list(bacc_cache.keys())[0]
            del bacc_cache[oldest_key]
    
    if type_doc:
        if type_doc in ['sujet', 'enonce', 'énoncé']:
            all_results = [r for r in all_results if r.get('type') == 'enonce']
        elif type_doc in ['correction', 'corrige', 'corrigé']:
            all_results = [r for r in all_results if r.get('type') == 'corrige']
    
    total_resultats = len(all_results)
    total_pages = (total_resultats + par_page - 1) // par_page if total_resultats > 0 else 1
    
    start_index = (page - 1) * par_page
    end_index = start_index + par_page
    page_results = all_results[start_index:end_index]
    
    return jsonify({
        "recherche": {
            "matiere": matiere or "toutes",
            "serie": serie or "toutes",
            "annee": annee or "1999-2025",
            "type": type_doc or "tous"
        },
        "pagination": {
            "page_actuelle": page,
            "par_page": par_page,
            "total_pages": total_pages,
            "total_resultats": total_resultats
        },
        "nombre_resultats": len(page_results),
        "sujets": page_results,
        "series_disponibles": BACC_SERIES,
        "matieres_disponibles": list(BACC_MATIERES.keys()),
        "types_disponibles": ["sujet", "correction"]
    })


@app.route('/recherche', methods=['GET'])
def recherche():
    livre = request.args.get('livre', '')
    book_type = request.args.get('type', 'all')
    page = request.args.get('page', '1')
    par_page = request.args.get('par_page', '100')
    
    try:
        page = max(1, int(page))
    except:
        page = 1
    
    try:
        par_page = min(max(1, int(par_page)), 200)
    except:
        par_page = 100
    
    if not livre:
        return jsonify({
            "error": "Parametre 'livre' requis",
            "exemple": "/recherche?livre=python&page=1&par_page=100"
        }), 400
    
    cache_key = f"{livre}_{book_type}"
    
    if cache_key in search_cache:
        all_results = search_cache[cache_key]
    else:
        all_results = search_all_sources(livre, book_type, limite=500)
        search_cache[cache_key] = all_results
        if len(search_cache) > 50:
            oldest_key = list(search_cache.keys())[0]
            del search_cache[oldest_key]
    
    total_resultats = len(all_results)
    total_pages = (total_resultats + par_page - 1) // par_page if total_resultats > 0 else 1
    
    start_index = (page - 1) * par_page
    end_index = start_index + par_page
    page_results = all_results[start_index:end_index]
    
    return jsonify({
        "recherche": livre,
        "type": book_type,
        "pagination": {
            "page_actuelle": page,
            "par_page": par_page,
            "total_pages": total_pages,
            "total_resultats": total_resultats,
            "page_precedente": f"/recherche?livre={livre}&type={book_type}&page={page-1}&par_page={par_page}" if page > 1 else None,
            "page_suivante": f"/recherche?livre={livre}&type={book_type}&page={page+1}&par_page={par_page}" if page < total_pages else None
        },
        "nombre_resultats": len(page_results),
        "livres": page_results
    })


@app.route('/', methods=['GET'])
def index():
    return jsonify({
        "api": "MeoBook PDF Search API",
        "description": "Recherche dynamique de livres PDF et sujets Bacc Madagascar",
        "endpoints": {
            "/recherche": {
                "methode": "GET",
                "description": "Recherche de livres PDF",
                "parametres": {
                    "livre": "Nom du livre a rechercher (requis)",
                    "type": "Type: roman, educatif, technique, science, all (defaut: all)",
                    "page": "Numero de page (defaut: 1)",
                    "par_page": "Resultats par page (defaut: 100, max: 200)"
                },
                "exemples": [
                    "/recherche?livre=python",
                    "/recherche?livre=harry potter&type=roman&page=1&par_page=50"
                ]
            },
            "/sujets": {
                "methode": "GET",
                "description": "Sujets et corrections Bacc Madagascar (1999-2025)",
                "parametres": {
                    "matiere": "Matiere: mathematiques, physique, svt, philosophie, francais, anglais, etc.",
                    "serie": "Serie: A, C, D, OSE, S, L",
                    "annee": "Annee specifique (ex: 2023)",
                    "page": "Numero de page (defaut: 1)",
                    "par_page": "Resultats par page (defaut: 50)"
                },
                "exemples": [
                    "/sujets?matiere=mathematiques&serie=C",
                    "/sujets?matiere=physique&serie=D&annee=2023",
                    "/sujets?serie=A",
                    "/sujets"
                ],
                "series_disponibles": BACC_SERIES,
                "matieres_disponibles": list(BACC_MATIERES.keys())
            }
        },
        "sources": {
            "livres": ["DuckDuckGo", "Archive.org", "Open Library", "Project Gutenberg"],
            "bacc": ["EDUCMAD/ACCESMAD", "bac-madagascar.net", "ExoCorreiges"]
        }
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
