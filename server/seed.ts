/**
 * Seed PostgreSQL from the JSON source files.
 * Usage: npm run db:seed
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Articles ──────────────────────────────────────────────────────────
    const catalog = JSON.parse(readFileSync(resolve(root, 'contrat-global-complet.json'), 'utf8'));
    const rawArticles: any[] = catalog.catalogue_contrat_it.articles;

    await client.query('DELETE FROM sous_articles');
    await client.query('DELETE FROM articles');

    for (const a of rawArticles) {
      await client.query(
        `INSERT INTO articles (id, categorie, titre, contenu, condition_generation, variables, ordre_affichage)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET
           categorie            = EXCLUDED.categorie,
           titre                = EXCLUDED.titre,
           contenu              = EXCLUDED.contenu,
           condition_generation = EXCLUDED.condition_generation,
           variables            = EXCLUDED.variables,
           ordre_affichage      = EXCLUDED.ordre_affichage,
           updated_at           = NOW()`,
        [
          a.id,
          a.categorie,
          a.titre,
          a.contenu ?? null,
          a.condition_generation ?? 'TOUJOURS_INCLURE',
          JSON.stringify(a.variables ?? []),
          a.ordre_affichage ?? null,
        ]
      );

      // ── sous-articles ────────────────────────────────────────────────────
      for (let i = 0; i < (a.sous_articles ?? []).length; i++) {
        const sa = a.sous_articles[i];
        await client.query(
          `INSERT INTO sous_articles (id, parent_id, titre, contenu, condition_generation, variables, ordre)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (id) DO UPDATE SET
             titre                = EXCLUDED.titre,
             contenu              = EXCLUDED.contenu,
             condition_generation = EXCLUDED.condition_generation,
             variables            = EXCLUDED.variables,
             ordre                = EXCLUDED.ordre`,
          [
            sa.id ?? `${a.id}_SA${i}`,
            a.id,
            sa.titre,
            sa.contenu ?? null,
            sa.condition_generation ?? 'TOUJOURS_INCLURE',
            JSON.stringify(sa.variables ?? []),
            i,
          ]
        );
      }
    }

    // ── 2. Definitions ───────────────────────────────────────────────────────
    const defFile = JSON.parse(readFileSync(resolve(root, 'definitions-dictionary.json'), 'utf8'));
    const defs: any[] = defFile.dictionnaire_definitions.definitions;

    await client.query('DELETE FROM definitions');

    for (const d of defs) {
      await client.query(
        `INSERT INTO definitions (id, terme, aliases, categorie, definition, source)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET
           terme      = EXCLUDED.terme,
           aliases    = EXCLUDED.aliases,
           categorie  = EXCLUDED.categorie,
           definition = EXCLUDED.definition,
           source     = EXCLUDED.source`,
        [
          d.id,
          d.terme,
          JSON.stringify(d.aliases ?? []),
          d.categorie ?? null,
          d.definition,
          d.source ?? null,
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`✓ ${rawArticles.length} articles seedés`);
    console.log(`✓ ${rawArticles.reduce((n, a) => n + (a.sous_articles?.length ?? 0), 0)} sous-articles seedés`);
    console.log(`✓ ${defs.length} définitions seedées`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
