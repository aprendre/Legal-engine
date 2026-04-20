import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { dummyTemplateBase64 } from './dummyTemplate';

function base64ToBinaryString(base64: string) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function generateDocx(data: any, customTemplateDataUrl?: string) {
  try {
    if (customTemplateDataUrl) {
      // Use the provided docx template
      const base64 = customTemplateDataUrl.split(',')[1];
      const zip = new PizZip(base64ToBinaryString(base64));
      
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      doc.render({ ...data, CONTRAT_BODY: data.CONTRAT_BODY });

      const out = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      saveAs(out, 'Contrat_Bancaire_IT.docx');
    } else {
      // Fallback: Generate a simple .doc file using HTML markup so Word opens it correctly
      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <title>Contrat Cadre</title>
          <style>
            @page WordSection1 { margin: 2.5cm 2.5cm 2.5cm 2.5cm; mso-paper-source:0; }
            div.WordSection1 { page: WordSection1; }
            p.Title { font-family: 'Arial', sans-serif; font-size: 24pt; font-weight: bold; text-align: center; margin-bottom: 24pt; color: #1a1a1a; }
            p.Subtitle { font-family: 'Arial', sans-serif; font-size: 14pt; text-align: center; margin-bottom: 48pt; color: #666666; page-break-after: always; }
            h1 { font-family: 'Arial', sans-serif; font-size: 16pt; color: #2c3e50; margin-top: 24pt; margin-bottom: 12pt; padding-bottom: 4px; border-bottom: 1px solid #bdc3c7; text-transform: uppercase; page-break-inside: avoid; }
            h2 { font-family: 'Arial', sans-serif; font-size: 13pt; color: #34495e; margin-top: 18pt; margin-bottom: 6pt; font-weight: bold; page-break-inside: avoid; }
            p { font-family: 'Arial', sans-serif; font-size: 11pt; margin-bottom: 10pt; line-height: 150%; text-align: justify; }
            .pseudo-section { font-weight: bold; font-family: 'Arial', sans-serif; font-size: 12pt; margin-top: 20pt; margin-bottom: 10pt; color: #444; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="WordSection1">
            <p class="Title">CONTRAT CADRE DE PRESTATIONS IT</p>
            <p class="Subtitle">Modèle Standard - Automatisé</p>
            
            ${data.STRUCTURE ? data.STRUCTURE.map((section: any) => {
               const isHeader = ['0. EN-TÊTE ET SIGNATAIRES', 'DÉFINITIONS', 'LISTE DES ANNEXES'].includes(section.title);
               let secHtml = '';
               
               if (section.title) {
                  if (isHeader) {
                     secHtml += `<p class="pseudo-section">${section.title}</p>`;
                  } else {
                     secHtml += `<h1>${section.title}</h1>`;
                  }
               }

               section.articles.forEach((art: any) => {
                  if (art.title) {
                     secHtml += `<h2>${art.title}</h2>`;
                  }
                  const contentFormatted = (art.content || '').replace(/\n/g, '<br/>');
                  secHtml += `<p>${contentFormatted}</p>`;
               });

               return secHtml;
            }).join('') : `<p>${(data.CONTRAT_BODY || '').replace(/\n/g, '<br/>')}</p>`}
          </div>
        </body>
        </html>
      `;

      const blob = new Blob(['\\ufeff', htmlContent], {
        type: 'application/msword;charset=utf-8'
      });
      saveAs(blob, 'Contrat_Bancaire_IT.doc');
    }
  } catch (error: any) {
    console.error('Erreur génération Docx', error);
    // Use standard notification or console, avoid alert which is blocked in iframes
  }
}

