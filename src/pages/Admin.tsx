import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, orderBy, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Section, Article, RuleType } from '../types';
import { Plus, Edit2, Trash2, Save, X, Layers, FileText } from 'lucide-react';

export default function Admin() {
  const [sections, setSections] = useState<Section[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  
  // Forms State
  const [editingSection, setEditingSection] = useState<Partial<Section> | null>(null);
  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null);
  
  // View mode
  const [activeTab, setActiveTab] = useState<'sections' | 'articles'>('articles');

  useEffect(() => {
    const qSections = query(collection(db, 'sections'), orderBy('order'));
    const unsubSections = onSnapshot(qSections, (snap) => {
      setSections(snap.docs.map(d => ({ id: d.id, ...d.data() } as Section)));
    });

    const qArticles = query(collection(db, 'articles'), orderBy('order'));
    const unsubArticles = onSnapshot(qArticles, (snap) => {
      setArticles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Article)));
    });

    return () => {
      unsubSections();
      unsubArticles();
    };
  }, []);

  const saveSection = async () => {
    if (!editingSection?.title) return;
    try {
      if (editingSection.id) {
        await updateDoc(doc(db, 'sections', editingSection.id), {
          title: editingSection.title,
          order: Number(editingSection.order || 0),
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'sections'), {
          title: editingSection.title,
          order: Number(editingSection.order || 0),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setEditingSection(null);
    } catch (e) {
      console.error(e);
      alert('Erreur: ' + (e as Error).message);
    }
  };

  const deleteSection = async (id: string) => {
    await deleteDoc(doc(db, 'sections', id));
  };

  const saveArticle = async () => {
    if (!editingArticle?.title || !editingArticle?.content) return;
    try {
      const data = {
        title: editingArticle.title,
        content: editingArticle.content,
        ruleType: editingArticle.ruleType || 'ALWAYS_INCLUDE',
        order: Number(editingArticle.order || 0),
        sectionId: editingArticle.sectionId || '',
        articleCode: editingArticle.articleCode || '',
        conditionField: editingArticle.conditionField || '',
        conditionValue: editingArticle.conditionValue || '',
        conditionOperator: editingArticle.conditionOperator || 'EQUALS',
        updatedAt: serverTimestamp()
      };

      if (editingArticle.id) {
        await updateDoc(doc(db, 'articles', editingArticle.id), data);
      } else {
        await addDoc(collection(db, 'articles'), {
          ...data,
          createdAt: serverTimestamp()
        });
      }
      setEditingArticle(null);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteArticle = async (id: string) => {
    await deleteDoc(doc(db, 'articles', id));
  };

  const [isImporting, setIsImporting] = useState(false);

  const processImport = async (isoDataRaw: any) => {
    try {
      // CLEAR EXISTING DATA FIRST
      const existingArticlesSnap = await getDocs(collection(db, 'articles'));
      for (const docSnap of existingArticlesSnap.docs) {
        await deleteDoc(doc(db, 'articles', docSnap.id));
      }
      const existingSectionsSnap = await getDocs(collection(db, 'sections'));
      for (const docSnap of existingSectionsSnap.docs) {
        await deleteDoc(doc(db, 'sections', docSnap.id));
      }

      // Extract array from rawData
      let isoData: any[] = [];
      if (Array.isArray(isoDataRaw)) {
        isoData = isoDataRaw;
      } else if (isoDataRaw && isoDataRaw.catalogue_contrat_it && Array.isArray(isoDataRaw.catalogue_contrat_it.articles)) {
        isoData = isoDataRaw.catalogue_contrat_it.articles;
      } else {
        alert("Format JSON non reconnu. Tableau d'articles ou objet catalogue_contrat_it.articles requis.");
        setIsImporting(false);
        return;
      }

      // Group and create sections mapped from categorie
      const getSectionName = (item: any) => item.categorie || item.section || 'Autre';
      const sectionNames = [...new Set(isoData.map(getSectionName))];
      
      const orderedSectionNames = sectionNames.sort((a, b) => {
        if (a === 'OBLIGATOIRE') return -1;
        if (b === 'OBLIGATOIRE') return 1;
        if (a === 'CONDITIONNEL') return -1;
        if (b === 'CONDITIONNEL') return 1;
        return (a as string).localeCompare(b as string);
      });

      const sectionMap: Record<string, string> = {};
      
      for (let i = 0; i < orderedSectionNames.length; i++) {
        const title = orderedSectionNames[i] as string;
        const secRef = await addDoc(collection(db, 'sections'), {
          title: title,
          order: i + 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        sectionMap[title] = secRef.id;
      }

      // 2. Add articles
      for (let i = 0; i < isoData.length; i++) {
        const item = isoData[i];
        
        let ruleType = 'ALWAYS_INCLUDE';
        let condition_generation = item.condition_generation || 'TOUJOURS_INCLURE';

        if (condition_generation !== 'TOUJOURS_INCLURE') {
          ruleType = 'CONDITIONAL';
        }

        const sectionName = getSectionName(item);
        
        await addDoc(collection(db, 'articles'), {
          title: item.titre || item.title || 'Nouvel Article',
          sectionId: sectionMap[sectionName] || '',
          articleCode: item.id || '',
          content: item.contenu || item.content || '',
          order: i + 1,
          ruleType: ruleType,
          condition_generation: condition_generation,
          variables_requises: item.variables || item.variables_requises || [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      setIsImporting(false);
    } catch(e) {
      console.error(e);
      setIsImporting(false);
    }
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rawData = event.target?.result as string;
        const parsedData = JSON.parse(rawData);
        await processImport(parsedData);
      } catch (err) {
        console.error("Erreur parsing JSON:", err);
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    // Réinitialiser l'input pour pouvoir uploader le même fichier
    e.target.value = '';
  };

  return (
    <div className="p-8 h-full overflow-y-auto w-full max-w-6xl mx-auto bg-bg-main text-text-bright">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-bright">Administration Juridique</h1>
          <p className="text-text-dim mt-2">Gérez les sections, clauses et conditions de la bibliothèque contractuelle.</p>
        </div>
        <label 
          className={`px-4 py-2 flex items-center justify-center gap-2 ${isImporting ? 'bg-bg-input text-text-dim cursor-not-allowed' : 'bg-accent/20 text-accent border-accent/40 hover:bg-accent/30 cursor-pointer'} border rounded-lg shadow-sm text-sm font-semibold transition-colors`}
        >
          {isImporting ? 'Importation...' : 'Importer JSON / ISO'}
          <input 
            type="file" 
            accept=".json" 
            className="hidden" 
            disabled={isImporting} 
            onChange={handleJsonUpload} 
          />
        </label>
      </div>

      <div className="flex space-x-1 bg-bg-sidebar border border-border-dark p-1 rounded-lg mb-8 inline-flex">
        <button 
          className={`px-6 py-2.5 rounded-md font-medium text-sm flex items-center gap-2 transition-all ${activeTab === 'sections' ? 'bg-accent/10 border-l-[3px] border-accent text-text-bright' : 'text-text-dim hover:text-text-bright'}`}
          onClick={() => setActiveTab('sections')}
        >
          <Layers className="h-4 w-4" />
          Sections ({sections.length})
        </button>
        <button 
          className={`px-6 py-2.5 rounded-md font-medium text-sm flex items-center gap-2 transition-all ${activeTab === 'articles' ? 'bg-accent/10 border-l-[3px] border-accent text-text-bright' : 'text-text-dim hover:text-text-bright'}`}
          onClick={() => setActiveTab('articles')}
        >
          <FileText className="h-4 w-4" />
          Articles & Clauses ({articles.length})
        </button>
      </div>

      {activeTab === 'sections' && (
        <div className="space-y-6">
          <div className="bg-bg-card rounded-xl shadow-sm border border-border-dark overflow-hidden">
            <div className="p-4 border-b border-border-dark bg-bg-sidebar flex justify-between items-center">
              <h3 className="font-semibold text-text-bright">Liste des Sections</h3>
              <button 
                onClick={() => setEditingSection({ title: '', order: sections.length + 1 })}
                className="bg-accent hover:opacity-90 text-black px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
               >
                <Plus className="h-4 w-4" /> Nouvelle Section
              </button>
            </div>
            
            {editingSection && (
              <div className="p-4 bg-[#010409] border-b border-border-dark flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">Titre de la section</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright focus:outline-none focus:border-accent"
                    value={editingSection.title || ''} 
                    onChange={e => setEditingSection({...editingSection, title: e.target.value})} 
                  />
                </div>
                <div className="w-24">
                  <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">Ordre</label>
                  <input 
                    type="number" 
                    className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright focus:outline-none focus:border-accent"
                    value={editingSection.order || 0} 
                    onChange={e => setEditingSection({...editingSection, order: Number(e.target.value)})} 
                  />
                </div>
                <div className="flex gap-2 mb-0.5">
                  <button onClick={saveSection} className="bg-accent hover:opacity-90 text-black px-4 py-2 rounded-md font-semibold text-sm flex items-center gap-2"> Enregistrer</button>
                  <button onClick={() => setEditingSection(null)} className="bg-transparent border border-border-dark text-text-dim hover:text-text-bright px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2"> Annuler</button>
                </div>
              </div>
            )}
            
            <div className="divide-y divide-border-dark">
              {sections.length === 0 && <div className="p-8 text-center text-text-dim">Aucune section trouvée.</div>}
              {sections.map(s => (
                <div key={s.id} className="p-4 flex justify-between items-center hover:bg-bg-sidebar transition-colors">
                  <div>
                    <span className="inline-block w-8 text-text-dim font-mono text-sm">{s.order}</span>
                    <span className="font-medium text-text-bright">{s.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingSection(s)} className="p-2 text-text-dim hover:text-accent rounded-md transition-colors"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => deleteSection(s.id)} className="p-2 text-text-dim hover:text-red-400 rounded-md transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'articles' && (
        <div className="space-y-6">
          {!editingArticle ? (
            <div className="bg-bg-card rounded-xl shadow-sm border border-border-dark overflow-hidden">
              <div className="p-4 border-b border-border-dark bg-bg-sidebar flex justify-between items-center">
                <h3 className="font-semibold text-text-bright">Bibliothèque d'articles</h3>
                <button 
                  onClick={() => setEditingArticle({ 
                    title: '', content: '', order: articles.length + 1, ruleType: 'ALWAYS_INCLUDE', sectionId: sections[0]?.id || '' 
                  })}
                  className="bg-accent hover:opacity-90 text-black px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
                 >
                  <Plus className="h-4 w-4" /> Nouvel Article
                </button>
              </div>

              <div className="divide-y divide-border-dark">
                {articles.length === 0 && <div className="p-8 text-center text-text-dim">Aucun article trouvé.</div>}
                
                {sections.map(section => {
                   const sectionArticles = articles.filter(a => a.sectionId === section.id);
                   if (sectionArticles.length === 0) return null;
                   
                   return (
                     <div key={section.id} className="mb-4">
                       <div className="bg-bg-sidebar/80 px-4 py-2 font-medium text-sm text-text-dim border-y border-border-dark">
                         {section.title}
                       </div>
                       {sectionArticles.map(a => (
                         <div key={a.id} className="p-4 flex gap-4 items-start hover:bg-bg-sidebar transition-colors border-b border-border-dark last:border-b-0">
                           <div className="w-8 text-text-dim font-mono text-sm shrink-0 pt-0.5">{a.order}</div>
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-3 mb-1">
                               <h4 className="font-semibold text-text-bright truncate">{a.title}</h4>
                               {a.ruleType === 'ALWAYS_INCLUDE' 
                                 ? <span className="text-[10px] bg-[#238636] text-white px-2 py-0.5 border border-[#2ea043] rounded-full font-bold uppercase tracking-wide">Tronc Commun</span>
                                 : <span className="text-[10px] bg-accent/20 text-accent border border-accent/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Conditionnel</span>
                               }
                             </div>
                             
                             <p className="text-xs text-text-dim mb-2 truncate">ID: {a.articleCode || 'N/A'}</p>
                             
                             {a.ruleType === 'CONDITIONAL' && (
                               <div className="text-xs text-text-dim bg-bg-card border border-border-dark inline-block px-2 py-1 rounded shadow-sm">
                                 <span className="font-mono text-accent">{a.conditionField}</span> == <span className="font-mono text-text-bright">'{a.conditionValue}'</span>
                               </div>
                             )}
                           </div>
                           
                           <div className="flex items-center gap-1 shrink-0">
                             <button onClick={() => setEditingArticle(a)} className="p-2 text-text-dim hover:text-accent rounded-md transition-colors"><Edit2 className="h-4 w-4" /></button>
                             <button onClick={() => deleteArticle(a.id)} className="p-2 text-text-dim hover:text-red-400 rounded-md transition-colors"><Trash2 className="h-4 w-4" /></button>
                           </div>
                         </div>
                       ))}
                     </div>
                   )
                })}
                {/* Articles without a valid section */}
                {articles.filter(a => !sections.find(s => s.id === a.sectionId)).map(a => (
                   <div key={a.id} className="p-4 flex gap-4 items-start hover:bg-bg-sidebar transition-colors border-b border-border-dark">
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-500">[{a.title}] (Section orpheline)</h4>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditingArticle(a)} className="p-2 text-text-dim hover:text-accent rounded-md transition-colors"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => deleteArticle(a.id)} className="p-2 text-text-dim hover:text-red-400 rounded-md transition-colors"><Trash2 className="h-4 w-4" /></button>
                    </div>
                   </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-bg-card rounded-xl shadow-lg border border-border-dark overflow-hidden">
              <div className="p-4 border-b border-border-dark bg-bg-sidebar flex justify-between items-center">
                <h3 className="font-semibold text-text-bright">{editingArticle.id ? 'Modifier l\'article' : 'Nouvel Article'}</h3>
                <div className="flex gap-2">
                  <button onClick={() => setEditingArticle(null)} className="px-4 py-2 border border-border-dark bg-transparent text-text-dim hover:text-text-bright rounded-md text-sm font-medium transition-colors">Annuler</button>
                  <button onClick={saveArticle} className="px-4 py-2 bg-accent text-black rounded-md hover:opacity-90 font-semibold text-sm flex items-center gap-2 transition-colors"><Save className="h-4 w-4" /> Enregistrer</button>
                </div>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-bg-main border-x border-b border-border-dark rounded-b-xl">
                 <div className="space-y-4">
                   <div>
                     <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">Libellé de l'Article</label>
                     <input type="text" className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright focus:outline-none focus:border-accent" value={editingArticle.title || ''} onChange={e => setEditingArticle({...editingArticle, title: e.target.value})} placeholder="Ex: Cession des droits" />
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">ID Unique (Code)</label>
                       <input type="text" className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright focus:outline-none focus:border-accent font-mono text-sm" value={editingArticle.articleCode || ''} onChange={e => setEditingArticle({...editingArticle, articleCode: e.target.value.toUpperCase()})} placeholder="ART_CESSION" />
                     </div>
                     <div>
                       <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">Ordre (Section)</label>
                       <input type="number" className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright focus:outline-none focus:border-accent" value={editingArticle.order || 0} onChange={e => setEditingArticle({...editingArticle, order: Number(e.target.value)})} />
                     </div>
                   </div>

                   <div>
                     <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">Section</label>
                     <select className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright focus:outline-none focus:border-accent" value={editingArticle.sectionId || ''} onChange={e => setEditingArticle({...editingArticle, sectionId: e.target.value})}>
                        <option value="" disabled>-- Sélectionner une section --</option>
                        {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                     </select>
                   </div>
                 </div>

                 <div className="space-y-4 bg-bg-card p-4 rounded-xl border border-border-dark">
                   <h4 className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">Condition de Génération</h4>
                   
                   <div>
                     <label className="block text-sm font-medium text-text-dim mb-3">Type de Règle</label>
                     <div className="flex gap-4">
                       <label className="flex items-center gap-2 cursor-pointer text-text-bright">
                         <input type="radio" name="ruleType" className="accent-accent" checked={editingArticle.ruleType === 'ALWAYS_INCLUDE'} onChange={() => setEditingArticle({...editingArticle, ruleType: 'ALWAYS_INCLUDE'})} />
                         <span className="text-sm">Toujours Inclure</span>
                       </label>
                       <label className="flex items-center gap-2 cursor-pointer text-text-bright">
                         <input type="radio" name="ruleType" className="accent-accent" checked={editingArticle.ruleType === 'CONDITIONAL'} onChange={() => setEditingArticle({...editingArticle, ruleType: 'CONDITIONAL'})} />
                         <span className="text-sm">Déterministe (SI...)</span>
                       </label>
                     </div>
                   </div>

                   {editingArticle.ruleType === 'CONDITIONAL' && (
                     <div className="bg-[#010409] p-4 rounded-md border border-dashed border-border-dark mt-4 items-center">
                        <span className="text-accent font-bold text-sm mr-3">SI</span>
                        <div className="inline-flex gap-2 items-center bg-bg-card border border-border-dark rounded px-2 py-1">
                          <input type="text" className="bg-transparent border-none text-text-bright w-24 focus:outline-none font-mono text-xs" value={editingArticle.conditionField || ''} onChange={e => setEditingArticle({...editingArticle, conditionField: e.target.value})} placeholder="Type" />
                          <span className="text-accent text-xs">==</span>
                          <input type="text" className="bg-transparent border-none text-text-bright w-20 focus:outline-none font-mono text-xs" value={editingArticle.conditionValue || ''} onChange={e => setEditingArticle({...editingArticle, conditionValue: e.target.value})} placeholder="'SaaS'" />
                        </div>
                     </div>
                   )}
                 </div>

                 <div className="col-span-1 md:col-span-2 mt-4">
                   <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">Corps de l'Article (Variables Dynamiques)</label>
                   <p className="text-xs text-text-dim mb-3">Utilisez les balises {'{{"{"}}VARIABLE{{"}"}}'} pour l'injection dynamique.</p>
                   <textarea 
                     className="w-full px-3 py-3 border border-border-dark rounded-md bg-bg-input text-text-bright font-mono text-sm focus:outline-none focus:border-accent min-h-[300px] resize-none"
                     value={editingArticle.content || ''}
                     onChange={e => setEditingArticle({...editingArticle, content: e.target.value})}
                     placeholder="Les parties conviennent que le prix total est fixé à {{MONTANT_GLOBAL}} MAD HT..."
                   />
                 </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
