import json
import re

def process_json():
    with open('contrat-global-complet.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    articles = data.get('catalogue_contrat_it', {}).get('articles', [])

    replacements = [
        (re.compile(r'Attijariwafa bank'), '{{NOM_CLIENT}}'),
        (re.compile(r'Tribunal de Commerce de Casablanca'), '{{TRIBUNAL_COMPETENT}}'),
        (re.compile(r'droit Marocain', re.IGNORECASE), '{{DROIT_APPLICABLE}}'),
        (re.compile(r'l’Editeur/Intégrateur|L’Editeur/Intégrateur|l\'Editeur/Intégrateur'), '{{ROLE_PRESTATAIRE}}'),
        (re.compile(r'Dirhams 2\.151\.408\.390,00'), '{{CAPITAL_CLIENT}}'),
        (re.compile(r'numéro 333'), '{{RC_CLIENT}}'),
        (re.compile(r'Casablanca au 2, Boulevard Moulay Youssef'), '{{ADRESSE_CLIENT}}'),
        (re.compile(r'PROGICIEL [\.\…]+'), '{{TYPE_OBJET_CONTRAT}} {{NOM_OBJET_CONTRAT}}'),
        (re.compile(r'Madame/Monsieur [\.\…]+ en sa qualité de [\.\…]+'), '{{REPRESENTANT_CLIENT}} en sa qualité de {{QUALITE_REPRESENTANT_CLIENT}}'),
        (re.compile(r'Monsieur [\.\…]+, agissant en qualité de [\.\…]+,'), '{{REPRESENTANT_PRESTATAIRE}} agissant en qualité de {{QUALITE_REPRESENTANT_PRESTATAIRE}}'),
        (re.compile(r'Société [\.\…]+ au capital de [\.\…]+, Immatriculée au Registre du Commerce et des Sociétés de [\.\…]+ sous le numéro [\.\…]+, Dont le siège social est sis [\.\…]+dûment représentée'), '{{NOM_PRESTATAIRE}} au capital de {{CAPITAL_PRESTATAIRE}}, Immatriculée au Registre du Commerce et des Sociétés de {{VILLE_RC_PRESTATAIRE}} sous le numéro {{RC_PRESTATAIRE}}, Dont le siège social est sis {{ADRESSE_PRESTATAIRE}} dûment représentée'),
        (re.compile(r'solution informatique intégrée'), '{{TYPE_SOLUTION}}'),
        (re.compile(r'solution [\.\…]+'), 'solution {{NOM_OBJET_CONTRAT}}'),
    ]

    for article in articles:
        contenu = article.get('contenu', '')
        
        # Apply replacements
        for pattern, replacement in replacements:
            contenu = pattern.sub(replacement, contenu)
        
        # Also clean up empty dot lines
        contenu = re.sub(r'(?m)^[\.\…]+[;\s]*$', '', contenu)
        
        # Extract variables from contenu
        extracted_vars = set(re.findall(r'(\{\{[A-Z0-9_]+\}\})', contenu))
        
        article['contenu'] = contenu
        
        # Update variables list
        existing_vars = set(article.get('variables', []))
        # Remove [A_COMPLETER]
        if '[A_COMPLETER]' in existing_vars:
            existing_vars.remove('[A_COMPLETER]')
            
        combined_vars = list(existing_vars.union(extracted_vars))
        combined_vars.sort()
        article['variables'] = combined_vars

    with open('contrat-global-complet.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    process_json()
    print("Variables dynamiques ajoutées au JSON avec succès.")
