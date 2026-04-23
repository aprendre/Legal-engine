const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('./Modèle Contrat Informatique Global L-MEO-M _ V CJG DEC 2025.pdf');

pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('pdf_text.txt', data.text);
    console.log('Text extracted. Length:', data.text.length);
}).catch(function(error) {
    console.error('Error parsing PDF:', error);
});
