const fs = require('fs');
const pdf = require('pdf-parse');

async function parse() {
    let dataBuffer = fs.readFileSync('C:\\Users\\Erorr\\Desktop\\products.pdf');
    const data = await pdf(dataBuffer);
    fs.writeFileSync('parsed_products.txt', data.text);
    console.log("PDF parsed successfully. Total characters:", data.text.length);
}

parse().catch(console.error);
