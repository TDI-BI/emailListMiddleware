const puppeteer = require('puppeteer');

/**
 * Generate a PDF buffer from an HTML string
 *
 * @param {string} htmlStr
 * @returns {Promise<Buffer>}
 */
const mkPdfBuffer = async htmlStr => {
  if (!htmlStr) {
    throw new Error('mkPdfBuffer: htmlStr is required');
  }

  const browser = await puppeteer.launch({
    headless: 'new', // Puppeteer v20+ / Node 20+
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  await page.setContent(htmlStr, {
    waitUntil: 'networkidle0',
  });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
  });

  await browser.close();

  // Normalize return type to Buffer
  if (Buffer.isBuffer(pdfBuffer)) {
    return pdfBuffer;
  } else if (pdfBuffer instanceof Uint8Array) {
    return Buffer.from(pdfBuffer);
  } else {
    throw new Error('Unexpected buffer type received from mkPdfBuffer');
  }
};

module.exports = {
  mkPdfBuffer,
};
