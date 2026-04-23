import React, { useState, useEffect, useMemo, useRef } from 'react';
import defaultCatalog from '../../contrat-global-complet.json';
import defDictionary from '../../definitions-dictionary.json';
import { Article, Section } from '../types';
import { generateDocx } from '../utils/exportWord';
import {
  Download, Upload, CheckCircle2, AlertCircle, ChevronRight,
  ChevronDown, ChevronLeft, FileText, LayoutList, Lock, Unlock,
  Plus, Trash2, Pencil, Eye, RotateCcw, X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function stripNumber(text: string): string {
  return text
    .replace(/^ARTICLE\s+\d+(\.\d+)*\s*[-:–—]?\s*:?\s*/i, '')
    .replace(/^\d+[\.\-]\d+(\.\d+)*\s*[-:–—]\s*/i, '')
    .replace(/^-+[IVXivx]+[-\s]*[A-ZÀÂÉÈÊË\s]*[-\s]*/i, '')
    .trim();
}

function stripContentLeadingNumber(content: string): string {
  return content
    .replace(/^\d+[\.\-]\d+(\.\d+)*\s*[-:–—]\s*[^\n]*\n*/i, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Variable metadata
// ---------------------------------------------------------------------------

type VarGroup = 'parties' | 'financier' | 'delais' | 'general';

const VAR_LABELS: Record<string, string> = {
  NOM_CLIENT: 'Nom du CLIENT (Banque)',
  QUALITE_CLIENT: 'Qualité / Désignation contractuelle du Client',
  NOM_PRESTATAIRE: 'Dénomination sociale du Prestataire',
  PRESTATAIRE_NOM: 'Dénomination sociale du Prestataire',
  ADRESSE_CLIENT: 'Adresse Siège Social CLIENT',
  ADRESSE_PRESTATAIRE: 'Adresse Siège Social Prestataire',
  RC_CLIENT: 'N° RC du CLIENT',
  RC_PRESTATAIRE: 'N° RC du Prestataire',
  CAPITAL_CLIENT: 'Capital Social CLIENT (MAD)',
  CAPITAL_PRESTATAIRE: 'Capital Social Prestataire (MAD)',
  REPRESENTANT_CLIENT_1: 'Représentant CLIENT n°1',
  QUALITE_REPRESENTANT_CLIENT_1: 'Fonction / Qualité Représentant CLIENT n°1',
  REPRESENTANT_CLIENT_2: 'Représentant CLIENT n°2',
  QUALITE_REPRESENTANT_CLIENT_2: 'Fonction / Qualité Représentant CLIENT n°2',
  REPRESENTANT_PRESTATAIRE: 'Représentant habilité Prestataire',
  QUALITE_REPRESENTANT_PRESTATAIRE: 'Fonction / Qualité Prestataire',
  VILLE_RC_PRESTATAIRE: "Ville d'immatriculation RC (Prestataire)",
  ROLE_PRESTATAIRE: 'Désignation contractuelle Prestataire',
  NOM_LOGICIEL: 'Nom du Logiciel / Solution IT',
  NOM_OBJET_CONTRAT: 'Objet du Contrat (libellé court)',
  TYPE_SOLUTION: 'Type de solution (progiciel, plateforme…)',
  TYPE_OBJET_CONTRAT: "Type d'objet contractuel",
  EMAIL_FACTURES: 'Email dédiée à la facturation (CLIENT)',
  MONTANT_HT_MATERIEL: 'Montant Total HT Matériel (MAD)',
  MONTANT_TTC_MATERIEL: 'Montant Total TTC Matériel (MAD)',
  MONTANT_GLOBAL_HT: 'Montant Global HT du Contrat (MAD)',
  MONTANT_REDEVANCE: 'Redevance de licence / maintenance (MAD/an)',
  TAUX_TVA: 'Taux de TVA applicable (%)',
  MODALITES_PAIEMENT_MATERIEL: 'Modalités de paiement',
  DELAI_PAIEMENT_JOURS: 'Délai de règlement des factures (jours)',
  DELAI_PAIEMENT: 'Délai de règlement (jours)',
  DUREE_GARANTIE_MOIS: 'Durée de la garantie matériel (mois)',
  DUREE_MOIS: 'Durée du Contrat (mois)',
  DATE_LIVRAISON_PREVUE: 'Date de livraison prévue',
  SITE_LIVRAISON: 'Site de livraison (adresse complète)',
  SITE_INSTALLATION: "Site d'installation (adresse complète)",
  PENALITE_RETARD_LIVRAISON_POURCENT: 'Pénalité retard livraison (% / semaine)',
  PENALITE_RETARD_PLAFOND_POURCENT: 'Plafond total pénalités de retard (%)',
  DELAI_VERIFICATION_JOURS: 'Délai de vérification à réception (jours ouvrés)',
  DELAI_INTERVENTION_GTI_HEURES: "GTI — Délai d'Intervention (heures ouvrées)",
  DELAI_RESOLUTION_GTR_HEURES: 'GTR — Délai de Rétablissement (heures ouvrées)',
  PLAGE_SAV: 'Plage horaire SAV (ex: 8h-18h jours ouvrés)',
  CONDITIONS_MAINTENANCE_POST_GARANTIE: 'Conditions maintenance post-garantie',
  LANGUE_DOCUMENTATION: 'Langue de la documentation technique',
  DUREE_CONTRAT: 'Durée du Contrat (ex: 12 mois, 3 ans)',
  TACITE_RECONDUCTION: 'Tacite reconduction (OUI / NON)',
  DELAI_PREAVIS_NON_RENOUVELLEMENT: 'Préavis de non-renouvellement (mois)',
  DELAI_PREAVIS_RESILIATION: 'Préavis de résiliation pour convenance (jours)',
  DELAI_PREAVIS_RESILIATION_MATERIEL_JOURS: 'Préavis de résiliation avant livraison (jours)',
  PRESTATIONS_INSTALLATION: "Prestations d'installation incluses",
  DELAI_MISE_EN_SERVICE_JOURS: 'Délai de mise en service après livraison (jours)',
  REFERENCE_ANNEXE_SPECS: "Référence de l'Annexe de spécifications (ex: Annexe 3)",
  DESCRIPTION_MATERIEL: 'Description générale du matériel acquis',
};

const STEP_META: Record<VarGroup | 'qualification' | 'export', { label: string; desc: string }> = {
  qualification: { label: 'Qualification', desc: 'Typologies & options du contrat' },
  parties:       { label: 'Parties',       desc: "Identité des cocontractants" },
  financier:     { label: 'Financier',     desc: 'Montants, tarifs et modalités' },
  delais:        { label: 'Délais & SLA',  desc: 'Calendriers, garanties, pénalités' },
  general:       { label: 'Paramètres',    desc: 'Informations complémentaires' },
  export:        { label: 'Export',        desc: 'Générer le document Word' },
};

function humanizeLabel(v: string): string {
  return VAR_LABELS[v] ?? v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function categorizeVar(v: string): VarGroup {
  if (v === 'QUALITE_CLIENT') return 'parties';
  if (v === 'TACITE_RECONDUCTION' || v === 'DELAI_PREAVIS_NON_RENOUVELLEMENT' || v === 'DUREE_CONTRAT') return 'delais';
  if (/^(NOM_|ADRESSE_|RC_|CAPITAL_|REPRESENTANT_|QUALITE_|ROLE_|VILLE_|EMAIL_|CONTACT_)/i.test(v))
    return 'parties';
  if (/^(MONTANT_|TAUX_|REDEVANCE_|MODALITE|FRAIS_|PRIX_)/i.test(v))
    return 'financier';
  if (/^(DUREE_|DELAI_|DATE_|GTI_|GTR_|PENALITE_|PLAFOND_|PREAVIS|SITE_|PLAGE_|FREQUENCE_)/i.test(v))
    return 'delais';
  return 'general';
}

function getInputType(v: string): 'text' | 'number' | 'date' | 'textarea' {
  if (/^DATE_/i.test(v)) return 'date';
  if (/(MONTANT_|TAUX_|DUREE_|DELAI_|GTI_|GTR_|PENALITE_|PLAFOND_|CAPITAL_)/.test(v)) return 'number';
  if (/(DESCRIPTION_|CONDITIONS_|PRESTATIONS_|MODALITES_)/.test(v)) return 'textarea';
  return 'text';
}

function isWideField(v: string): boolean {
  return /(ADRESSE_|DESCRIPTION_|CONDITIONS_|PRESTATIONS_|MODALITES_|NOM_OBJ|TYPE_|PLAGE_|SITE_|LANGUE_)/.test(v);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StepIndicatorProps {
  steps: string[];
  current: number;
  done: Set<number>;
  onClickStep: (idx: number) => void;
}

function StepIndicator({ steps, current, done, onClickStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-0 px-5 py-4 border-b border-border-dark bg-bg-sidebar select-none">
      {steps.map((stepId, idx) => {
        const meta = STEP_META[stepId as keyof typeof STEP_META];
        const isCurrent = idx === current;
        const isDone = done.has(idx);
        const canClick = isDone || idx <= current;

        return (
          <React.Fragment key={stepId}>
            <button
              onClick={() => canClick && onClickStep(idx)}
              className={`flex flex-col items-center gap-1 group transition-all ${canClick ? 'cursor-pointer' : 'cursor-default'}`}
              style={{ minWidth: 52 }}
            >
              {/* Circle */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isCurrent
                    ? 'bg-accent border-accent text-black shadow-[0_0_0_3px_rgba(var(--accent-rgb),.2)]'
                    : isDone
                    ? 'bg-accent/80 border-accent/80 text-black'
                    : 'bg-bg-input border-border-dark text-text-dim'
                }`}
              >
                {isDone && !isCurrent ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              {/* Label */}
              <span
                className={`text-[9px] font-semibold tracking-wide uppercase leading-tight text-center transition-colors ${
                  isCurrent ? 'text-accent' : isDone ? 'text-text-bright' : 'text-text-dim'
                }`}
                style={{ maxWidth: 52 }}
              >
                {meta?.label}
              </span>
            </button>
            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-px mx-1 transition-colors ${
                  done.has(idx) ? 'bg-accent/60' : 'bg-border-dark'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Wizard() {
  const [sections, setSections] = useState<Section[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);

  const [variables, setVariables] = useState<Record<string, any>>({
    // ── CLIENT — pré-renseigné Attijariwafa bank ──────────────────────────
    NOM_CLIENT: 'Attijariwafa bank',
    QUALITE_CLIENT: 'LE CLIENT',
    CAPITAL_CLIENT: 'Dirhams 2.151.408.390,00',
    ADRESSE_CLIENT: '2, Boulevard Moulay Youssef, Casablanca',
    RC_CLIENT: '333',
    REPRESENTANT_CLIENT_1: '',
    QUALITE_REPRESENTANT_CLIENT_1: '',
    REPRESENTANT_CLIENT_2: '',
    QUALITE_REPRESENTANT_CLIENT_2: '',
    // ── PRESTATAIRE — à renseigner ────────────────────────────────────────
    NOM_PRESTATAIRE: '',
    PRESTATAIRE_NOM: '', // alias utilisé dans certains articles
    ADRESSE_PRESTATAIRE: '',
    RC_PRESTATAIRE: '',
    CAPITAL_PRESTATAIRE: '',
    VILLE_RC_PRESTATAIRE: '',
    REPRESENTANT_PRESTATAIRE: '',
    QUALITE_REPRESENTANT_PRESTATAIRE: '',
    ROLE_PRESTATAIRE: '',
    // ── Objet du contrat ──────────────────────────────────────────────────
    NOM_OBJET_CONTRAT: '',
    NOM_LOGICIEL: '',
    TYPE_SOLUTION: '',
    TYPE_OBJET_CONTRAT: '',
    // ── Conditions générales ──────────────────────────────────────────────
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
    DUREE_CONTRAT: '12 mois',
    TACITE_RECONDUCTION: 'NON',
    DELAI_PREAVIS_NON_RENOUVELLEMENT: '3',
    ProjectType: ['Log_OnPrem'] as string[],
    hasSensitiveData: 'NON',
    externalHosting: 'NON',
    customDevelopment: 'NON',
  });

  const [uploadedTemplate, setUploadedTemplate] = useState<string | null>(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showClientVars, setShowClientVars] = useState(false);
  const [additionalAnnexes, setAdditionalAnnexes] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedHtml, setEditedHtml] = useState<string | null>(null);
  const [manuallyExcluded, setManuallyExcluded] = useState<Set<string>>(new Set());
  const previewBodyRef = useRef<HTMLDivElement>(null);

  // Noms des variables considérées comme "données CLIENT" (pré-renseignées)
  const CLIENT_VAR_KEYS = new Set([
    'NOM_CLIENT', 'QUALITE_CLIENT', 'CAPITAL_CLIENT', 'ADRESSE_CLIENT', 'RC_CLIENT',
    'REPRESENTANT_CLIENT_1', 'QUALITE_REPRESENTANT_CLIENT_1',
    'REPRESENTANT_CLIENT_2', 'QUALITE_REPRESENTANT_CLIENT_2',
  ]);

  // Load catalog
  useEffect(() => {
    const rawArticles = defaultCatalog.catalogue_contrat_it.articles as any[];
    const sectionNames = [...new Set(rawArticles.map((a) => a.categorie))] as string[];
    setSections(
      sectionNames.map((name, i) => ({
        id: name, title: name, order: i,
        createdAt: Date.now(), updatedAt: Date.now(),
      }))
    );
    const flat: Article[] = [];
    rawArticles.forEach((a, i) => {
      flat.push({
        id: a.id, title: a.titre, content: a.contenu,
        sectionId: a.categorie, order: i,
        ruleType: a.condition_generation === 'TOUJOURS_INCLURE' ? 'ALWAYS_INCLUDE' : 'CONDITIONAL',
        condition_generation: a.condition_generation,
        variables_requises: a.variables,
        parentId: null, depth: 0,
        createdAt: Date.now(), updatedAt: Date.now(),
      });
      if (Array.isArray(a.sous_articles)) {
        a.sous_articles.forEach((sa: any, si: number) => {
          flat.push({
            id: sa.id || `${a.id}_${si}`,
            title: sa.titre || sa.title || '',
            content: sa.contenu || sa.content || '',
            sectionId: a.categorie, order: si,
            ruleType: !sa.condition_generation || sa.condition_generation === 'TOUJOURS_INCLURE'
              ? 'ALWAYS_INCLUDE' : 'CONDITIONAL',
            condition_generation: sa.condition_generation || 'TOUJOURS_INCLURE',
            variables_requises: sa.variables || [],
            parentId: a.id, depth: 1,
            createdAt: Date.now(), updatedAt: Date.now(),
          });
        });
      }
    });
    setArticles(flat);
  }, []);

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setUploadedTemplate(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // ── Condition evaluation ──
  const evaluateCondition = (article: Article): boolean => {
    const cond = article.condition_generation;
    if (cond === 'NEVER_INCLUDE') return false;
    if (article.ruleType === 'ALWAYS_INCLUDE' || !cond || cond === 'TOUJOURS_INCLURE') return true;
    const typeMatch = cond.match(/TYPES_PROJET_INCLUDES\('([^']+)'\)/i);
    if (typeMatch) {
      // Support virgule → OR logique : TYPES_PROJET_INCLUDES('Logiciel,Mise en oeuvre')
      const requiredList = typeMatch[1].split(',').map(s => s.trim().toLowerCase());
      const actual = Array.isArray(variables.ProjectType) ? variables.ProjectType : [variables.ProjectType];
      const inc = (id: string) => actual.includes(id);
      const hasLogiciel     = inc('Log_OnPrem') || inc('Licence_OnPrem');
      const hasSaaS         = inc('Log_SaaS') || inc('SaaS') || variables.externalHosting === 'OUI';
      const hasMateriel     = inc('Mat_Achat') || inc('Mat_Location') || inc('Mat_Install') || inc('Mat_Maintenance') || inc('Materiel');
      const hasMiseEnOeuvre = inc('Prest_MOE') || inc('Mat_Install') || inc('Log_Dev') || inc('Mise_en_Oeuvre') || inc('Developpement') || inc('Migration');
      const hasMaintenance  = inc('Mat_Maintenance') || inc('Maintenance_TMA');
      const hasRegie        = inc('Prest_Regie') || inc('Régie');
      const hasForfait      = inc('Prest_Forfait') || inc('Forfait');
      const hasConseil      = inc('Prest_Conseil');
      const hasServices     = hasRegie || hasForfait || hasConseil;
      const resolveType = (r: string): boolean => {
        if (r === 'logiciel') return hasLogiciel;
        if (r === 'matériel' || r === 'materiel') return hasMateriel;
        if (r === 'mise en œuvre' || r === 'mise en oeuvre') return hasMiseEnOeuvre;
        if (r === 'maintenance') return hasMaintenance;
        if (r === 'hébergement' || r === 'hebergement') return hasSaaS;
        if (r === 'services') return hasServices;
        if (r === 'régie' || r === 'regie') return hasRegie;
        if (r === 'forfait') return hasForfait;
        if (r === 'conseil') return hasConseil;
        return false;
      };
      return requiredList.some(resolveType);
    }
    const siMatch = cond.match(/SI \[([^\]]+)\] (INCLUDES|==) (.*)/i);
    if (!siMatch) return true;
    let field = siMatch[1].trim();
    const operator = siMatch[2].trim().toUpperCase();
    const rawValue = siMatch[3].trim();
    if (field === 'Type_Projet') field = 'ProjectType';
    if (field === 'Donnees_Sensibles') field = 'hasSensitiveData';
    if (field === 'Hebergement') field = 'externalHosting';
    const actual = variables[field];
    if (!actual) return false;
    if (operator === 'INCLUDES') {
      const vals = rawValue.replace(/['()]/g, '').split(',').map((v) => v.trim().toLowerCase());
      return Array.isArray(actual)
        ? actual.some((a) => vals.includes(a.toString().toLowerCase()))
        : vals.includes(actual.toString().toLowerCase());
    } else {
      let cleanVal = rawValue.replace(/['()]/g, '').trim().toLowerCase();
      if (field === 'hasSensitiveData' && cleanVal === 'true') cleanVal = 'oui';
      if (field === 'externalHosting' && cleanVal === 'externe_cloud') cleanVal = 'oui';
      const actualLower = Array.isArray(actual) ? actual[0]?.toString().toLowerCase() : actual.toString().toLowerCase();
      return actualLower === cleanVal;
    }
  };

  const includedArticles: Article[] = useMemo(() => {
    const rootArticles = articles.filter((a) => !a.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const childrenOf = (pid: string) => articles.filter((a) => a.parentId === pid).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const result: Article[] = [];
    for (const root of rootArticles) {
      if (!evaluateCondition(root)) continue;
      result.push(root);
      for (const child of childrenOf(root.id)) {
        if (!evaluateCondition(child)) continue;
        result.push(child);
        for (const gc of childrenOf(child.id)) {
          if (!evaluateCondition(gc)) continue;
          result.push(gc);
        }
      }
    }
    return result.filter((a) => !manuallyExcluded.has(a.id));
  }, [articles, variables, manuallyExcluded]);

  const requiredVariables = useMemo(() => {
    const vars = new Set<string>();
    includedArticles.forEach((art) => {
      (art.variables_requises ?? []).forEach((v) => vars.add(v.replace(/[{}]/g, '')));
      const matches = art.content.match(/\{\{([A-Za-z0-9_]+)\}\}/g);
      if (matches) matches.forEach((m) => vars.add(m.replace(/[{}]/g, '')));
    });
    ['ProjectType', 'hasSensitiveData', 'externalHosting', 'customDevelopment',
     'DUREE_CONTRAT', 'TACITE_RECONDUCTION', 'DELAI_PREAVIS_NON_RENOUVELLEMENT'].forEach((k) => vars.delete(k));
    return Array.from(vars);
  }, [includedArticles]);

  // ── Variable grouping & step definitions ──
  const varsByGroup = useMemo(() => {
    const groups: Record<VarGroup, string[]> = { parties: [], financier: [], delais: [], general: [] };
    requiredVariables.forEach((v) => groups[categorizeVar(v)].push(v));
    return groups;
  }, [requiredVariables]);

  const stepIds = useMemo(() => {
    const ids: string[] = ['qualification'];
    (['parties', 'financier', 'delais', 'general'] as VarGroup[]).forEach((g) => {
      if (varsByGroup[g].length > 0) ids.push(g);
    });
    ids.push('export');
    return ids;
  }, [varsByGroup]);

  // Clamp step index if steps shrink
  useEffect(() => {
    if (currentStepIdx >= stepIds.length) setCurrentStepIdx(stepIds.length - 1);
  }, [stepIds.length]);

  const goTo = (idx: number) => {
    setCurrentStepIdx(idx);
  };
  const goPrev = () => goTo(Math.max(0, currentStepIdx - 1));
  const goNext = () => goTo(Math.min(stepIds.length - 1, currentStepIdx + 1));

  const doneSteps = useMemo(() => {
    const s = new Set<number>();
    stepIds.forEach((_, idx) => { if (idx < currentStepIdx) s.add(idx); });
    return s;
  }, [currentStepIdx, stepIds]);

  // ── Contract compilation ──
  const TYPE_LABELS: Record<string, string> = {
    // Matériel
    Mat_Achat:       'Acquisition Matériel',
    Mat_Location:    'Location Matériel',
    Mat_Install:     'Mise en Œuvre Matériel',
    Mat_Maintenance: 'Maintenance Matériel',
    // Logiciel
    Log_OnPrem: 'Licence On-Premise',
    Log_SaaS:   'Abonnement SaaS',
    Log_Dev:    'Développement Spécifique',
    // Prestation
    Prest_MOE:     'Intégration / Mise en Œuvre',
    Prest_Regie:   'Régie',
    Prest_Forfait: 'Forfait',
    Prest_Conseil: 'Mission de Conseil',
    // Rétro-compat
    Licence_OnPrem: 'Licence Logiciel', SaaS: 'Solution SaaS',
    Materiel: 'Acquisition Matériel', Mise_en_Oeuvre: 'Mise en Œuvre',
    Developpement: 'Développement Spécifique', Migration: 'Migration',
    Maintenance_TMA: 'Maintenance & TMA', Régie: 'Régie', Forfait: 'Forfait',
  };

  const buildContractTitle = (): string => {
    const types = (Array.isArray(variables.ProjectType) ? variables.ProjectType : [variables.ProjectType])
      .filter(Boolean) as string[];
    const typologiesStr = types.map((t) => TYPE_LABELS[t] || t).join(' - ');
    const objet = variables.NOM_OBJET_CONTRAT?.trim() || '';
    return `CONTRAT DE ${typologiesStr}${objet ? ' — ' + objet : ''}`;
  };

  // Détecte les termes du dictionnaire présents dans le corpus des articles inclus
  const buildDynamicDefinitions = (articleTexts: string[]): string => {
    const allDefs = (defDictionary as any).dictionnaire_definitions.definitions as any[];
    const corpus = articleTexts.join(' ');
    const matched: any[] = [];

    for (const def of allDefs) {
      const terms: string[] = [def.terme, ...(def.aliases ?? [])];
      const found = terms.some((t: string) =>
        new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(corpus)
      );
      if (found) matched.push(def);
    }

    if (matched.length === 0) return '';

    matched.sort((a, b) => a.terme.localeCompare(b.terme, 'fr'));
    return matched
      .map((d, i) => `${i + 1}. ${d.terme.toUpperCase()}\n\n${d.definition}`)
      .join('\n\n');
  };

  const compileContractText = () => {
    const contractTitle = buildContractTitle();
    const clientName    = variables.NOM_CLIENT?.trim()     || '{{NOM_CLIENT}}';
    const prestatName   = (variables.NOM_PRESTATAIRE || variables.PRESTATAIRE_NOM)?.trim() || '{{NOM_PRESTATAIRE}}';

    // Header block: titre + parties — no section heading, rendered as cover
    const headerBlock = {
      type: 'header' as const,
      contractTitle,
      clientName,
      prestataireName: prestatName,
    };

    const structuredData: any[] = [headerBlock];
    const sortedSections = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Variables: valeur renseignée → bleu; vide → nom de la variable en orange (pour repérage post-export)
    const injectVars = (text: string): string =>
      text.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (match, p1) => {
        // TITRE_CONTRAT est calculé dynamiquement depuis la typologie + objet
        if (p1 === 'TITRE_CONTRAT') {
          const title = buildContractTitle();
          return `<span data-var="NOM_OBJET_CONTRAT" style="color:#0055cc;font-weight:600;background:#e8f0fe;padding:0 3px;border-radius:3px;cursor:pointer;text-decoration:underline dotted" title="Cliquer pour modifier le titre">${title}</span>`;
        }
        // NOM_PRESTATAIRE et PRESTATAIRE_NOM sont synonymes
        const val = variables[p1] ?? (p1 === 'NOM_PRESTATAIRE' ? variables.PRESTATAIRE_NOM : undefined)
                                  ?? (p1 === 'PRESTATAIRE_NOM' ? variables.NOM_PRESTATAIRE : undefined);
        return val && String(val).trim() !== ''
          ? `<span data-var="${p1}" style="color:#0055cc;font-weight:600;background:#e8f0fe;padding:0 3px;border-radius:3px;cursor:pointer;text-decoration:underline dotted" title="Cliquer pour modifier ${p1}">${String(val)}</span>`
          : `<span data-var="${p1}" style="color:#b7500a;font-weight:600;background:#fff3e0;padding:0 3px;border-radius:3px;font-family:monospace;font-size:0.85em;cursor:pointer;text-decoration:underline dotted" title="Cliquer pour renseigner ${p1}">{{${p1}}}</span>`;
      });

    // rootCounter global → numérotation continue entre sections
    let rootCounter = 0;
    for (const section of sortedSections) {
      const sectionIncluded = includedArticles.filter((a) => a.sectionId === section.id);
      if (sectionIncluded.length === 0) continue;
      const sectionRoots = sectionIncluded.filter((a) => !a.parentId);
      if (sectionRoots.length === 0) continue;
      const structSection: any = { title: section.title.toUpperCase(), articles: [] };
      for (const art of sectionIncluded) {
        const depth = art.depth ?? 0;
        let numLabel = '';
        if (depth === 0) {
          rootCounter++;
          (art as any)._rootNum = rootCounter;
          (art as any)._subNum = 0;
          numLabel = `${rootCounter}`;
        } else if (depth === 1) {
          const parent = sectionIncluded.find((a) => a.id === art.parentId && (a.depth ?? 0) === 0);
          const parentRootNum = parent ? (parent as any)._rootNum ?? rootCounter : rootCounter;
          const parentArt = sectionIncluded.find((a) => a.id === art.parentId);
          if (parentArt) {
            (parentArt as any)._subNum = ((parentArt as any)._subNum ?? 0) + 1;
            (art as any)._subNum = (parentArt as any)._subNum;
            (art as any)._gcNum = 0;
          }
          numLabel = `${parentRootNum}.${(art as any)._subNum}`;
        } else if (depth === 2) {
          const parent = sectionIncluded.find((a) => a.id === art.parentId);
          const grandParent = parent ? sectionIncluded.find((a) => a.id === parent.parentId) : null;
          const gpNum = grandParent ? (grandParent as any)._rootNum ?? 1 : 1;
          const pNum = parent ? (parent as any)._subNum ?? 1 : 1;
          if (parent) { (parent as any)._gcNum = ((parent as any)._gcNum ?? 0) + 1; (art as any)._gcNum = (parent as any)._gcNum; }
          numLabel = `${gpNum}.${pNum}.${(art as any)._gcNum}`;
        }
        const cleanTitle = stripNumber(art.title);
        const numberedTitle = depth === 0 ? `Article ${numLabel} — ${cleanTitle}` : `${numLabel} — ${cleanTitle}`;
        let rawContent = depth > 0 ? stripContentLeadingNumber(art.content) : art.content;
        // ART_OBJET : génération dynamique des volets selon la typologie projet
        if (art.id === 'ART_OBJET') {
          const actual = Array.isArray(variables.ProjectType) ? variables.ProjectType : [variables.ProjectType];
          const inc2 = (id: string) => actual.includes(id);
          const hasMateriel    = inc2('Mat_Achat') || inc2('Mat_Location') || inc2('Mat_Install') || inc2('Mat_Maintenance') || inc2('Materiel');
          const hasLogiciel    = inc2('Log_OnPrem') || inc2('Licence_OnPrem');
          const hasSaaS        = inc2('Log_SaaS') || inc2('SaaS') || variables.externalHosting === 'OUI';
          const hasMoeuvre     = inc2('Prest_MOE') || inc2('Mat_Install') || inc2('Log_Dev') || inc2('Mise_en_Oeuvre') || inc2('Developpement') || inc2('Migration');
          const hasMaintenance = inc2('Mat_Maintenance') || inc2('Maintenance_TMA');
          const hasRegie       = inc2('Prest_Regie') || inc2('Régie');
          const hasForfait     = inc2('Prest_Forfait') || inc2('Forfait');
          const hasConseil2    = inc2('Prest_Conseil');
          const qualC  = variables.QUALITE_CLIENT?.trim() || 'LE CLIENT';
          const roleP  = variables.ROLE_PRESTATAIRE?.trim() || 'LE PRESTATAIRE';
          const objet  = variables.NOM_OBJET_CONTRAT?.trim() || '{{NOM_OBJET_CONTRAT}}';
          const volets: string[] = [];
          let idx = 0;
          const roman = ['(i)','(ii)','(iii)','(iv)','(v)','(vi)','(vii)','(viii)'];
          if (hasMateriel) volets.push(`${roman[idx++]} l'acquisition du matériel informatique et des équipements définis à l'Annexe 1 — Description du Service`);
          if (hasLogiciel) volets.push(`${roman[idx++]} la concession d'un droit d'utilisation non exclusif du logiciel ${variables.NOM_LOGICIEL?.trim() || objet}, selon les conditions de l'Annexe 1`);
          if (hasSaaS)    volets.push(`${roman[idx++]} la mise à disposition en mode SaaS / hébergement de la solution ${variables.NOM_LOGICIEL?.trim() || objet}, selon les niveaux de service définis à l'Annexe 1`);
          if (hasMoeuvre) volets.push(`${roman[idx++]} les prestations de mise en œuvre, d'intégration et de déploiement de la solution, conformément aux spécifications de l'Annexe 1`);
          if (hasMaintenance) volets.push(`${roman[idx++]} les prestations de maintenance corrective et évolutive (TMA) de la solution, selon les engagements de service de l'Annexe 1`);
          if (hasRegie)   volets.push(`${roman[idx++]} des prestations de services intellectuels en régie selon les modalités de l'Annexe 1`);
          if (hasForfait)   volets.push(`${roman[idx++]} des prestations de services au forfait selon les livrables définis à l'Annexe 1`);
          if (hasConseil2)  volets.push(`${roman[idx++]} une mission de conseil portant sur ${objet}, selon les modalités de l'Annexe 1`);
          const violetsList = volets.length > 1
            ? `\n\nLe présent Contrat couvre les volets suivants :\n${volets.join(' ;\n')}.\n\nLes détails techniques, fonctionnels et financiers de chaque volet sont précisés dans l'Annexe 1 — Description du Service et l'Annexe 2 — Modalités Financières, parties intégrantes du présent Contrat.`
            : volets.length === 1
            ? `\n\n${volets[0]}.\n\nLes conditions détaillées sont précisées dans l'Annexe 1 — Description du Service, partie intégrante du présent Contrat.`
            : '';
          rawContent = `Le présent Contrat a pour objet ${objet}, conclu entre ${qualC} et ${roleP}.${violetsList}`;
        }
        // ART_DUREE : durée unique + clause tacite reconduction conditionnelle
        if (art.id === 'ART_DUREE') {
          const duree  = variables.DUREE_CONTRAT?.trim() || '{{DUREE_CONTRAT}}';
          const tacite = variables.TACITE_RECONDUCTION;
          const preavis = variables.DELAI_PREAVIS_NON_RENOUVELLEMENT?.trim() || '{{DELAI_PREAVIS_NON_RENOUVELLEMENT}}';
          const clauseTacite = tacite === 'OUI'
            ? `\n\nÀ l'issue de cette période initiale, le Contrat sera reconduit tacitement par périodes successives d'égale durée, sauf notification de non-renouvellement adressée par l'une ou l'autre des Parties par lettre recommandée avec accusé de réception, au moins ${preavis} mois avant la date d'échéance.`
            : `\n\nLe Contrat prend fin de plein droit à l'échéance de la durée ci-dessus, sans qu'une notification particulière soit nécessaire, sauf renouvellement express formalisé par avenant signé des deux Parties.`;
          rawContent = `Le présent Contrat prend effet à compter de sa date de signature par les deux Parties pour une durée de ${duree}.\n\nEn cas de résiliation ou d'expiration, les obligations de confidentialité et de restitution des données demeurent en vigueur pour la durée stipulée aux Stipulations Communes.${clauseTacite}`;
        }
        // ART_003 : définitions générées dynamiquement depuis le dictionnaire
        if (art.id === 'ART_003') {
          const allTexts = includedArticles
            .filter((a) => a.id !== 'ART_003')
            .map((a) => a.content + ' ' + a.title);
          const dynDefs = buildDynamicDefinitions(allTexts);
          if (dynDefs) rawContent = dynDefs;
        }
        // ART_999 : annexes standard + annexes supplémentaires
        if (art.id === 'ART_999' && additionalAnnexes.length > 0) {
          const baseCount = 5;
          const extra = additionalAnnexes
            .map((title, i) => `ANNEXE ${baseCount + i + 1} — ${title}`)
            .join('\n\n');
          rawContent = rawContent + '\n\n' + extra;
        }
        const cleanContent = injectVars(rawContent);
        structSection.articles.push({ id: art.id, title: numberedTitle, content: cleanContent, depth });
      }
      structuredData.push(structSection);
    }

    // ── Bloc signature — toujours en dernier ─────────────────────────────
    const rep1  = variables.REPRESENTANT_CLIENT_1?.trim()        || '{{REPRESENTANT_CLIENT_1}}';
    const qual1 = variables.QUALITE_REPRESENTANT_CLIENT_1?.trim() || '';
    const rep2  = variables.REPRESENTANT_CLIENT_2?.trim()        || '{{REPRESENTANT_CLIENT_2}}';
    const qual2 = variables.QUALITE_REPRESENTANT_CLIENT_2?.trim() || '';
    const repP  = variables.REPRESENTANT_PRESTATAIRE?.trim()     || '{{REPRESENTANT_PRESTATAIRE}}';
    const qualP = variables.QUALITE_REPRESENTANT_PRESTATAIRE?.trim() || '';
    structuredData.push({
      type: 'signature' as const,
      clientName: variables.NOM_CLIENT?.trim() || '{{NOM_CLIENT}}',
      prestataireName: (variables.NOM_PRESTATAIRE || variables.PRESTATAIRE_NOM)?.trim() || '{{NOM_PRESTATAIRE}}',
      representant1: rep1, qualite1: qual1,
      representant2: rep2, qualite2: qual2,
      representantPrestataire: repP, qualitePrestataire: qualP,
    });

    return structuredData;
  };

  const compiledResult = useMemo(() => compileContractText(), [includedArticles, variables, sections, additionalAnnexes]);

  const handleExport = () => {
    const stripMarkup = (html: string) =>
      html.replace(/<span[^>]*>([\s\S]*?)<\/span>/g, '$1').replace(/<[^>]+>/g, '');

    // Si des éditions manuelles existent, extraire le texte depuis le DOM
    let exportStructure = compiledResult;
    if (editedHtml) {
      const tmp = document.createElement('div');
      tmp.innerHTML = editedHtml;
      exportStructure = compiledResult.map((section: any) => {
        if (section.type === 'header' || section.type === 'signature') return section;
        return {
          ...section,
          articles: section.articles.map((art: any) => {
            const artEl = tmp.querySelector(`[data-art-id="${art.id}"]`);
            if (!artEl) return art;
            const bodyEl = artEl.querySelector('.art-body');
            const newContent = bodyEl ? (bodyEl.innerHTML) : art.content;
            return { ...art, content: newContent };
          }),
        };
      });
    }

    generateDocx(
      {
        ...variables,
        CONTRAT_BODY: exportStructure
          .filter((s: any) => s.type !== 'header' && s.type !== 'signature')
          .flatMap((s: any) => [
            `\n\n--- ${s.title} ---\n`,
            ...s.articles.map((a: any) => `${a.title ? a.title + '\n' : ''}${stripMarkup(a.content)}`),
          ]).join('\n'),
        STRUCTURE: exportStructure,
      },
      uploadedTemplate || undefined
    );
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const rootIncluded = includedArticles.filter((a) => !a.parentId);
  const currentStepId = stepIds[currentStepIdx] ?? 'qualification';

  const setVar = (key: string, val: any) => setVariables((prev) => ({ ...prev, [key]: val }));

  function renderVarField(v: string) {
    const type = getInputType(v);
    const label = humanizeLabel(v);
    const wide = isWideField(v);
    const baseInput = 'w-full px-3 py-2 border border-border-dark rounded-lg bg-bg-input text-text-bright text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-text-dim/50';

    return (
      <div key={v} className={wide ? 'col-span-2' : ''}>
        <label className="block text-[10px] font-bold text-accent/80 uppercase tracking-widest mb-1.5">
          {label}
        </label>
        {type === 'textarea' ? (
          <textarea
            rows={3}
            data-field={v}
            className={`${baseInput} resize-none`}
            value={variables[v] ?? ''}
            onChange={(e) => setVar(v, e.target.value)}
            placeholder={`Ex: ${label.toLowerCase()}`}
          />
        ) : (
          <input
            type={type}
            data-field={v}
            className={baseInput}
            value={variables[v] ?? ''}
            onChange={(e) => setVar(v, e.target.value)}
            placeholder={type === 'number' ? '0' : `Ex: ${label.toLowerCase()}`}
          />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Step content renderers
  // ---------------------------------------------------------------------------

  function renderQualificationStep() {
    const PROJECT_CATEGORIES = [
      {
        id: 'materiel',
        label: 'Matériel',
        color: '#3b82f6',
        types: [
          { id: 'Mat_Achat',        label: 'Acquisition' },
          { id: 'Mat_Location',     label: 'Location' },
          { id: 'Mat_Install',      label: 'Mise en œuvre' },
          { id: 'Mat_Maintenance',  label: 'Maintenance' },
        ],
      },
      {
        id: 'logiciel',
        label: 'Logiciel',
        color: '#8b5cf6',
        types: [
          { id: 'Log_OnPrem',  label: 'Acquisition On-Premise' },
          { id: 'Log_SaaS',    label: 'Abonnement SaaS' },
          { id: 'Log_Dev',     label: 'Développement Spécifique' },
        ],
      },
      {
        id: 'prestation',
        label: 'Prestation',
        color: '#10b981',
        types: [
          { id: 'Prest_MOE',      label: 'Intégration / Mise en œuvre' },
          { id: 'Prest_Regie',    label: 'Régie' },
          { id: 'Prest_Forfait',  label: 'Forfait' },
          { id: 'Prest_Conseil',  label: 'Mission de Conseil' },
        ],
      },
    ];

    const toggleType = (id: string) => {
      setVariables((prev) => {
        const types = Array.isArray(prev.ProjectType) ? prev.ProjectType : [prev.ProjectType];
        return { ...prev, ProjectType: types.includes(id) ? types.filter((t) => t !== id) : [...types, id] };
      });
    };

    const currentTypes = Array.isArray(variables.ProjectType) ? variables.ProjectType : [variables.ProjectType];

    const SELECT_CLASS = 'w-full px-3 py-2 border border-border-dark rounded-lg bg-bg-input text-text-bright text-sm focus:outline-none focus:border-accent transition-colors';

    return (
      <div className="space-y-6">
        <div>
          <p className="text-[10px] font-bold text-accent/80 uppercase tracking-widest mb-3">
            Typologies de prestations <span className="text-text-dim font-normal normal-case">(sélection multiple)</span>
          </p>
          <div className="space-y-3">
            {PROJECT_CATEGORIES.map((cat) => {
              const anyChecked = cat.types.some((t) => currentTypes.includes(t.id));
              return (
                <div key={cat.id} className={`rounded-lg border transition-all ${anyChecked ? 'border-[var(--cat-color)]/40 bg-[var(--cat-color)]/5' : 'border-border-dark bg-bg-input'}`}
                  style={{ '--cat-color': cat.color } as React.CSSProperties}>
                  <div className="px-3 py-2 border-b border-inherit">
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cat.color }}>
                      {cat.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 p-2">
                    {cat.types.map((pt) => {
                      const checked = currentTypes.includes(pt.id);
                      return (
                        <label
                          key={pt.id}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-md border cursor-pointer transition-all ${
                            checked ? 'bg-accent/10 border-accent' : 'bg-bg-main border-border-dark/50 hover:border-accent/40'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            checked ? 'bg-accent border-accent' : 'border-border-dark'
                          }`}>
                            {checked && (
                              <svg className="w-2 h-2 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleType(pt.id)} />
                          <span className={`text-[11px] font-medium leading-tight ${checked ? 'text-text-bright' : 'text-text-bright/70'}`}>
                            {pt.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-border-dark" />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-accent/80 uppercase tracking-widest mb-1.5">
              Hébergement externe ?
            </label>
            <select className={SELECT_CLASS} value={variables.externalHosting} onChange={(e) => setVar('externalHosting', e.target.value)}>
              <option value="NON">Non — On-Premise</option>
              <option value="OUI">Oui — Cloud / Externe</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-accent/80 uppercase tracking-widest mb-1.5">
              Données sensibles ?
            </label>
            <select className={SELECT_CLASS} value={variables.hasSensitiveData} onChange={(e) => setVar('hasSensitiveData', e.target.value)}>
              <option value="NON">Non</option>
              <option value="OUI">Oui (ISO 27001 renforcé)</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-accent/80 uppercase tracking-widest mb-1.5">
              Développements spécifiques ?
            </label>
            <select className={SELECT_CLASS} value={variables.customDevelopment} onChange={(e) => setVar('customDevelopment', e.target.value)}>
              <option value="NON">Non</option>
              <option value="OUI">Oui (clause cession PI requise)</option>
            </select>
          </div>
        </div>

        <div className="h-px bg-border-dark" />

        {/* ── Durée du contrat ─────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-bold text-accent/80 uppercase tracking-widest mb-3">
            Durée &amp; Renouvellement
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-accent/80 uppercase tracking-widest mb-1.5">
                Durée du Contrat
              </label>
              <input
                type="text"
                data-field="DUREE_CONTRAT"
                className={SELECT_CLASS}
                value={variables.DUREE_CONTRAT ?? ''}
                onChange={(e) => setVar('DUREE_CONTRAT', e.target.value)}
                placeholder="Ex: 12 mois, 3 ans"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-accent/80 uppercase tracking-widest mb-1.5">
                Préavis résiliation pour convenance (jours)
              </label>
              <input
                type="number"
                data-field="DELAI_PREAVIS_RESILIATION"
                className={SELECT_CLASS}
                value={variables.DELAI_PREAVIS_RESILIATION ?? '90'}
                onChange={(e) => setVar('DELAI_PREAVIS_RESILIATION', e.target.value)}
                placeholder="90"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-accent/80 uppercase tracking-widest mb-2">
                Tacite reconduction
              </label>
              <div className="flex items-center gap-4">
                {(['NON','OUI'] as const).map((val) => (
                  <label key={val} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all ${
                    variables.TACITE_RECONDUCTION === val ? 'bg-accent/10 border-accent text-text-bright' : 'bg-bg-input border-border-dark text-text-dim hover:border-accent/40'
                  }`}>
                    <input type="radio" className="sr-only" checked={variables.TACITE_RECONDUCTION === val} onChange={() => setVar('TACITE_RECONDUCTION', val)} />
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${variables.TACITE_RECONDUCTION === val ? 'border-accent' : 'border-border-dark'}`}>
                      {variables.TACITE_RECONDUCTION === val && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                    </div>
                    <span className="text-xs font-semibold">{val === 'OUI' ? 'Oui — reconduction automatique' : 'Non — terme fixe'}</span>
                  </label>
                ))}
              </div>
            </div>
            {variables.TACITE_RECONDUCTION === 'OUI' && (
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-accent/80 uppercase tracking-widest mb-1.5">
                  Préavis de non-renouvellement (mois)
                </label>
                <input
                  type="number"
                  data-field="DELAI_PREAVIS_NON_RENOUVELLEMENT"
                  className={SELECT_CLASS}
                  value={variables.DELAI_PREAVIS_NON_RENOUVELLEMENT ?? '3'}
                  onChange={(e) => setVar('DELAI_PREAVIS_NON_RENOUVELLEMENT', e.target.value)}
                  placeholder="3"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderVarStep(group: VarGroup) {
    const vars = varsByGroup[group];
    if (vars.length === 0) return (
      <div className="flex flex-col items-center justify-center py-10 text-text-dim gap-2">
        <CheckCircle2 className="w-10 h-10 text-accent/50" />
        <p className="text-sm">Aucune variable requise dans cette catégorie.</p>
      </div>
    );

    if (group !== 'parties') {
      return <div className="grid grid-cols-2 gap-4">{vars.map((v) => renderVarField(v))}</div>;
    }

    // ── Étape Parties : séparer CLIENT (pré-renseigné) et PRESTATAIRE ──────
    const clientVars  = vars.filter((v) => CLIENT_VAR_KEYS.has(v));
    const vendorVars  = vars.filter((v) => !CLIENT_VAR_KEYS.has(v));

    const baseInput = 'w-full px-3 py-2 border border-border-dark rounded-lg bg-bg-input text-text-bright text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-text-dim/50';

    return (
      <div className="space-y-6">

        {/* ── Bloc CLIENT ────────────────────────────────────────── */}
        {clientVars.length > 0 && (
          <div className="rounded-xl border border-border-dark overflow-hidden">
            {/* Header avec toggle */}
            <div className={`flex items-center justify-between px-4 py-3 ${
              showClientVars ? 'bg-accent/10 border-b border-accent/20' : 'bg-bg-input border-b border-border-dark'
            }`}>
              <div className="flex items-center gap-2">
                {showClientVars
                  ? <Unlock className="w-3.5 h-3.5 text-accent" />
                  : <Lock className="w-3.5 h-3.5 text-text-dim" />}
                <span className="text-[11px] font-bold text-text-bright uppercase tracking-wide">
                  Données CLIENT — Attijariwafa bank
                </span>
              </div>
              <button
                onClick={() => setShowClientVars((v) => !v)}
                className={`text-[10px] px-3 py-1 rounded-full border transition-all font-semibold ${
                  showClientVars
                    ? 'border-accent text-accent bg-accent/10 hover:bg-accent/20'
                    : 'border-border-dark text-text-dim hover:border-accent/50 hover:text-text-bright'
                }`}
              >
                {showClientVars ? 'Verrouiller' : 'Modifier'}
              </button>
            </div>

            {/* Champs CLIENT */}
            <div className="p-4">
              {showClientVars ? (
                <div className="grid grid-cols-2 gap-4">
                  {clientVars.map((v) => renderVarField(v))}
                </div>
              ) : (
                /* Vue lecture seule : badges grisés */
                <div className="grid grid-cols-2 gap-2">
                  {clientVars.map((v) => {
                    const val = variables[v];
                    return (
                      <div key={v} className={isWideField(v) ? 'col-span-2' : ''}>
                        <p className="text-[9px] font-bold text-text-dim/60 uppercase tracking-widest mb-1">
                          {humanizeLabel(v)}
                        </p>
                        <div className="px-3 py-2 rounded-lg bg-bg-sidebar border border-border-dark/40 text-text-dim text-xs truncate">
                          {val ? (
                            <span className="text-text-bright/70">{val}</span>
                          ) : (
                            <span className="italic text-text-dim/40">Non renseigné</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Bloc PRESTATAIRE ───────────────────────────────────── */}
        {vendorVars.length > 0 && (
          <div className="rounded-xl border border-border-dark overflow-hidden">
            <div className="px-4 py-3 bg-bg-input border-b border-border-dark flex items-center gap-2">
              <span className="text-[11px] font-bold text-text-bright uppercase tracking-wide">
                Données PRESTATAIRE
              </span>
              <span className="text-[9px] text-text-dim ml-1">— à renseigner</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                {vendorVars.map((v) => {
                  // NOM_PRESTATAIRE et PRESTATAIRE_NOM sont synonymes — n'afficher qu'un seul champ
                  if (v === 'PRESTATAIRE_NOM' && vendorVars.includes('NOM_PRESTATAIRE')) return null;
                  const type = getInputType(v);
                  const label = humanizeLabel(v);
                  const wide = isWideField(v);
                  return (
                    <div key={v} className={wide ? 'col-span-2' : ''}>
                      <label className="block text-[10px] font-bold text-accent/80 uppercase tracking-widest mb-1.5">
                        {label}
                      </label>
                      {type === 'textarea' ? (
                        <textarea
                          rows={3}
                          data-field={v}
                          className={`${baseInput} resize-none`}
                          value={variables[v] ?? ''}
                          onChange={(e) => {
                            setVar(v, e.target.value);
                            // Sync alias
                            if (v === 'NOM_PRESTATAIRE') setVar('PRESTATAIRE_NOM', e.target.value);
                            if (v === 'PRESTATAIRE_NOM') setVar('NOM_PRESTATAIRE', e.target.value);
                          }}
                          placeholder={`Ex: ${label.toLowerCase()}`}
                        />
                      ) : (
                        <input
                          type={type}
                          data-field={v}
                          className={baseInput}
                          value={variables[v] ?? ''}
                          onChange={(e) => {
                            setVar(v, e.target.value);
                            if (v === 'NOM_PRESTATAIRE') setVar('PRESTATAIRE_NOM', e.target.value);
                            if (v === 'PRESTATAIRE_NOM') setVar('NOM_PRESTATAIRE', e.target.value);
                          }}
                          placeholder={type === 'number' ? '0' : `Ex: ${label.toLowerCase()}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderExportStep() {
    return (
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Articles actifs', value: rootIncluded.length },
            { label: 'Clauses totales', value: includedArticles.length },
            { label: 'Variables', value: requiredVariables.length },
          ].map((stat) => (
            <div key={stat.label} className="bg-bg-input border border-border-dark rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-accent">{stat.value}</div>
              <div className="text-[10px] text-text-dim mt-1 uppercase tracking-wide">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="h-px bg-border-dark" />

        {/* Annexes supplémentaires */}
        <div>
          <p className="text-[10px] font-bold text-accent/80 uppercase tracking-widest mb-2">
            Annexes complémentaires
            <span className="text-text-dim font-normal normal-case ml-1">(Annexes 6, 7… ajoutées automatiquement)</span>
          </p>
          <div className="space-y-2">
            {additionalAnnexes.map((title, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[10px] text-text-dim font-mono w-16 flex-shrink-0">Annexe {6 + idx}</span>
                <input
                  className="flex-1 px-3 py-1.5 border border-border-dark rounded-lg bg-bg-input text-text-bright text-xs focus:outline-none focus:border-accent"
                  value={title}
                  placeholder="Titre de l'annexe"
                  onChange={(e) => setAdditionalAnnexes((prev) => prev.map((t, i) => i === idx ? e.target.value : t))}
                />
                <button
                  onClick={() => setAdditionalAnnexes((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-1.5 rounded-lg border border-border-dark text-text-dim hover:border-red-500/50 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setAdditionalAnnexes((prev) => [...prev, ''])}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dashed border-accent/40 text-accent/70 hover:border-accent hover:text-accent transition-all w-full justify-center"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter une annexe
            </button>
          </div>
        </div>

        <div className="h-px bg-border-dark" />

        {/* Template upload */}
        <div>
          <p className="text-[10px] font-bold text-accent/80 uppercase tracking-widest mb-2">
            Modèle Word personnalisé <span className="text-text-dim font-normal normal-case">(optionnel)</span>
          </p>
          <p className="text-xs text-text-dim mb-3">
            Uploadez un <code className="text-accent/70 bg-bg-input px-1 rounded">.docx</code> contenant la balise{' '}
            <code className="text-accent/70 bg-bg-input px-1 rounded">{'{{CONTRAT_BODY}}'}</code>
          </p>
          <label className={`flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
            uploadedTemplate ? 'border-accent/60 bg-accent/5' : 'border-border-dark bg-bg-input hover:border-accent/40'
          }`}>
            <Upload className={`w-5 h-5 mb-1.5 ${uploadedTemplate ? 'text-accent' : 'text-text-dim'}`} />
            <p className={`text-xs font-semibold ${uploadedTemplate ? 'text-accent' : 'text-text-dim'}`}>
              {uploadedTemplate ? '✓ Modèle chargé' : 'Cliquer pour charger un .docx'}
            </p>
            <input type="file" className="hidden" accept=".docx" onChange={handleTemplateUpload} />
          </label>
        </div>

        <div className="h-px bg-border-dark" />

        {/* Export button */}
        <button
          disabled={rootIncluded.length === 0}
          onClick={handleExport}
          className="w-full bg-accent hover:opacity-90 disabled:bg-border-dark disabled:text-text-dim text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-md text-sm"
        >
          <Download className="h-5 w-5" />
          Générer le fichier Word
        </button>

        {rootIncluded.length === 0 && (
          <p className="text-center text-xs text-text-dim flex items-center justify-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Sélectionnez au moins une prestation à l'étape 1.
          </p>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-full overflow-hidden bg-bg-main text-text-bright">

      {/* ══ LEFT PANEL — Stepper wizard ══════════════════════════════════════ */}
      <div className="w-[430px] flex-shrink-0 flex flex-col h-full border-r border-border-dark bg-bg-sidebar">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border-dark">
          <h1 className="text-xl font-bold text-text-bright tracking-tight">Nouveau Contrat</h1>
          <p className="text-xs text-text-dim mt-1">Assistant de génération déterministe</p>
        </div>

        {/* Step indicator */}
        <StepIndicator
          steps={stepIds}
          current={currentStepIdx}
          done={doneSteps}
          onClickStep={goTo}
        />

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Step heading */}
          <div className="mb-5">
            <h2 className="text-base font-bold text-text-bright">
              {STEP_META[currentStepId as keyof typeof STEP_META]?.label}
            </h2>
            <p className="text-xs text-text-dim mt-0.5">
              {STEP_META[currentStepId as keyof typeof STEP_META]?.desc}
            </p>
          </div>

          {/* Step-specific form */}
          {currentStepId === 'qualification' && renderQualificationStep()}
          {(currentStepId === 'parties' || currentStepId === 'financier' || currentStepId === 'delais' || currentStepId === 'general') &&
            renderVarStep(currentStepId as VarGroup)}
          {currentStepId === 'export' && renderExportStep()}
        </div>

        {/* Navigation */}
        <div className="px-6 py-4 border-t border-border-dark flex items-center gap-3">
          <button
            onClick={goPrev}
            disabled={currentStepIdx === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border-dark text-text-dim text-sm hover:border-accent/50 hover:text-text-bright disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Retour
          </button>
          <div className="flex-1" />
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {stepIds.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentStepIdx ? 'w-5 bg-accent' : idx < currentStepIdx ? 'w-1.5 bg-accent/50' : 'w-1.5 bg-border-dark'
                }`}
              />
            ))}
          </div>
          <div className="flex-1" />
          {currentStepIdx < stepIds.length - 1 ? (
            <button
              onClick={goNext}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-black text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              disabled={rootIncluded.length === 0}
              onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-black text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              Exporter
            </button>
          )}
        </div>
      </div>

      {/* ══ RIGHT PANEL — Live preview ════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* Preview toolbar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border-dark bg-bg-sidebar flex-shrink-0">
          <FileText className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold text-text-bright">Aperçu en temps réel</span>
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs bg-accent/15 text-accent border border-accent/30 px-2 py-0.5 rounded-full font-bold">
              {rootIncluded.length} art.
            </span>
            <span className="text-xs bg-bg-input border border-border-dark text-text-dim px-2 py-0.5 rounded-full">
              {includedArticles.length} clauses
            </span>
          </div>
          <div className="flex-1" />
          {(editedHtml || manuallyExcluded.size > 0) && !isEditMode && (
            <button
              onClick={() => { setEditedHtml(null); setManuallyExcluded(new Set()); setIsEditMode(false); }}
              title="Remettre l'aperçu à l'état initial"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-[#e74c3c]/40 text-[#e74c3c] hover:bg-[#e74c3c]/10 transition-all"
            >
              <RotateCcw className="w-3 h-3" />
              Réinitialiser
            </button>
          )}
          {isEditMode ? (
            <button
              onClick={() => {
                if (previewBodyRef.current) setEditedHtml(previewBodyRef.current.innerHTML);
                setIsEditMode(false);
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#238636]/60 bg-[#238636]/10 text-[#4ade80] transition-all"
            >
              <Eye className="w-3.5 h-3.5" />
              Valider
            </button>
          ) : (
            <button
              onClick={() => {
                if (previewBodyRef.current) setEditedHtml(previewBodyRef.current.innerHTML);
                setIsEditMode(true);
              }}
              disabled={rootIncluded.length === 0}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                isEditMode ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border-dark text-text-dim hover:border-accent/40 disabled:opacity-30'
              }`}
            >
              <Pencil className="w-3 h-3" />
              Éditer
            </button>
          )}
          <button
            onClick={() => setShowChecklist((v) => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
              showChecklist ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border-dark text-text-dim hover:border-accent/40'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" />
            Clauses
            <ChevronDown className={`w-3 h-3 transition-transform ${showChecklist ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Collapsible checklist */}
        {showChecklist && (
          <div className="h-52 flex-shrink-0 overflow-y-auto border-b border-border-dark bg-bg-card px-4 py-3">
            {sections.map((section) => {
              const sectionRoots = includedArticles.filter((a) => a.sectionId === section.id && !a.parentId);
              if (sectionRoots.length === 0) return null;
              return (
                <div key={section.id} className="mb-4">
                  <h4 className="text-[9px] font-bold text-accent uppercase tracking-widest mb-1.5 border-b border-border-dark pb-1">
                    {section.title}
                  </h4>
                  <ul className="space-y-1">
                    {sectionRoots.map((art) => {
                      const children = includedArticles.filter((a) => a.parentId === art.id);
                      return (
                        <li key={art.id}>
                          <div
                            className="flex gap-2 items-center py-1 px-2 rounded bg-bg-input border border-border-dark/60 cursor-pointer hover:border-accent/40 group"
                            onClick={() => {
                              const el = document.getElementById(`article-${art.id}`);
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                          >
                            <span className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center flex-shrink-0 ${
                              art.ruleType === 'ALWAYS_INCLUDE' ? 'bg-[#238636] text-white' : 'bg-accent/20 text-accent border border-accent/40'
                            }`}>
                              {art.ruleType === 'ALWAYS_INCLUDE' ? 'TC' : 'C'}
                            </span>
                            <span className="text-[11px] text-text-bright font-medium truncate flex-1">{stripNumber(art.title)}</span>
                            {art.ruleType !== 'ALWAYS_INCLUDE' && (
                              <button
                                title="Supprimer cette clause"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  setManuallyExcluded((prev: Set<string>) => new Set([...prev, art.id]));
                                  setEditedHtml(null);
                                }}
                                className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded hover:bg-[#e74c3c]/20 text-[#e74c3c] transition-all flex-shrink-0"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                          {children.length > 0 && (
                            <ul className="ml-5 mt-0.5 space-y-0.5">
                              {children.map((ch) => (
                                <li key={ch.id} className="flex items-center gap-1.5 py-0.5 px-2 cursor-pointer hover:bg-bg-input rounded"
                                  onClick={() => {
                                    const el = document.getElementById(`article-${ch.id}`);
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }}>
                                  <ChevronRight className="w-3 h-3 text-text-dim flex-shrink-0" />
                                  <span className="text-[10px] text-text-dim truncate">{stripNumber(ch.title)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {rootIncluded.length === 0 && (
              <div className="flex items-center justify-center h-full text-text-dim gap-2 text-sm">
                <AlertCircle className="w-4 h-4" /> Aucune clause qualifiée.
              </div>
            )}
          </div>
        )}

        {/* Contract preview — takes remaining height */}
        <div
          className="flex-1 bg-[#f5f5f0] overflow-y-auto"
          onClick={(e) => {
            if (isEditMode) return;
            const varName = (e.target as HTMLElement).dataset?.var;
            if (!varName) return;
            const group = categorizeVar(varName);
            const idx = stepIds.indexOf(group);
            if (idx !== -1) {
              goTo(idx);
              setTimeout(() => {
                const el = document.querySelector<HTMLElement>(`[data-field="${varName}"]`);
                if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
              }, 120);
            }
          }}
        >
          {rootIncluded.length > 0 ? (
            <div className={`max-w-[720px] mx-auto my-8 bg-white shadow-xl rounded-sm px-14 py-12 text-[#1A1A1A] font-serif text-[10px] leading-relaxed relative ${isEditMode ? 'ring-2 ring-accent/50' : ''}`}>
              {isEditMode && (
                <div className="absolute top-3 right-3 text-[9px] font-sans bg-accent text-black px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                  Mode édition
                </div>
              )}

              {/* Contract body — edit mode: contentEditable; saved edits: static HTML; normal: structured JSX */}
              {isEditMode ? (
                <div
                  ref={previewBodyRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="space-y-2 outline-none"
                  dangerouslySetInnerHTML={{ __html: editedHtml ?? '' }}
                />
              ) : editedHtml ? (
                <div
                  ref={previewBodyRef}
                  className="space-y-2"
                  dangerouslySetInnerHTML={{ __html: editedHtml }}
                />
              ) : (
              <div ref={previewBodyRef} className="space-y-2">
                {compiledResult.map((section: any, sIdx: number) => {
                  // ── Bloc de couverture (titre + parties) ───────────────
                  // ── Bloc signature ─────────────────────────────────────
                  if (section.type === 'signature') {
                    return (
                      <div key={sIdx} className="mt-14 pt-10 border-t-2 border-[#1a2a3a] font-sans">
                        <p className="text-[9px] text-center text-[#666] uppercase tracking-[3px] mb-8">
                          Fait en deux exemplaires originaux
                        </p>
                        <div className="grid grid-cols-2 gap-10">
                          {/* CLIENT */}
                          <div className="space-y-4">
                            <p className="text-[9px] font-bold text-[#1a2a3a] uppercase tracking-wider border-b border-[#ddd] pb-1">
                              Pour le CLIENT
                            </p>
                            <p className="text-[9px] font-semibold text-[#333]">{section.clientName}</p>
                            {/* Représentant 1 */}
                            <div>
                              <p className="text-[8px] text-[#888] uppercase tracking-wide mb-0.5">Représentant n°1</p>
                              <p className="text-[9px] text-[#222] font-medium">{section.representant1}</p>
                              {section.qualite1 && <p className="text-[8.5px] text-[#555] italic">{section.qualite1}</p>}
                              <div className="mt-4 border-b border-[#999] w-40" />
                              <div className="mt-1 text-[8px] text-[#aaa]">Signature &amp; Cachet</div>
                            </div>
                            {/* Représentant 2 */}
                            <div className="mt-3">
                              <p className="text-[8px] text-[#888] uppercase tracking-wide mb-0.5">Représentant n°2</p>
                              <p className="text-[9px] text-[#222] font-medium">{section.representant2}</p>
                              {section.qualite2 && <p className="text-[8.5px] text-[#555] italic">{section.qualite2}</p>}
                              <div className="mt-4 border-b border-[#999] w-40" />
                              <div className="mt-1 text-[8px] text-[#aaa]">Signature &amp; Cachet</div>
                            </div>
                          </div>
                          {/* PRESTATAIRE */}
                          <div className="space-y-4">
                            <p className="text-[9px] font-bold text-[#1a2a3a] uppercase tracking-wider border-b border-[#ddd] pb-1">
                              Pour le Prestataire
                            </p>
                            <p className="text-[9px] font-semibold text-[#333]">{section.prestataireName}</p>
                            <div>
                              <p className="text-[8px] text-[#888] uppercase tracking-wide mb-0.5">Représentant habilité</p>
                              <p className="text-[9px] text-[#222] font-medium">{section.representantPrestataire}</p>
                              {section.qualitePrestataire && <p className="text-[8.5px] text-[#555] italic">{section.qualitePrestataire}</p>}
                              <div className="mt-4 border-b border-[#999] w-40" />
                              <div className="mt-1 text-[8px] text-[#aaa]">Signature &amp; Cachet</div>
                            </div>
                            <div className="mt-6">
                              <p className="text-[8px] text-[#888] uppercase tracking-wide mb-1">Date &amp; Lieu de signature</p>
                              <div className="border-b border-[#999] w-48 mt-5" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // ── Bloc de couverture (titre + parties) ───────────────
                  if (section.type === 'header') {
                    return (
                      <div key={sIdx} className="text-center pb-8 mb-8 border-b-2 border-[#1a2a3a]">
                        <p className="text-[8px] font-sans text-[#aaa] uppercase tracking-[3px] mb-4">
                          Confidentiel — Usage Interne
                        </p>
                        <h1 className="text-[14px] font-bold font-sans text-[#1a2a3a] tracking-tight leading-tight mb-6 uppercase">
                          {section.contractTitle}
                        </h1>
                        <div className="mt-6 space-y-3 font-sans">
                          <p className="text-[11px] font-semibold text-[#1a2a3a]">{section.clientName}</p>
                          <p className="text-[9px] text-[#888] uppercase tracking-[4px] font-medium">ET</p>
                          <p className="text-[11px] font-semibold text-[#1a2a3a]">{section.prestataireName}</p>
                        </div>
                        <p className="text-[8px] font-sans text-[#bbb] mt-6">
                          Généré le {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                          {' · '}{rootIncluded.length} articles · {includedArticles.length} clauses
                        </p>
                      </div>
                    );
                  }

                  return (
                  <div key={sIdx}>
                    {section.title && !['DÉFINITIONS', 'LISTE DES ANNEXES'].includes(section.title) && (
                      <div className="mt-7 mb-3 pb-1.5 border-b-[1.5px] border-[#bdc3c7]">
                        <h2 className="font-sans font-bold text-[#1a2a3a] text-[11px] uppercase tracking-wider">
                          {section.title}
                        </h2>
                      </div>
                    )}
                    {['DÉFINITIONS', 'LISTE DES ANNEXES'].includes(section.title) && (
                      <div className="mt-5 mb-2">
                        <p className="font-sans font-bold text-[10px] text-[#555] uppercase tracking-wide">
                          {section.title}
                        </p>
                      </div>
                    )}
                    {section.articles.map((art: any, i: number) => {
                      const depth = art.depth ?? 0;
                      return (
                        <div key={i} id={art.id ? `article-${art.id}` : undefined} data-art-id={art.id} className={depth === 1 ? 'ml-5' : depth === 2 ? 'ml-10' : ''}>
                          {art.title && (
                            <p className={`font-sans font-bold mb-0.5 ${
                              depth === 0 ? 'text-[10.5px] text-[#2c3e50] mt-4' :
                              depth === 1 ? 'text-[10px] text-[#34495e] mt-3' :
                              'text-[9.5px] text-[#4a5568] italic mt-2'
                            }`}>
                              {art.title}
                            </p>
                          )}
                          <span
                            className="art-body whitespace-pre-wrap block text-[9.5px] leading-[1.55] text-[#333] text-justify"
                            dangerouslySetInnerHTML={{ __html: art.content }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  );
                })}
              </div>
              )}

              {/* Footer watermark */}
              <div className="absolute bottom-6 right-8 font-sans text-[8px] uppercase tracking-widest text-[#ccc] border border-[#e8e8e8] px-2 py-0.5">
                Draft — ISO 37001
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-text-dim gap-3">
              <FileText className="w-16 h-16 text-border-dark" strokeWidth={1} />
              <p className="text-sm font-medium">L'aperçu s'affiche ici</p>
              <p className="text-xs text-center max-w-[200px]">
                Sélectionnez les typologies de prestations à l'étape 1 pour voir les clauses générées.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
