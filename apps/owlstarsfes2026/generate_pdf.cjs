const path = require('path');
const puppeteer = require('../setting-sheet/node_modules/puppeteer');

async function generatePDF() {
  console.log('🚀 Puppeteerを起動しています...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

    const flyerUrl = 'http://localhost:3333/apps/owlstarsfes2026/flyer_mockup.html';
    console.log(`📄 ページを読み込んでいます: ${flyerUrl}`);
    await page.goto(flyerUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // フォントと画像の完全なレンダリングを待機
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await new Promise(resolve => setTimeout(resolve, 1500));

    const outputPath = path.resolve(__dirname, 'assets/owlstarsfes2026_flyer.pdf');
    console.log(`🖨️ PDFを生成しています: ${outputPath}`);

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }
    });

    console.log('🎉 最新版PDFの生成が完了しました！');
  } catch (error) {
    console.error('❌ PDF生成エラー:', error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

generatePDF();
