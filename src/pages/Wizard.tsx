import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Article, Section } from '../types';
import { generateDocx } from '../utils/exportWord';
import { Download, FileSignature, Upload, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Wizard() {
  const [sections, setSections] = useState<Section[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  
  const [variables, setVariables] = useState({
    PRESTATAIRE_NOM: '',
    MONTANT_GLOBAL_HT: '',
    DELAI_PAIEMENT: '30',
    DATE_DEBUT: '',
    DUREE_SURVIE_CONFIDENTIALITE: '5',
    DUREE_LICENCE: 'Perpétuelle',
    AGENCE_DEPOT: 'APP',
    DELAI_RECETTE_V0: '15 jours',
    DELAI_RECETTE_DEFINITIVE: '30 jours',
    TAUX_PENALITE_JOUR: '1',
    PLAFOND_PENALITES: '10',
    DELAI_GARANTIE_MOIS: '3',
    GTI_BLOQUANTE: '2',
    GTR_BLOQUANTE: '1',
    GTI_SEVERE: '4',
    GTR_SEVERE: '2',
    DELAI_VERSION_MAJEURE_MOIS: '24',
    FORMAT_RESTITUTION: 'CSV/SQL',
    INCOTERM_LIVRAISON: 'DDP',
    DELAI_PREAVIS_RESILIATION: '90',
    ProjectType: 'Licence_OnPrem', // Adjusted to match user's new ISO payload
    hasSensitiveData: 'NON',
    externalHosting: 'NON',
    customDevelopment: 'NON',
  });

  const [uploadedTemplate, setUploadedTemplate] = useState<string | null>(null);

  useEffect(() => {
    const qSections = query(collection(db, 'sections'), orderBy('order'));
    const unsubSections = onSnapshot(qSections, (snap) => setSections(snap.docs.map(d => ({ id: d.id, ...d.data() } as Section))));
    const qArticles = query(collection(db, 'articles'), orderBy('order'));
    const unsubArticles = onSnapshot(qArticles, (snap) => setArticles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Article))));
    
    return () => { unsubSections(); unsubArticles(); };
  }, []);

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
       const reader = new FileReader();
       reader.onload = (event) => {
         setUploadedTemplate(event.target?.result as string);
       };
       reader.readAsDataURL(file);
    }
  };

  // Evaluate conditions
  const evaluateCondition = (article: Article) => {
    if (article.ruleType === 'ALWAYS_INCLUDE' || !article.condition_generation || article.condition_generation === 'TOUJOURS_INCLURE') return true;
    
    // Support parsing strings like "SI [Type_Projet] INCLUDES ('Mise_en_Oeuvre', 'Forfait')"
    const match = article.condition_generation.match(/SI \[([^\]]+)\] (INCLUDES|==) (.*)/i);
    if (!match) return true;

    let field = match[1].trim();
    const operator = match[2].trim().toUpperCase();
    const rawValue = match[3].trim();

    // Map JSON condition fields to the component forms internal states
    let internalFieldMatch = field;
    if (field === 'Type_Projet') internalFieldMatch = 'ProjectType';
    if (field === 'Donnees_Sensibles') internalFieldMatch = 'hasSensitiveData';
    if (field === 'Hebergement') internalFieldMatch = 'externalHosting';

    const actual = (variables as any)[internalFieldMatch];
    if (!actual) return false;

    if (operator === 'INCLUDES') {
      const cleanedValues = rawValue.replace(/['()]/g, '').split(',').map((v: string) => v.trim().toLowerCase());
      return cleanedValues.includes(actual.toString().toLowerCase());
    } else {
      let cleanedValue = rawValue.replace(/['()]/g, '').trim().toLowerCase();
      let actualLower = actual.toString().toLowerCase();
      
      // Strict data transformation for legacy format equivalence
      if (internalFieldMatch === 'hasSensitiveData' && cleanedValue === 'true') cleanedValue = 'oui';
      if (internalFieldMatch === 'externalHosting' && cleanedValue === 'externe_cloud') cleanedValue = 'oui';

      return actualLower === cleanedValue;
    }
  };

  const includedArticles = useMemo(() => {
    return articles.filter(evaluateCondition);
  }, [articles, variables]);

  const requiredVariables = useMemo(() => {
    const vars = new Set<string>();
    
    // The previous articles state contained some predefined static fields but the user
    // wants dynamic extraction.
    includedArticles.forEach(art => {
      // 1. Array extraction from imported DB schema
      if (art.variables_requises && Array.isArray(art.variables_requises)) {
        art.variables_requises.forEach(v => {
          const cleanVar = v.replace(/[{}]/g, '');
          vars.add(cleanVar);
        });
      }
      
      // 2. Fallback text parsing just in case
      const matches = art.content.match(/\{\{([A-Za-z0-9_]+)\}\}/g);
      if (matches) {
        matches.forEach(m => vars.add(m.replace(/[{}]/g, '')));
      }
    });

    // Remove UI questionnaire keys to prevent duplicates in the generated form
    ['ProjectType', 'hasSensitiveData', 'externalHosting', 'customDevelopment'].forEach(k => vars.delete(k));
    
    return Array.from(vars);
  }, [includedArticles]);

  const compileContractText = () => {
    let finalSectionsText = '';
    
    // PSEUDO SECTIONS IN THE PREAMBLE
    finalSectionsText += `--- 0. EN-TÊTE ET SIGNATAIRES ---\n\n`;
    finalSectionsText += `Entre les soussignés :\n[La Banque] d'une part,\nEt ${variables.PRESTATAIRE_NOM || '[Prestataire]'} d'autre part.\n\n`;
    
    finalSectionsText += `--- DÉFINITIONS ---\n\n`;
    finalSectionsText += `Les termes utilisés dans le présent contrat auront la signification suivante :\n(Ex: "Banque" désigne..., "Système" désigne..., etc.)\n\n`;
    
    finalSectionsText += `--- LISTE DES ANNEXES ---\n\n`;
    finalSectionsText += `- Annexe 1 : Spécifications Financières\n- Annexe 2 : Spécifications Techniques\n- Annexe 3 : Plan Qualité Service (SLA)\n\n`;

    // Sort sections explicitly by their order field
    const sortedSections = [...sections].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    let globalArticleCounter = 1;
    
    const structuredData: any[] = [
      {
        title: "0. EN-TÊTE ET SIGNATAIRES",
        articles: [{ title: "", content: `Entre les soussignés :\n[La Banque] d'une part,\nEt ${variables.PRESTATAIRE_NOM || '[Prestataire]'} d'autre part.`}]
      },
      {
        title: "DÉFINITIONS",
        articles: [{ title: "", content: `Les termes utilisés dans le présent contrat auront la signification suivante :\n(Ex: "Banque" désigne..., "Système" désigne..., etc.)`}]
      },
      {
        title: "LISTE DES ANNEXES",
        articles: [{ title: "", content: `- Annexe 1 : Spécifications Financières\n- Annexe 2 : Spécifications Techniques\n- Annexe 3 : Plan Qualité Service (SLA)`}]
      }
    ];

    sortedSections.forEach(section => {
      // Find included articles for this section and sort them
      const sectionArticles = includedArticles
        .filter(a => a.sectionId === section.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
        
      if (sectionArticles.length === 0) return;
      
      finalSectionsText += `\n\n--- ${section.title.toUpperCase()} ---\n\n`;
      const structSection = {
        title: section.title.toUpperCase(),
        articles: [] as any[]
      };

      sectionArticles.forEach(article => {
        let content = article.content;
        
        // Dynamic Variable Replacement in Article Text
        // Quick regex to replace {{VAR_NAME}}
        content = content.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (match, p1) => {
           const val = (variables as any)[p1];
           if (val && val.trim() !== '') return val;
           return `<span style="color:#e74c3c; font-weight:bold">[À COMPLÉTER]</span>`;
        });
        
        // Clean up title: Removes existing "Article 1 - ", "Article 2 :", etc.
        const cleanTitle = article.title.replace(/^Article\s+\d+\s*[-:]?\s*/i, '');
        
        // Renumber dynamically
        const newTitle = `Article ${globalArticleCounter} - ${cleanTitle}`;
        finalSectionsText += `${newTitle}\n${content}\n\n`;
        
        structSection.articles.push({ title: newTitle, content });
        globalArticleCounter++;
      });
      
      structuredData.push(structSection);
    });
    
    return { text: finalSectionsText.trim(), structure: structuredData };
  };

  const compiledResult = useMemo(() => compileContractText(), [includedArticles, variables, sections]);

  const handleExport = () => {
    generateDocx({ ...variables, CONTRAT_BODY: compiledResult.text, STRUCTURE: compiledResult.structure }, uploadedTemplate || undefined);
  };

  return (
    <div className="p-8 h-full overflow-y-auto w-full max-w-7xl mx-auto flex gap-8 bg-bg-main text-text-bright">
      
      {/* Questionnaire Form */}
      <div className="w-1/2 flex flex-col space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-bright">Nouveau Contrat</h1>
          <p className="text-text-dim mt-2">Assistant de génération déterministe.</p>
        </div>

        <div className="bg-bg-card p-6 rounded-xl border border-border-dark shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-text-bright border-b border-border-dark pb-2">1. Qualification du contrat</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">Type de projet</label>
              <select className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright focus:outline-none focus:border-accent" value={variables.ProjectType} onChange={e => setVariables({...variables, ProjectType: e.target.value})}>
                <option value="Licence_OnPrem">Acquisition de Licence (On-Premise)</option>
                <option value="SaaS">Solution SaaS</option>
                <option value="Materiel">Achat Matériel</option>
                <option value="Régie">Prestation en Régie</option>
                <option value="Forfait">Prestation au Forfait</option>
                <option value="Maintenance_TMA">Maintenance & Support (TMA)</option>
                <option value="Mise_en_Oeuvre">Projet d'Intégration / Mise en Œuvre</option>
                <option value="Developpement">Développement Spécifique</option>
                <option value="Migration">Projet de Migration</option>
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">Hébergement Externe ?</label>
                <select className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright focus:outline-none focus:border-accent" value={variables.externalHosting} onChange={e => setVariables({...variables, externalHosting: e.target.value})}>
                  <option value="NON">Non (On-Premise)</option>
                  <option value="OUI">Oui (Cloud/Externe)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">Accès données sensibles ?</label>
                <select className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright focus:outline-none focus:border-accent" value={variables.hasSensitiveData} onChange={e => setVariables({...variables, hasSensitiveData: e.target.value})}>
                  <option value="NON">Non</option>
                  <option value="OUI">Oui (Nécessite ISO 27001 accru)</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">Développement spécifique ?</label>
                <select className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright focus:outline-none focus:border-accent" value={variables.customDevelopment} onChange={e => setVariables({...variables, customDevelopment: e.target.value})}>
                  <option value="NON">Non</option>
                  <option value="OUI">Oui (Cession PI requise)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-bg-card p-6 rounded-xl border border-border-dark shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-text-bright border-b border-border-dark pb-2">2. Paramètres standards</h2>
          <div className="grid grid-cols-2 gap-4">
             {requiredVariables.length > 0 ? (
               requiredVariables.map((v) => (
                 <div key={v} className={v === 'PRESTATAIRE_NOM' ? "col-span-2" : ""}>
                   <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">
                     {v.replace(/_/g, ' ')}
                   </label>
                   <input 
                     type="text" 
                     className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright focus:outline-none focus:border-accent" 
                     value={variables[v] || ''} 
                     onChange={e => setVariables({...variables, [v]: e.target.value})} 
                     placeholder={`Saisir ${v.replace(/_/g, ' ').toLowerCase()}`} 
                   />
                 </div>
               ))
             ) : (
               <div className="col-span-2 text-text-dim text-sm italic">
                  Aucune variable requise pour les clauses sélectionnées.
               </div>
             )}
          </div>
        </div>
        
        <div className="bg-bg-card p-6 rounded-xl border border-border-dark shadow-sm">
          <h2 className="text-lg font-semibold text-text-bright border-b border-border-dark pb-2 mb-4">3. Options d'export</h2>
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">Modèle Word Optionnel (.docx)</label>
            <p className="text-xs text-text-dim mb-3">Uploadez votre modèle de document avec la balise {`{{CONTRAT_BODY}}`}</p>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-border-dark border-dashed rounded-lg cursor-pointer bg-bg-input hover:bg-[#252b36] transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-6 h-6 text-text-dim mb-2" />
                  <p className="text-sm text-text-dim font-semibold">{uploadedTemplate ? "Template chargé" : "Cliquer pour charger un docx"}</p>
                </div>
                <input type="file" className="hidden" accept=".docx" onChange={handleTemplateUpload} />
              </label>
            </div>
          </div>
          
          <button 
            disabled={includedArticles.length === 0}
            onClick={handleExport}
            className="w-full bg-accent hover:opacity-90 disabled:bg-border-dark disabled:text-text-dim text-black font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <Download className="h-5 w-5" />
            Générer le fichier Word
          </button>
        </div>
      </div>

      {/* Validation Checklist / Assembly Preview */}
      <div className="w-1/2 flex flex-col space-y-6">
        <div className="bg-bg-card border border-border-dark rounded-xl shadow-lg overflow-hidden flex flex-col h-full">
          <div className="p-4 bg-bg-sidebar border-b border-border-dark flex justify-between items-center">
            <h3 className="font-semibold text-text-bright flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-accent" />
              Checklist de Conformité
            </h3>
            <span className="text-xs font-bold bg-bg-input border border-border-dark text-text-bright px-2 py-1 rounded-full uppercase tracking-wide">
              {includedArticles.length} Ciblés / {articles.length} Total
            </span>
          </div>
          
          <div className="h-1/3 overflow-y-auto p-4 space-y-4 text-sm text-text-bright border-b border-border-dark">
            {sections.map(section => {
              const secArts = includedArticles.filter(a => a.sectionId === section.id);
              if(secArts.length === 0) return null;
              
              return (
                <div key={section.id} className="mb-4">
                  <h4 className="text-accent font-bold uppercase tracking-wider text-xs mb-2 border-b border-border-dark pb-1">{section.title}</h4>
                  <ul className="space-y-2">
                    {secArts.map(art => (
                      <li key={art.id} className="flex gap-2 items-start bg-bg-input p-2 rounded border border-border-dark">
                        {art.ruleType === 'ALWAYS_INCLUDE' 
                          ? <span className="w-6 h-6 rounded bg-[#238636] border border-[#2ea043] text-white flex items-center justify-center shrink-0 uppercase text-[10px] font-bold" title="Tronc Commun">TC</span>
                          : <span className="w-6 h-6 rounded bg-accent/20 border border-accent/40 text-accent flex items-center justify-center shrink-0 uppercase text-[10px] font-bold" title="Conditionnel">C</span>
                        }
                        <div>
                          <p className="font-medium text-text-bright leading-tight">{art.title}</p>
                          <p className="text-xs text-text-dim truncate mt-0.5">{art.articleCode || 'Sans code'}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            
            {includedArticles.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-text-dim">
                <AlertCircle className="w-12 h-12 mb-3 text-border-dark" />
                <p>Aucun article qualifié.</p>
                <p className="text-xs mt-1 text-center max-w-[200px]">Vérifiez la configuration des règles dans l'administration.</p>
              </div>
            )}
          </div>
          
          {/* Quick preview styled as the specified Mockup */}
          <div className="flex-1 bg-[#FFFFFF] p-8 overflow-y-auto relative text-[#1A1A1A] font-serif shadow-inner min-h-[300px]">
            {includedArticles.length > 0 ? (
              <div className="bg-white h-full text-xs leading-relaxed">
                <div className="text-center mb-6 border-b-2 border-black pb-2">
                  <h2 className="text-[14px] font-bold mb-1 font-sans">CONTRAT CADRE DE PRESTATIONS IT</h2>
                  <p className="text-[10px] text-[#666] font-sans">Modèle Standard - Automatisé</p>
                </div>

                <div className="space-y-4">
                  {compiledResult.structure.map((section, sIdx) => {
                    return (
                      <div key={sIdx}>
                        {section.title && !['0. EN-TÊTE ET SIGNATAIRES', 'DÉFINITIONS', 'LISTE DES ANNEXES'].includes(section.title) && (
                          <h3 className="font-sans font-bold text-[#333] text-[13px] mt-6 border-b border-[#eee] pb-1 uppercase">{section.title}</h3>
                        )}
                        {['0. EN-TÊTE ET SIGNATAIRES', 'DÉFINITIONS', 'LISTE DES ANNEXES'].includes(section.title) && (
                          <h3 className="font-sans font-bold text-[#555] text-[11px] mt-4 mb-1 uppercase">{section.title}</h3>
                        )}

                        {section.articles.map((art: any, i: number) => {
                           return (
                             <p key={i} className="mt-4">
                               {art.title && <strong className="block mb-1">{art.title}</strong>}
                               <span className="whitespace-pre-wrap block" dangerouslySetInnerHTML={{ __html: art.content }}></span>
                             </p>
                           )
                        })}
                      </div>
                    )
                  })}
                </div>

                {/* Simulated ISO Badge at bottom right of the page context */}
                <div className="absolute bottom-5 right-5 font-sans text-[9px] uppercase text-[#999] border border-[#ddd] px-2 py-1">
                  ISO 37001 Certified Flow
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[#999] font-sans text-sm">
                Aperçu du rendu disponible après sélection d'articles.
              </div>
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}
