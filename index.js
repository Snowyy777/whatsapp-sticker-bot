const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const client = new Client({
  authStrategy: new LocalAuth(), // salva sessão pra não precisar escanear toda vez
  puppeteer: {
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
}

// Mostra o QR Code no terminal
client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  console.log('📱 Escaneie o QR Code com seu WhatsApp!');
});

client.on('ready', () => {
  console.log('✅ Bot conectado e pronto!');
});

client.on('message', async (msg) => {
  // Verifica se é uma imagem
  if (msg.hasMedia && msg.type === 'image') {
    try {
      console.log(`📸 Imagem recebida de ${msg.from}`);

      // Baixa a mídia
      const media = await msg.downloadMedia();

      // Converte base64 → buffer
      const inputBuffer = Buffer.from(media.data, 'base64');

      // Converte pra WebP 512x512 (padrão de figurinha do WhatsApp)
      const webpBuffer = await sharp(inputBuffer)
        .resize(512, 512, {
          fit: 'contain',        // mantém proporção
          background: { r: 0, g: 0, b: 0, alpha: 0 } // fundo transparente
        })
        .webp()
        .toBuffer();

      // Cria o objeto de mídia no formato correto
      const stickerMedia = new MessageMedia(
        'image/webp',
        webpBuffer.toString('base64'),
        'sticker.webp'
      );

      // Envia como figurinha
      await msg.reply(stickerMedia, null, { sendMediaAsSticker: true });
      console.log('✅ Figurinha enviada!');

    } catch (err) {
      console.error('Erro ao converter figurinha:', err);
      await msg.reply('❌ Não consegui converter essa imagem. Tente outra!');
    }
  }
});

client.initialize();