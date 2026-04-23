import docx
import re
import json

doc = docx.Document('Modèle Contrat Informatique Global L-MEO-M _ V CJG DEC 2025.docx')

sections = []
articles = []
current_section = "GENERALITES"
current_condition = "TOUJOURS_INCLURE"

current_article = None

def determine_condition(title):
    title = title.upper()
    if 'LOGICIEL' in title or 'LICENCE' in title or 'PROGICIEL' in title:
        return "TYPES_PROJET_INCLUDES('Logiciel')"
    if 'MATERIEL' in title or 'EQUIPEMENT' in title:
        return "TYPES_PROJET_INCLUDES('Matériel')"
    if 'MISE EN ŒUVRE' in title or 'MISE EN OEUVRE' in title or 'INTEGRATION' in title:
        return "TYPES_PROJET_INCLUDES('Mise en œuvre')"
    if 'MAINTENANCE' in title or 'SUPPORT' in title:
        return "TYPES_PROJET_INCLUDES('Maintenance')"
    if 'HEBERGEMENT' in title or 'SAAS' in title or 'CLOUD' in title:
        return "TYPES_PROJET_INCLUDES('Hébergement')"
    return "TOUJOURS_INCLURE"

# Patterns
article_pattern = re.compile(r'^ARTICLE\s+(\d+)[\s\-–\.]+(.*)', re.IGNORECASE)
section_pattern = re.compile(r'^([IVX]+)\.\s+(.*)')

# To detect variables like [Montant] or ...........
var_pattern = re.compile(r'\[([^\]]+)\]')
# Catch multiple dots, ellipsis chars, or underscores
dots_pattern = re.compile(r'(\.{3,}|…{2,}|_{3,})')

ident_art = { "id": "ART_001", "categorie": "I. IDENTIFICATION DES PARTIES", "titre": "IDENTIFICATION DES PARTIES", "condition_generation": "TOUJOURS_INCLURE", "variables": [], "contenu": "" }
pream_art = { "id": "ART_002", "categorie": "I. IDENTIFICATION DES PARTIES", "titre": "PREAMBULE", "condition_generation": "TOUJOURS_INCLURE", "variables": [], "contenu": "" }
def_art = { "id": "ART_003", "categorie": "I. DEFINITIONS", "titre": "DEFINITIONS", "condition_generation": "TOUJOURS_INCLURE", "variables": [], "contenu": "" }
annexes_art = { "id": "ART_999", "categorie": "VI. ANNEXES", "titre": "LISTE DES ANNEXES", "condition_generation": "TOUJOURS_INCLURE", "variables": [], "contenu": "" }

state = "IDENTIFICATION"

for para in doc.paragraphs:
    text = para.text.strip()
    if not text:
        continue
        
    if text == "PREAMBULE":
        state = "PREAMBULE"
    elif "-I-DEFINITIONS" in text or text == "DEFINITIONS":
        state = "DEFINITIONS"
    elif text == "ANNEXES":
        state = "ANNEXES"
        continue
    
    # Check if section
    sec_match = section_pattern.match(text)
    if sec_match and len(text) < 150: # Avoid matching paragraphs that happen to start with I. 
        current_section = text
        current_condition = determine_condition(text)
        continue
        
    # Check if article
    art_match = article_pattern.match(text)
    if art_match:
        state = "ARTICLE"
        if current_article:
            articles.append(current_article)
            
        art_num = art_match.group(1)
        art_title = art_match.group(2).strip()
        
        current_article = {
            "id": f"ART_{int(art_num):02d}",
            "categorie": current_section,
            "titre": f"ARTICLE {art_num} - {art_title}",
            "condition_generation": current_condition,
            "variables": [],
            "contenu": ""
        }
        continue
        
    target_art = None
    if state == "IDENTIFICATION":
        target_art = ident_art
    elif state == "PREAMBULE":
        target_art = pream_art
    elif state == "DEFINITIONS":
        target_art = def_art
    elif state == "ANNEXES":
        target_art = annexes_art
    elif state == "ARTICLE":
        target_art = current_article
        
    if target_art:
        # Standardize hardcoded values to variables
        text = re.sub(r'Attijariwafa bank', '{{NOM_CLIENT}}', text)
        text = re.sub(r'Tribunal de Commerce de Casablanca', '{{TRIBUNAL_COMPETENT}}', text)
        text = re.sub(r'(?i)droit Marocain', '{{DROIT_APPLICABLE}}', text)
        text = re.sub(r'l’Editeur/Intégrateur|L’Editeur/Intégrateur|l\'Editeur/Intégrateur', '{{ROLE_PRESTATAIRE}}', text)
        text = re.sub(r'Dirhams 2\.151\.408\.390,00', '{{CAPITAL_CLIENT}}', text)
        text = re.sub(r'numéro 333', '{{RC_CLIENT}}', text)
        text = re.sub(r'Casablanca au 2, Boulevard Moulay Youssef', '{{ADRESSE_CLIENT}}', text)
        text = re.sub(r'PROGICIEL [\.\…]+', '{{TYPE_OBJET_CONTRAT}} {{NOM_OBJET_CONTRAT}}', text)
        text = re.sub(r'Madame/Monsieur [\.\…]+ en sa qualité de [\.\…]+', '{{REPRESENTANT_CLIENT}} en sa qualité de {{QUALITE_REPRESENTANT_CLIENT}}', text)
        text = re.sub(r'Monsieur [\.\…]+, agissant en qualité de [\.\…]+,', '{{REPRESENTANT_PRESTATAIRE}} agissant en qualité de {{QUALITE_REPRESENTANT_PRESTATAIRE}}', text)
        text = re.sub(r'Société [\.\…]+ au capital de [\.\…]+, Immatriculée au Registre du Commerce et des Sociétés de [\.\…]+ sous le numéro [\.\…]+, Dont le siège social est sis [\.\…]+dûment représentée', '{{NOM_PRESTATAIRE}} au capital de {{CAPITAL_PRESTATAIRE}}, Immatriculée au Registre du Commerce et des Sociétés de {{VILLE_RC_PRESTATAIRE}} sous le numéro {{RC_PRESTATAIRE}}, Dont le siège social est sis {{ADRESSE_PRESTATAIRE}} dûment représentée', text)
        text = re.sub(r'solution informatique intégrée', '{{TYPE_SOLUTION}}', text)
        text = re.sub(r'solution [\.\…]+', 'solution {{NOM_OBJET_CONTRAT}}', text)

        target_art["contenu"] += text + "\n\n"
        
        # Extract explicit variables from paragraph [var]
        vars_found = var_pattern.findall(text)
        for v in vars_found:
            v_clean = v.strip()
            # if it's a real variable name
            if len(v_clean) < 40:
                target_art["variables"].append(f"[{v_clean}]")
                
        # Extract {{var}}
        braces_found = re.findall(r'\{\{([^}]+)\}\}', text)
        for v in braces_found:
            target_art["variables"].append(f"{{{{{v.strip()}}}}}")
                
        # If there are blanks to fill
        if dots_pattern.search(text):
            target_art["variables"].append("[A_COMPLETER]")

        # Semantic keywords
        txt_lower = text.lower()
        if "logiciel" in txt_lower or "progiciel" in txt_lower: target_art["variables"].append("{{NOM_LOGICIEL}}")
        if "délai" in txt_lower or "durée" in txt_lower: target_art["variables"].append("{{DUREE_MOIS}}")
        if "prix" in txt_lower or "redevance" in txt_lower: target_art["variables"].append("{{MONTANT_REDEVANCE}}")
        if "pénalité" in txt_lower: target_art["variables"].append("{{TAUX_PENALITE}}")

if current_article:
    articles.append(current_article)

articles.append(ident_art)
articles.append(pream_art)
articles.append(def_art)
articles.append(annexes_art)

# Clean up variables (deduplicate)
for art in articles:
    art["variables"] = list(set(art["variables"]))
    art["contenu"] = art["contenu"].strip()

# --- ENRICHMENT : Adapt template for SaaS, Matériel, and Prestations ---
additional_articles = []
art_counter = 100 # Start IDs from 100 for generated clauses

# 1. SAAS / HEBERGEMENT (Adapted from Logiciel/Progiciel)
for art in articles:
    if "CONCESSION" in art["categorie"].upper():
        new_art = art.copy()
        new_art["id"] = f"ART_{art_counter:03d}"
        new_art["categorie"] = "II.bis MISE A DISPOSITION EN MODE SAAS / HEBERGEMENT"
        new_art["condition_generation"] = "TYPES_PROJET_INCLUDES('Hébergement')"
        new_art["contenu"] = art["contenu"].replace("Progiciel", "Solution SaaS").replace("Licence", "Abonnement").replace("PROGICIEL", "SOLUTION SAAS").replace("LICENCE", "ABONNEMENT")
        new_art["variables"] = [v for v in art["variables"] if v != "{{NOM_LOGICIEL}}"]
        new_art["variables"].append("{{NOM_SOLUTION_SAAS}}")
        new_art["variables"] = list(set(new_art["variables"]))
        additional_articles.append(new_art)
        art_counter += 1

# 2. PRESTATIONS FORFAIT / REGIE (Adapted from Mise en oeuvre)
for art in articles:
    if "MISE EN ŒUVRE" in art["categorie"].upper() or "MISE EN OEUVRE" in art["categorie"].upper():
        new_art = art.copy()
        new_art["id"] = f"ART_{art_counter:03d}"
        new_art["categorie"] = "III.bis PRESTATIONS DE SERVICES (FORFAIT / REGIE)"
        # We assume 'Mise en œuvre' includes Forfait/Régie
        new_art["condition_generation"] = "TYPES_PROJET_INCLUDES('Mise en œuvre')" 
        new_art["contenu"] = art["contenu"].replace("mise en œuvre du Progiciel", "réalisation des Prestations").replace("Progiciel", "Livrable").replace("PROGICIEL", "LIVRABLE")
        new_art["variables"] = [v for v in art["variables"] if v != "{{NOM_LOGICIEL}}"]
        new_art["variables"] = list(set(new_art["variables"]))
        additional_articles.append(new_art)
        art_counter += 1

# 3. MATERIEL (Custom adaptation)
# We take a few key articles (Objet, Livraison, Garantie) and adapt them for hardware.
for art in articles:
    if "CONCESSION" in art["categorie"].upper():
        if "OBJET" in art["titre"].upper():
            new_art = art.copy()
            new_art["id"] = f"ART_{art_counter:03d}"
            new_art["categorie"] = "II.ter ACQUISITION DE MATERIEL"
            new_art["titre"] = "ARTICLE - OBJET DE L'ACQUISITION"
            new_art["condition_generation"] = "TYPES_PROJET_INCLUDES('Matériel')"
            new_art["contenu"] = "Le présent article a pour objet de définir les conditions dans lesquelles le CLIENT acquiert auprès du Prestataire le Matériel informatique détaillé en Annexe, ainsi que les droits et obligations qui en découlent."
            new_art["variables"] = ["{{DESCRIPTION_MATERIEL}}"]
            additional_articles.append(new_art)
            art_counter += 1
        elif "GARANTIE" in art["titre"].upper():
            new_art = art.copy()
            new_art["id"] = f"ART_{art_counter:03d}"
            new_art["categorie"] = "II.ter ACQUISITION DE MATERIEL"
            new_art["titre"] = "ARTICLE - GARANTIE MATERIEL"
            new_art["condition_generation"] = "TYPES_PROJET_INCLUDES('Matériel')"
            new_art["contenu"] = "Le Prestataire garantit que le Matériel est exempt de tout défaut de conception, de matière ou de fabrication. Cette garantie couvre le remplacement des pièces défectueuses et la main d'œuvre pour une durée de {{DUREE_GARANTIE_MOIS}} mois à compter de la livraison."
            new_art["variables"] = ["{{DUREE_GARANTIE_MOIS}}"]
            additional_articles.append(new_art)
            art_counter += 1

articles.extend(additional_articles)

def sort_articles(articles_list):
    def get_priority(art):
        titre = art.get("titre", "").upper()
        cat = art.get("categorie", "").upper()
        cond = art.get("condition_generation", "")
        
        # 1. Identification / Definitions / Annexes
        if titre == "IDENTIFICATION DES PARTIES" or titre == "PREAMBULE":
            return 1
        if titre == "DEFINITIONS":
            return 2
        if titre == "LISTE DES ANNEXES":
            return 3
            
        # 2. Common clauses (without condition)
        if cond == "TOUJOURS_INCLURE":
            return 4
            
        # 3. Conditional by project type
        if "Logiciel" in cond: return 5
        if "Hébergement" in cond or "SAAS" in cond.upper(): return 6
        if "Mise en œuvre" in cond or "PRESTATION" in cat: return 7
        if "Matériel" in cond or "MATERIEL" in cat: return 8
        if "Maintenance" in cond: return 9
        
        return 10
        
    return sorted(articles_list, key=get_priority)

articles = sort_articles(articles)

final_json = {
    "catalogue_contrat_it": {
        "version": "3.0",
        "date_mise_a_jour": "2026-04-20",
        "articles": articles
    }
}

with open('contrat-global-complet.json', 'w', encoding='utf-8') as f:
    json.dump(final_json, f, ensure_ascii=False, indent=2)

print(f"Extraction terminée: {len(articles)} articles générés (dont {len(additional_articles)} articles adaptés pour SaaS, Matériel, et Prestations).")
