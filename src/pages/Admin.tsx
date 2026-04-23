import React, { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc,
  query, orderBy, serverTimestamp, getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Section, Article, RuleType } from '../types';
import { Plus, Edit2, Trash2, Save, X, Layers, FileText, ChevronRight, ChevronDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripNumber(text: string): string {
  return text
    .replace(/^ARTICLE\s+\d+(\.\d+)*\s*[-:–—]?\s*:?\s*/i, '')
    .replace(/^\d+[\.\-]\d+(\.\d+)*\s*[-:–—]\s*/i, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Admin() {
  const [sections, setSections] = useState<Section[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);

  const [editingSection, setEditingSection] = useState<Partial<Section> | null>(null);
  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null);

  const [activeTab, setActiveTab] = useState<'sections' | 'articles'>('articles');

  // Which root articles are expanded to show sub-articles
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(new Set());

  useEffect(() => {
    const qSections = query(collection(db, 'sections'), orderBy('order'));
    const unsubSections = onSnapshot(qSections, (snap) => {
      setSections(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Section)));
    });

    const qArticles = query(collection(db, 'articles'), orderBy('order'));
    const unsubArticles = onSnapshot(qArticles, (snap) => {
      setArticles(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Article)));
    });

    return () => {
      unsubSections();
      unsubArticles();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Section CRUD
  // ---------------------------------------------------------------------------

  const saveSection = async () => {
    if (!editingSection?.title) return;
    try {
      if (editingSection.id) {
        await updateDoc(doc(db, 'sections', editingSection.id), {
          title: editingSection.title,
          order: Number(editingSection.order || 0),
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'sections'), {
          title: editingSection.title,
          order: Number(editingSection.order || 0),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setEditingSection(null);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteSection = async (id: string) => {
    if (!window.confirm('Supprimer cette section et tous ses articles ?')) return;
    await deleteDoc(doc(db, 'sections', id));
  };

  // ---------------------------------------------------------------------------
  // Article CRUD
  // ---------------------------------------------------------------------------

  const saveArticle = async () => {
    if (!editingArticle?.title || !editingArticle?.content) return;
    try {
      const parentId = editingArticle.parentId ?? null;
      const depth = parentId
        ? (articles.find((a) => a.id === parentId)?.depth ?? 0) + 1
        : 0;

      const data: Record<string, any> = {
        title: editingArticle.title,
        content: editingArticle.content,
        ruleType: editingArticle.ruleType || 'ALWAYS_INCLUDE',
        order: Number(editingArticle.order || 0),
        sectionId: editingArticle.sectionId || '',
        articleCode: editingArticle.articleCode || '',
        conditionField: editingArticle.conditionField || '',
        conditionValue: editingArticle.conditionValue || '',
        conditionOperator: editingArticle.conditionOperator || 'EQUALS',
        condition_generation: editingArticle.condition_generation || 'TOUJOURS_INCLURE',
        variables_requises: editingArticle.variables_requises || [],
        parentId,
        depth,
        updatedAt: serverTimestamp(),
      };

      if (editingArticle.id) {
        await updateDoc(doc(db, 'articles', editingArticle.id), data);
      } else {
        await addDoc(collection(db, 'articles'), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }
      setEditingArticle(null);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteArticle = async (id: string) => {
    // Also delete children
    const children = articles.filter((a) => a.parentId === id);
    const batch = writeBatch(db);
    children.forEach((c) => batch.delete(doc(db, 'articles', c.id)));
    batch.delete(doc(db, 'articles', id));
    await batch.commit();
  };

  const openNewSubArticle = (parent: Article) => {
    setEditingArticle({
      title: '',
      content: '',
      order: articles.filter((a) => a.parentId === parent.id).length + 1,
      ruleType: 'ALWAYS_INCLUDE',
      sectionId: parent.sectionId,
      parentId: parent.id,
      depth: (parent.depth ?? 0) + 1,
      condition_generation: 'TOUJOURS_INCLURE',
    });
    setActiveTab('articles');
  };

  const toggleExpand = (id: string) => {
    setExpandedRoots((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // JSON Import (supports sous_articles[])
  // ---------------------------------------------------------------------------

  const [isImporting, setIsImporting] = useState(false);

  const processImport = async (isoDataRaw: any) => {
    try {
      let isoData: any[] = [];
      if (Array.isArray(isoDataRaw)) {
        isoData = isoDataRaw;
      } else if (
        isoDataRaw?.catalogue_contrat_it &&
        Array.isArray(isoDataRaw.catalogue_contrat_it.articles)
      ) {
        isoData = isoDataRaw.catalogue_contrat_it.articles;
      } else {
        alert("Format JSON non reconnu. Attendu: tableau ou { catalogue_contrat_it: { articles: [] } }");
        setIsImporting(false);
        return;
      }

      // Clear existing data
      const existingArticles = await getDocs(collection(db, 'articles'));
      const existingSections = await getDocs(collection(db, 'sections'));

      let batch = writeBatch(db);
      let opCount = 0;

      const flush = async () => {
        if (opCount > 0) { await batch.commit(); batch = writeBatch(db); opCount = 0; }
      };

      for (const d of existingArticles.docs) {
        batch.delete(doc(db, 'articles', d.id)); opCount++;
        if (opCount >= 400) await flush();
      }
      for (const d of existingSections.docs) {
        batch.delete(doc(db, 'sections', d.id)); opCount++;
        if (opCount >= 400) await flush();
      }
      await flush();

      // Create sections from unique categories
      const getSectionName = (item: any) => item.categorie || item.section || 'Autre';
      const sectionNames = [...new Set(isoData.map(getSectionName))] as string[];

      const sectionMap: Record<string, string> = {};
      for (let i = 0; i < sectionNames.length; i++) {
        const title = sectionNames[i];
        const ref = doc(collection(db, 'sections'));
        batch.set(ref, {
          title,
          order: i + 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        sectionMap[title] = ref.id;
        opCount++;
        if (opCount >= 400) await flush();
      }

      // Create articles (root + sub-articles from sous_articles[])
      for (let i = 0; i < isoData.length; i++) {
        const item = isoData[i];
        const sectionName = getSectionName(item);
        const cond = item.condition_generation || 'TOUJOURS_INCLURE';

        const rootRef = doc(collection(db, 'articles'));
        batch.set(rootRef, {
          title: item.titre || item.title || 'Nouvel Article',
          sectionId: sectionMap[sectionName] || '',
          articleCode: item.id || '',
          content: item.contenu || item.content || '',
          order: i + 1,
          ruleType: cond === 'TOUJOURS_INCLURE' ? 'ALWAYS_INCLUDE' : 'CONDITIONAL',
          condition_generation: cond,
          variables_requises: item.variables || item.variables_requises || [],
          parentId: null,
          depth: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        opCount++;
        if (opCount >= 400) await flush();

        // Sub-articles (sous_articles[])
        if (Array.isArray(item.sous_articles)) {
          for (let j = 0; j < item.sous_articles.length; j++) {
            const sa = item.sous_articles[j];
            const saCond = sa.condition_generation || 'TOUJOURS_INCLURE';
            const saRef = doc(collection(db, 'articles'));
            batch.set(saRef, {
              title: sa.titre || sa.title || `Sous-article ${j + 1}`,
              sectionId: sectionMap[sectionName] || '',
              articleCode: sa.id || `${item.id}_${j + 1}`,
              content: sa.contenu || sa.content || '',
              order: j + 1,
              ruleType: saCond === 'TOUJOURS_INCLURE' ? 'ALWAYS_INCLUDE' : 'CONDITIONAL',
              condition_generation: saCond,
              variables_requises: sa.variables || sa.variables_requises || [],
              parentId: rootRef.id,
              depth: 1,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            opCount++;
            if (opCount >= 400) await flush();
          }
        }
      }

      await flush();
      setIsImporting(false);
      alert(`Importation réussie — ${isoData.length} articles racines traités.`);
    } catch (e: any) {
      console.error(e);
      alert('Erreur importation: ' + (e.message || e));
      setIsImporting(false);
    }
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await processImport(JSON.parse(ev.target?.result as string));
      } catch {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ---------------------------------------------------------------------------
  // Derived state helpers
  // ---------------------------------------------------------------------------

  const rootArticlesOf = (sectionId: string) =>
    articles
      .filter((a) => a.sectionId === sectionId && !a.parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const childrenOf = (parentId: string) =>
    articles
      .filter((a) => a.parentId === parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Parent article options for the form selector (only depth-0 in same section)
  const parentOptions = articles.filter(
    (a) =>
      !a.parentId &&
      a.sectionId === editingArticle?.sectionId &&
      a.id !== editingArticle?.id
  );

  // When condition_generation changes, keep ruleType in sync
  const handleConditionChange = (val: string) => {
    setEditingArticle((prev) => ({
      ...prev!,
      condition_generation: val,
      ruleType: val === 'TOUJOURS_INCLURE' ? 'ALWAYS_INCLUDE' : 'CONDITIONAL',
    }));
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-8 h-full overflow-y-auto w-full max-w-6xl mx-auto bg-bg-main text-text-bright">

      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-bright">Administration Juridique</h1>
          <p className="text-text-dim mt-2">
            Gérez les sections, articles et sous-articles de la bibliothèque contractuelle.
          </p>
        </div>
        <label
          className={`px-4 py-2 flex items-center justify-center gap-2 border rounded-lg shadow-sm text-sm font-semibold transition-colors ${
            isImporting
              ? 'bg-bg-input text-text-dim cursor-not-allowed border-border-dark'
              : 'bg-accent/20 text-accent border-accent/40 hover:bg-accent/30 cursor-pointer'
          }`}
        >
          {isImporting ? 'Importation…' : 'Importer JSON'}
          <input
            type="file"
            accept=".json"
            className="hidden"
            disabled={isImporting}
            onChange={handleJsonUpload}
          />
        </label>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-bg-sidebar border border-border-dark p-1 rounded-lg mb-8 inline-flex">
        {(['sections', 'articles'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2.5 rounded-md font-medium text-sm flex items-center gap-2 transition-all ${
              activeTab === tab
                ? 'bg-accent/10 border-l-[3px] border-accent text-text-bright'
                : 'text-text-dim hover:text-text-bright'
            }`}
          >
            {tab === 'sections' ? <Layers className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            {tab === 'sections' ? `Sections (${sections.length})` : `Articles (${articles.filter(a => !a.parentId).length} + ${articles.filter(a => !!a.parentId).length} sous-articles)`}
          </button>
        ))}
      </div>

      {/* ── SECTIONS TAB ── */}
      {activeTab === 'sections' && (
        <div className="bg-bg-card rounded-xl shadow-sm border border-border-dark overflow-hidden">
          <div className="p-4 border-b border-border-dark bg-bg-sidebar flex justify-between items-center">
            <h3 className="font-semibold text-text-bright">Liste des Sections</h3>
            <button
              onClick={() => setEditingSection({ title: '', order: sections.length + 1 })}
              className="bg-accent hover:opacity-90 text-black px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Nouvelle Section
            </button>
          </div>

          {editingSection && (
            <div className="p-4 bg-[#010409] border-b border-border-dark flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">
                  Titre
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright focus:outline-none focus:border-accent"
                  value={editingSection.title || ''}
                  onChange={(e) => setEditingSection({ ...editingSection, title: e.target.value })}
                />
              </div>
              <div className="w-24">
                <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">
                  Ordre
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright focus:outline-none focus:border-accent"
                  value={editingSection.order || 0}
                  onChange={(e) =>
                    setEditingSection({ ...editingSection, order: Number(e.target.value) })
                  }
                />
              </div>
              <div className="flex gap-2 mb-0.5">
                <button
                  onClick={saveSection}
                  className="bg-accent hover:opacity-90 text-black px-4 py-2 rounded-md font-semibold text-sm flex items-center gap-2"
                >
                  <Save className="h-4 w-4" /> Enregistrer
                </button>
                <button
                  onClick={() => setEditingSection(null)}
                  className="bg-transparent border border-border-dark text-text-dim hover:text-text-bright px-4 py-2 rounded-md font-medium text-sm"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-border-dark">
            {sections.length === 0 && (
              <div className="p-8 text-center text-text-dim">Aucune section trouvée.</div>
            )}
            {sections.map((s) => (
              <div
                key={s.id}
                className="p-4 flex justify-between items-center hover:bg-bg-sidebar transition-colors"
              >
                <div>
                  <span className="inline-block w-8 text-text-dim font-mono text-sm">{s.order}</span>
                  <span className="font-medium text-text-bright">{s.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingSection(s)}
                    className="p-2 text-text-dim hover:text-accent rounded-md transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteSection(s.id)}
                    className="p-2 text-text-dim hover:text-red-400 rounded-md transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ARTICLES TAB ── */}
      {activeTab === 'articles' && (
        <div className="space-y-6">

          {/* ── Article Form ── */}
          {editingArticle ? (
            <div className="bg-bg-card rounded-xl shadow-lg border border-border-dark overflow-hidden">
              <div className="p-4 border-b border-border-dark bg-bg-sidebar flex justify-between items-center">
                <h3 className="font-semibold text-text-bright">
                  {editingArticle.id
                    ? 'Modifier l\'article'
                    : editingArticle.parentId
                    ? 'Nouveau Sous-article'
                    : 'Nouvel Article'}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingArticle(null)}
                    className="px-4 py-2 border border-border-dark bg-transparent text-text-dim hover:text-text-bright rounded-md text-sm font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={saveArticle}
                    className="px-4 py-2 bg-accent text-black rounded-md hover:opacity-90 font-semibold text-sm flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" /> Enregistrer
                  </button>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-bg-main">

                {/* Left column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">
                      Libellé
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright focus:outline-none focus:border-accent"
                      value={editingArticle.title || ''}
                      onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                      placeholder="Titre de l'article (sans numéro)"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">
                        Code Unique
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright font-mono text-sm focus:outline-none focus:border-accent"
                        value={editingArticle.articleCode || ''}
                        onChange={(e) =>
                          setEditingArticle({
                            ...editingArticle,
                            articleCode: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="ART_001"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">
                        Ordre
                      </label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright focus:outline-none focus:border-accent"
                        value={editingArticle.order || 0}
                        onChange={(e) =>
                          setEditingArticle({ ...editingArticle, order: Number(e.target.value) })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">
                      Section
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright focus:outline-none focus:border-accent"
                      value={editingArticle.sectionId || ''}
                      onChange={(e) =>
                        setEditingArticle({
                          ...editingArticle,
                          sectionId: e.target.value,
                          parentId: null,
                        })
                      }
                    >
                      <option value="" disabled>-- Sélectionner une section --</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Parent article selector */}
                  <div>
                    <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">
                      Article Parent{' '}
                      <span className="text-text-dim font-normal normal-case">(optionnel — laissez vide pour un article racine)</span>
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright focus:outline-none focus:border-accent"
                      value={editingArticle.parentId ?? ''}
                      onChange={(e) =>
                        setEditingArticle({
                          ...editingArticle,
                          parentId: e.target.value || null,
                        })
                      }
                      disabled={!editingArticle.sectionId}
                    >
                      <option value="">— Aucun (article racine) —</option>
                      {parentOptions.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.articleCode ? `[${a.articleCode}] ` : ''}{stripNumber(a.title)}
                        </option>
                      ))}
                    </select>
                    {editingArticle.parentId && (
                      <p className="text-[10px] text-accent mt-1">
                        Niveau : Sous-article (depth {(articles.find(a => a.id === editingArticle.parentId)?.depth ?? 0) + 1})
                      </p>
                    )}
                  </div>
                </div>

                {/* Right column: condition */}
                <div className="space-y-4 bg-bg-card p-4 rounded-xl border border-border-dark">
                  <h4 className="block text-[11px] font-semibold text-accent uppercase tracking-wide">
                    Condition de Génération
                  </h4>

                  <div>
                    <label className="block text-sm font-medium text-text-dim mb-3">Type de Règle</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-text-bright">
                        <input
                          type="radio"
                          name="ruleType"
                          className="accent-accent"
                          checked={editingArticle.ruleType === 'ALWAYS_INCLUDE'}
                          onChange={() =>
                            setEditingArticle({
                              ...editingArticle,
                              ruleType: 'ALWAYS_INCLUDE',
                              condition_generation: 'TOUJOURS_INCLURE',
                            })
                          }
                        />
                        <span className="text-sm">Toujours Inclure</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-text-bright">
                        <input
                          type="radio"
                          name="ruleType"
                          className="accent-accent"
                          checked={editingArticle.ruleType === 'CONDITIONAL'}
                          onChange={() =>
                            setEditingArticle({
                              ...editingArticle,
                              ruleType: 'CONDITIONAL',
                              condition_generation: "TYPES_PROJET_INCLUDES('Logiciel')",
                            })
                          }
                        />
                        <span className="text-sm">Déterministe (SI…)</span>
                      </label>
                    </div>
                  </div>

                  {editingArticle.ruleType === 'CONDITIONAL' && (
                    <div className="bg-[#010409] p-4 rounded-md border border-dashed border-border-dark space-y-3">
                      <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide">
                        Expression de condition
                      </label>
                      <textarea
                        rows={3}
                        className="w-full px-3 py-2 border border-border-dark rounded-md bg-bg-input text-text-bright font-mono text-xs focus:outline-none focus:border-accent resize-none"
                        value={editingArticle.condition_generation || ''}
                        onChange={(e) => handleConditionChange(e.target.value)}
                        placeholder={"TYPES_PROJET_INCLUDES('Logiciel')\nSI [Hebergement] == 'OUI'"}
                      />
                      <p className="text-[10px] text-text-dim">
                        Exemples : <code className="text-accent">TYPES_PROJET_INCLUDES('SaaS')</code> ·{' '}
                        <code className="text-accent">SI [Donnees_Sensibles] == 'OUI'</code>
                      </p>
                    </div>
                  )}
                </div>

                {/* Content textarea — full width */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">
                    Corps de l'Article
                  </label>
                  <p className="text-xs text-text-dim mb-3">
                    Utilisez <code className="text-accent">{'{{VARIABLE}}'}</code> pour les champs dynamiques.
                    Ne pas inclure le numéro d'article — il sera ajouté automatiquement.
                  </p>
                  <textarea
                    className="w-full px-3 py-3 border border-border-dark rounded-md bg-bg-input text-text-bright font-mono text-sm focus:outline-none focus:border-accent min-h-[300px] resize-y"
                    value={editingArticle.content || ''}
                    onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                    placeholder="Le texte contractuel de l'article... (sans numérotation)"
                  />
                </div>
              </div>
            </div>

          ) : (
            /* ── Article List (tree view) ── */
            <div className="bg-bg-card rounded-xl shadow-sm border border-border-dark overflow-hidden">
              <div className="p-4 border-b border-border-dark bg-bg-sidebar flex justify-between items-center">
                <h3 className="font-semibold text-text-bright">Bibliothèque d'articles</h3>
                <button
                  onClick={() =>
                    setEditingArticle({
                      title: '',
                      content: '',
                      order: articles.filter((a) => !a.parentId).length + 1,
                      ruleType: 'ALWAYS_INCLUDE',
                      sectionId: sections[0]?.id || '',
                      parentId: null,
                      depth: 0,
                      condition_generation: 'TOUJOURS_INCLURE',
                    })
                  }
                  className="bg-accent hover:opacity-90 text-black px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Nouvel Article
                </button>
              </div>

              <div className="divide-y divide-border-dark">
                {sections.length === 0 && (
                  <div className="p-8 text-center text-text-dim">Aucun article trouvé.</div>
                )}

                {sections.map((section) => {
                  const roots = rootArticlesOf(section.id);
                  if (roots.length === 0) return null;

                  return (
                    <div key={section.id}>
                      {/* Section header */}
                      <div className="bg-bg-sidebar/80 px-4 py-2 font-medium text-sm text-text-dim border-y border-border-dark">
                        {section.title}
                      </div>

                      {roots.map((art) => {
                        const children = childrenOf(art.id);
                        const isExpanded = expandedRoots.has(art.id);

                        return (
                          <div key={art.id}>
                            {/* Root article row */}
                            <div className="p-4 flex gap-3 items-start hover:bg-bg-sidebar transition-colors border-b border-border-dark last:border-b-0">

                              {/* Expand toggle */}
                              <button
                                onClick={() => children.length > 0 && toggleExpand(art.id)}
                                className={`mt-0.5 shrink-0 text-text-dim transition-colors ${
                                  children.length > 0 ? 'hover:text-accent' : 'opacity-30 cursor-default'
                                }`}
                              >
                                {isExpanded
                                  ? <ChevronDown className="h-4 w-4" />
                                  : <ChevronRight className="h-4 w-4" />}
                              </button>

                              <div className="w-8 text-text-dim font-mono text-sm shrink-0 pt-0.5">
                                {art.order}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1 flex-wrap">
                                  <h4 className="font-semibold text-text-bright truncate">
                                    {stripNumber(art.title)}
                                  </h4>
                                  {art.ruleType === 'ALWAYS_INCLUDE' ? (
                                    <span className="text-[10px] bg-[#238636] text-white px-2 py-0.5 border border-[#2ea043] rounded-full font-bold uppercase tracking-wide">
                                      Tronc Commun
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-accent/20 text-accent border border-accent/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                      Conditionnel
                                    </span>
                                  )}
                                  {children.length > 0 && (
                                    <span className="text-[10px] text-text-dim border border-border-dark px-2 py-0.5 rounded-full">
                                      {children.length} sous-article{children.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-text-dim font-mono">
                                  {art.articleCode || art.id}
                                </p>
                                {art.ruleType === 'CONDITIONAL' && art.condition_generation && (
                                  <code className="text-xs text-accent/80 mt-1 block">
                                    {art.condition_generation}
                                  </code>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => openNewSubArticle(art)}
                                  title="Ajouter un sous-article"
                                  className="p-2 text-text-dim hover:text-accent rounded-md transition-colors"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setEditingArticle(art)}
                                  className="p-2 text-text-dim hover:text-accent rounded-md transition-colors"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => deleteArticle(art.id)}
                                  className="p-2 text-text-dim hover:text-red-400 rounded-md transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            {/* Sub-articles (collapsible) */}
                            {isExpanded && children.map((child) => (
                              <div
                                key={child.id}
                                className="pl-12 pr-4 py-3 flex gap-3 items-start bg-[#0d1117] border-b border-border-dark/50 hover:bg-bg-sidebar transition-colors"
                              >
                                <div className="w-2 border-l-2 border-border-dark self-stretch shrink-0" />
                                <div className="w-8 text-text-dim font-mono text-xs shrink-0 pt-0.5">
                                  {child.order}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h5 className="font-medium text-text-bright text-sm truncate">
                                      {stripNumber(child.title)}
                                    </h5>
                                    {child.ruleType === 'ALWAYS_INCLUDE' ? (
                                      <span className="text-[9px] bg-[#238636]/60 text-white px-1.5 py-0.5 border border-[#2ea043]/50 rounded-full font-bold uppercase">
                                        TC
                                      </span>
                                    ) : (
                                      <span className="text-[9px] bg-accent/10 text-accent border border-accent/20 px-1.5 py-0.5 rounded-full font-bold uppercase">
                                        C
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-text-dim font-mono">
                                    {child.articleCode || child.id}
                                  </p>
                                  {child.ruleType === 'CONDITIONAL' && child.condition_generation && (
                                    <code className="text-[10px] text-accent/70 mt-0.5 block">
                                      {child.condition_generation}
                                    </code>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => setEditingArticle(child)}
                                    className="p-1.5 text-text-dim hover:text-accent rounded-md transition-colors"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteArticle(child.id)}
                                    className="p-1.5 text-text-dim hover:text-red-400 rounded-md transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}

                      {/* Orphan articles in this section (have a parentId that no longer exists) */}
                      {articles
                        .filter(
                          (a) =>
                            a.sectionId === section.id &&
                            a.parentId &&
                            !articles.find((p) => p.id === a.parentId)
                        )
                        .map((a) => (
                          <div
                            key={a.id}
                            className="p-4 flex gap-4 items-start bg-red-900/10 border-b border-red-800/30"
                          >
                            <div className="flex-1">
                              <h4 className="font-semibold text-red-400 text-sm">
                                [Orphelin] {a.title}
                              </h4>
                              <p className="text-xs text-text-dim">parentId manquant : {a.parentId}</p>
                            </div>
                            <button
                              onClick={() => deleteArticle(a.id)}
                              className="p-2 text-text-dim hover:text-red-400 rounded-md transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
