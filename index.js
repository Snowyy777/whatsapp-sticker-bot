const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const express = require('express');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

const app = express();
let qrImageUrl = null;

app.get('/', (req, res) => {
  if (qrImageUrl) {
    res.send(`<html><body style="background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;"><h2 style="color:white;font-family:sans-serif">Escaneie com o WhatsApp</h2><img src="${qrImageUrl}" style="width:300px;height:300px"/></body></html>`);
  } else {
    res.send(`<html><body style="background:#111;display:flex;align-items:center;justify-content:center;height:100vh;"><h2 style="color:white;font-family:sans-serif">✅ Bot conectado!</h2></body></html>`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', async (qr) => {
  qrImageUrl = await QRCode.toDataURL(qr);
  console.log('✅ QR Code gerado!');
});

client.on('ready', () => {
  qrImageUrl = null;
  console.log('✅ Bot conectado e pronto!');
});

client.on('message_create', async (msg) => {
  if (!msg.fromMe) return;

  // Foto → Figurinha
  if (msg.hasMedia && msg.type === 'image') {
    try {
      const media = await msg.downloadMedia();
      const inputBuffer = Buffer.from(media.data, 'base64');

      const webpBuffer = await sharp(inputBuffer)
        .resize(512, 512, {
          fit: 'cover',
          position: 'centre'
        })
        .webp()
        .toBuffer();

      const stickerMedia = new MessageMedia(
        'image/webp',
        webpBuffer.toString('base64'),
        'sticker.webp'
      );

      await msg.reply(stickerMedia, null, { sendMediaAsSticker: true });
      console.log('✅ Figurinha enviada!');
    } catch (err) {
      console.error('Erro figurinha:', err);
    }
  }

  // Vídeo → Figurinha animada
  if (msg.hasMedia && msg.type === 'video') {
    try {
      const media = await msg.downloadMedia();
      const inputPath = `/tmp/video_${Date.now()}.mp4`;
      const outputPath = `/tmp/sticker_${Date.now()}.webp`;

      fs.writeFileSync(inputPath, Buffer.from(media.data, 'base64'));

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            '-vf', 'fps=10,scale=512:512:force_original_aspect_ratio=increase,crop=512:512',
            '-loop', '0',
            '-preset', 'default',
            '-an',
            '-vsync', '0'
          ])
          .toFormat('webp')
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      const webpData = fs.readFileSync(outputPath).toString('base64');
      const stickerMedia = new MessageMedia('image/webp', webpData, 'sticker.webp');

      await msg.reply(stickerMedia, null, { sendMediaAsSticker: true });
      console.log('✅ Figurinha animada enviada!');

      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch (err) {
      console.error('Erro figurinha animada:', err);
    }
  }
});

client.initialize();