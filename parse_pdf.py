import re
import json

def clean_text(text):
    # Remove headers and footers
    text = re.sub(r'Référence N° CPS-xxxx-202x\s*\n\s*……………………. -AWB Reproduction interdite\s*Page - \d+ - sur 47 …………………. …\s*', '', text)
    return text.strip()

with open('pdf_text.txt', 'r', encoding='utf-8') as f:
    raw_text = f.read()

text = clean_text(raw_text)

# Find Roman numeral sections for categories
# e.g. "III. MISE EN ŒUVRE DU PROGICIEL"
section_pattern = re.compile(r'\n([IVX]+)\.\s+([^\n]+)')
sections = []
for match in section_pattern.finditer(text):
    sections.append({
        'start': match.start(),
        'title': f"{match.group(1)}. {match.group(2).strip()}"
    })

# Find Articles
# e.g. "ARTICLE 1 - OBJET" or "ARTICLE 12 – DUREE"
article_pattern = re.compile(r'\nARTICLE\s+(\d+)[\s\-–]+([^\n]+)')
articles_matches = list(article_pattern.finditer(text))

articles = []
for i, match in enumerate(articles_matches):
    art_num = match.group(1)
    art_title = match.group(2).strip()
    start_pos = match.end()
    
    end_pos = len(text)
    if i + 1 < len(articles_matches):
        end_pos = articles_matches[i+1].start()
        
    content = text[start_pos:end_pos].strip()
    
    # Determine section
    current_section = "GENERALITES"
    for sec in reversed(sections):
        if sec['start'] < match.start():
            current_section = sec['title']
            break
            
    # Find variables like {{VAR}} or [VAR]
    # In the PDF they might not be formatted as {{VAR}}, they might be "……………………" or similar.
    # We will just inject some standard variables based on keywords, or keep it simple.
    variables = []
    if "logiciel" in content.lower(): variables.append("{{NOM_LOGICIEL}}")
    if "délai" in content.lower() or "durée" in content.lower(): variables.append("{{DUREE_MOIS}}")
    if "prix" in content.lower() or "redevance" in content.lower(): variables.append("{{MONTANT_REDEVANCE}}")
    if "pénalité" in content.lower(): variables.append("{{TAUX_PENALITE}}")
    
    # Also find explicit {{VAR}} if any
    vars_found = re.findall(r'\{\{([^}]+)\}\}', content)
    variables.extend(["{{" + v + "}}" for v in vars_found])
    
    # Remove duplicates
    variables = list(set(variables))
    
    article_obj = {
        "id": f"ART_{int(art_num):02d}",
        "categorie": current_section,
        "titre": f"ARTICLE {art_num} - {art_title}",
        "condition_generation": "TOUJOURS_INCLURE",
        "variables": variables,
        "contenu": content
    }
    
    articles.append(article_obj)

# Create the final JSON
final_json = {
    "catalogue_contrat_it": {
        "version": "1.0",
        "date_mise_a_jour": "2026-04-20",
        "articles": articles
    }
}

with open('contrat-global-complet.json', 'w', encoding='utf-8') as f:
    json.dump(final_json, f, ensure_ascii=False, indent=2)

print(f"Successfully extracted {len(articles)} articles!")
