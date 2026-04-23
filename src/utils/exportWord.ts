import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { dummyTemplateBase64 } from './dummyTemplate';

function base64ToBinaryString(base64: string) {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Map a depth value to an HTML heading tag.
 * depth 0 → h2 (article racine)
 * depth 1 → h3 (sous-article)
 * depth 2 → h4 (sous-sous-article)
 */
function headingTag(depth: number): string {
  if (depth <= 0) return 'h2';
  if (depth === 1) return 'h3';
  return 'h4';
}

/**
 * Left indent (pt) based on depth.
 */
function indentPt(depth: number): number {
  if (depth <= 0) return 0;
  if (depth === 1) return 24;
  return 48;
}

export function generateDocx(data: any, customTemplateDataUrl?: string) {
  try {
    if (customTemplateDataUrl) {
      // ── Custom .docx template path ──────────────────────────────────────
      const base64 = customTemplateDataUrl.split(',')[1];
      const zip = new PizZip(base64ToBinaryString(base64));
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      doc.render({ ...data, CONTRAT_BODY: data.CONTRAT_BODY });
      saveAs(
        doc.getZip().generate({
          type: 'blob',
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
        'Contrat_Bancaire_IT.docx'
      );
    } else {
      // ── Fallback: HTML → .doc (Word-compatible) ─────────────────────────

      const sectionStyles = `
        @page WordSection1 { margin: 2.5cm 2.5cm 2.5cm 2.5cm; mso-paper-source: 0; }
        div.WordSection1 { page: WordSection1; }

        /* Contract title */
        p.ContractTitle {
          font-family: Arial, sans-serif; font-size: 16pt; font-weight: bold;
          text-align: center; margin-bottom: 6pt; color: #1a1a1a;
        }
        p.ContractSubtitle {
          font-family: Arial, sans-serif; font-size: 10pt; text-align: center;
          color: #666; margin-bottom: 36pt; page-break-after: always;
        }

        /* Section headings (categories) */
        h1 {
          font-family: Arial, sans-serif; font-size: 13pt; color: #1a2a3a;
          margin-top: 20pt; margin-bottom: 8pt;
          padding-bottom: 3px; border-bottom: 1.5px solid #bdc3c7;
          text-transform: uppercase; page-break-inside: avoid;
        }

        /* Article racine (depth 0) */
        h2 {
          font-family: Arial, sans-serif; font-size: 11pt; color: #2c3e50;
          margin-top: 14pt; margin-bottom: 4pt; font-weight: bold;
          page-break-inside: avoid;
        }

        /* Sous-article (depth 1) */
        h3 {
          font-family: Arial, sans-serif; font-size: 10.5pt; color: #34495e;
          margin-top: 10pt; margin-bottom: 3pt; font-weight: bold;
          margin-left: 18pt; page-break-inside: avoid;
        }

        /* Sous-sous-article (depth 2) */
        h4 {
          font-family: Arial, sans-serif; font-size: 10pt; color: #4a5568;
          margin-top: 8pt; margin-bottom: 2pt; font-style: italic; font-weight: bold;
          margin-left: 36pt; page-break-inside: avoid;
        }

        /* Body text */
        p {
          font-family: Arial, sans-serif; font-size: 10pt;
          margin-bottom: 6pt; line-height: 145%; text-align: justify;
        }
        p.indent1 { margin-left: 18pt; }
        p.indent2 { margin-left: 36pt; }

        /* Pseudo-section label (DÉFINITIONS, ANNEXES…) */
        p.pseudo-section {
          font-weight: bold; font-family: Arial, sans-serif; font-size: 11pt;
          margin-top: 16pt; margin-bottom: 6pt; color: #444; text-transform: uppercase;
        }
      `;

      const bodyHtml = data.STRUCTURE
        ? (data.STRUCTURE as any[])
            .map((section: any) => {
              // Signature block — toujours en dernier
              if (section.type === 'signature') {
                const sigCell = (name: string, role: string, quality: string) => `
  <td style="width:50%;padding:0 20pt;vertical-align:top;">
    <p style="font-family:Arial,sans-serif;font-size:9pt;font-weight:bold;color:#1a2a3a;border-bottom:1px solid #ccc;padding-bottom:4pt;text-transform:uppercase;">${role}</p>
    <p style="font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;color:#333;margin-top:6pt;">${name}</p>
    ${quality ? `<p style="font-family:Arial,sans-serif;font-size:9pt;color:#555;font-style:italic;">${quality}</p>` : ''}
    <p style="font-family:Arial,sans-serif;font-size:8pt;color:#999;margin-top:30pt;border-top:1px solid #999;padding-top:2pt;">Signature &amp; Cachet</p>
  </td>`;
                return `
<div style="margin-top:60pt;padding-top:20pt;border-top:2px solid #1a2a3a;page-break-before:always;">
  <p style="font-family:Arial,sans-serif;font-size:9pt;text-align:center;color:#666;letter-spacing:3pt;text-transform:uppercase;margin-bottom:30pt;">Fait en deux exemplaires originaux</p>
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      ${sigCell(section.clientName || '', 'Pour le CLIENT', '')}
      ${sigCell(section.prestataireName || '', 'Pour le Prestataire', '')}
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;margin-top:24pt;">
    <tr>
      <td style="width:50%;padding:0 20pt;vertical-align:top;">
        <p style="font-family:Arial,sans-serif;font-size:8pt;color:#888;text-transform:uppercase;">Représentant n°1</p>
        <p style="font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;color:#222;">${section.representant1 || ''}</p>
        ${section.qualite1 ? `<p style="font-family:Arial,sans-serif;font-size:9pt;color:#555;font-style:italic;">${section.qualite1}</p>` : ''}
        <p style="font-family:Arial,sans-serif;font-size:8pt;color:#999;margin-top:30pt;border-top:1px solid #999;padding-top:2pt;">Signature &amp; Cachet</p>
        <div style="margin-top:20pt;">
        <p style="font-family:Arial,sans-serif;font-size:8pt;color:#888;text-transform:uppercase;">Représentant n°2</p>
        <p style="font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;color:#222;">${section.representant2 || ''}</p>
        ${section.qualite2 ? `<p style="font-family:Arial,sans-serif;font-size:9pt;color:#555;font-style:italic;">${section.qualite2}</p>` : ''}
        <p style="font-family:Arial,sans-serif;font-size:8pt;color:#999;margin-top:30pt;border-top:1px solid #999;padding-top:2pt;">Signature &amp; Cachet</p>
        </div>
      </td>
      <td style="width:50%;padding:0 20pt;vertical-align:top;">
        <p style="font-family:Arial,sans-serif;font-size:8pt;color:#888;text-transform:uppercase;">Représentant habilité</p>
        <p style="font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;color:#222;">${section.representantPrestataire || ''}</p>
        ${section.qualitePrestataire ? `<p style="font-family:Arial,sans-serif;font-size:9pt;color:#555;font-style:italic;">${section.qualitePrestataire}</p>` : ''}
        <p style="font-family:Arial,sans-serif;font-size:8pt;color:#999;margin-top:30pt;border-top:1px solid #999;padding-top:2pt;">Signature &amp; Cachet</p>
        <div style="margin-top:30pt;">
          <p style="font-family:Arial,sans-serif;font-size:8pt;color:#888;text-transform:uppercase;">Date &amp; Lieu de signature</p>
          <p style="font-family:Arial,sans-serif;font-size:8pt;color:#bbb;border-bottom:1px solid #999;width:180pt;margin-top:20pt;">&nbsp;</p>
        </div>
      </td>
    </tr>
  </table>
</div>\n`;
              }

              // Dynamic header block with contract title + parties
              if (section.type === 'header') {
                return `<div style="text-align:center;margin-bottom:40pt;padding-bottom:20pt;border-bottom:2px solid #1a2a3a;page-break-after:avoid;">
  <p class="ContractTitle">${section.contractTitle || 'CONTRAT DE PRESTATIONS IT'}</p>
  <br/>
  <p style="font-family:Arial,sans-serif;font-size:11pt;font-weight:bold;color:#1a2a3a;">${section.clientName || ''}</p>
  <p style="font-family:Arial,sans-serif;font-size:9pt;color:#888;letter-spacing:4pt;text-transform:uppercase;">ET</p>
  <p style="font-family:Arial,sans-serif;font-size:11pt;font-weight:bold;color:#1a2a3a;">${section.prestataireName || ''}</p>
</div>\n`;
              }

              const isHeader = [
                '0. EN-TÊTE ET SIGNATAIRES',
                'DÉFINITIONS',
                'LISTE DES ANNEXES',
              ].includes(section.title);

              let html = '';

              if (section.title) {
                html += isHeader
                  ? `<p class="pseudo-section">${section.title}</p>\n`
                  : `<h1>${section.title}</h1>\n`;
              }

              (section.articles as any[]).forEach((art: any) => {
                const depth: number = art.depth ?? 0;
                const hTag = headingTag(depth);
                const indentClass =
                  depth === 1 ? ' class="indent1"' : depth >= 2 ? ' class="indent2"' : '';

                // Article heading
                if (art.title) {
                  html += `<${hTag}>${art.title}</${hTag}>\n`;
                }

                // Article body — split on newlines to create separate <p> tags
                const paragraphs = (art.content || '')
                  .split(/\n{2,}/)  // split on blank lines
                  .map((p: string) => p.replace(/\n/g, '<br/>').trim())
                  .filter((p: string) => p.length > 0);

                if (paragraphs.length === 0) {
                  // Single-line or empty content
                  const inline = (art.content || '').replace(/\n/g, '<br/>');
                  if (inline) html += `<p${indentClass}>${inline}</p>\n`;
                } else {
                  paragraphs.forEach((p: string) => {
                    html += `<p${indentClass}>${p}</p>\n`;
                  });
                }
              });

              return html;
            })
            .join('')
        : `<p>${(data.CONTRAT_BODY || '').replace(/\n/g, '<br/>')}</p>`;

      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:w="urn:schemas-microsoft-com:office:word"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <title>Contrat IT</title>
          <style>${sectionStyles}</style>
        </head>
        <body>
          <div class="WordSection1">
            ${bodyHtml}
          </div>
        </body>
        </html>
      `;

      saveAs(
        new Blob(['\ufeff', htmlContent], {
          type: 'application/msword;charset=utf-8',
        }),
        'Contrat_Bancaire_IT.doc'
      );
    }
  } catch (error: any) {
    console.error('Erreur génération Word:', error);
  }
}
