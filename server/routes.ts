import { Router, Request, Response } from 'express';
import { pool } from './db.js';

export const router = Router();

// ── GET /api/articles ────────────────────────────────────────────────────────
// Retourne tous les articles avec leurs sous-articles, dans l'ordre de section + ordre_affichage
router.get('/articles', async (_req: Request, res: Response) => {
  try {
    const { rows: articles } = await pool.query<{
      id: string; categorie: string; titre: string; contenu: string | null;
      condition_generation: string; variables: any; ordre_affichage: number | null;
    }>(
      `SELECT id, categorie, titre, contenu, condition_generation, variables, ordre_affichage
       FROM articles
       ORDER BY ordre_affichage ASC NULLS LAST, id ASC`
    );

    const { rows: sousArticles } = await pool.query<{
      id: string; parent_id: string; titre: string; contenu: string | null;
      condition_generation: string; variables: any; ordre: number;
    }>(
      `SELECT id, parent_id, titre, contenu, condition_generation, variables, ordre
       FROM sous_articles
       ORDER BY parent_id, ordre ASC`
    );

    // Grouper sous-articles par parent
    const saByParent = new Map<string, any[]>();
    for (const sa of sousArticles) {
      if (!saByParent.has(sa.parent_id)) saByParent.set(sa.parent_id, []);
      saByParent.get(sa.parent_id)!.push({
        id: sa.id,
        titre: sa.titre,
        contenu: sa.contenu,
        condition_generation: sa.condition_generation,
        variables: sa.variables,
      });
    }

    const result = articles.map((a) => ({
      id: a.id,
      categorie: a.categorie,
      titre: a.titre,
      contenu: a.contenu,
      condition_generation: a.condition_generation,
      variables: a.variables,
      ordre_affichage: a.ordre_affichage,
      sous_articles: saByParent.get(a.id) ?? [],
    }));

    // Reconstruire dans l'ordre des sections (tel qu'attendu par le frontend)
    const SECTION_ORDER: Record<string, number> = {
      'I. IDENTIFICATION DES PARTIES': 0,
      'I. DEFINITIONS': 1,
      'II. OBJET ET DURÉE DU CONTRAT': 2,
      'II. STIPULATIONS SPÉCIFIQUES AUX PRESTATIONS': 3,
      'V. STIPULATIONS COMMUNES': 4,
      'VI. ANNEXES': 5,
    };
    result.sort((a, b) => {
      const pa = SECTION_ORDER[a.categorie] ?? 99;
      const pb = SECTION_ORDER[b.categorie] ?? 99;
      if (pa !== pb) return pa - pb;
      return (a.ordre_affichage ?? 9999) - (b.ordre_affichage ?? 9999);
    });

    res.json({ catalogue_contrat_it: { articles: result } });
  } catch (err) {
    console.error('GET /api/articles error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── GET /api/definitions ─────────────────────────────────────────────────────
router.get('/definitions', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, terme, aliases, categorie, definition, source
       FROM definitions
       ORDER BY terme ASC`
    );
    res.json({
      dictionnaire_definitions: {
        version: '1.0',
        definitions: rows,
      },
    });
  } catch (err) {
    console.error('GET /api/definitions error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── PUT /api/articles/:id ────────────────────────────────────────────────────
// Permet de modifier un article depuis l'interface Admin
router.put('/articles/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { titre, contenu, condition_generation, variables, ordre_affichage } = req.body;
  try {
    const { rowCount } = await pool.query(
      `UPDATE articles SET
         titre                = COALESCE($1, titre),
         contenu              = COALESCE($2, contenu),
         condition_generation = COALESCE($3, condition_generation),
         variables            = COALESCE($4, variables),
         ordre_affichage      = COALESCE($5, ordre_affichage),
         updated_at           = NOW()
       WHERE id = $6`,
      [titre, contenu, condition_generation, variables ? JSON.stringify(variables) : null, ordre_affichage, id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Article not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/articles/:id error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── GET /api/health ──────────────────────────────────────────────────────────
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT NOW() as ts');
    res.json({ ok: true, db: rows[0].ts });
  } catch {
    res.status(503).json({ ok: false });
  }
});
