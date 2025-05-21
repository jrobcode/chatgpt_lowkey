const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { createReadStream, unlink, renameSync } = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Make sure uploads folder exists
const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: 'uploads/' });

app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  if (!req.file || !req.file.mimetype.startsWith('audio/')) {
    return res.status(400).json({ error: 'Invalid or missing audio file' });
  }

  const language = req.body.language || 'en';
  const uniqueID = uuidv4();

  // Rename to ensure unique name
  const originalPath = path.join(uploadDir, `${uniqueID}-${req.file.originalname}`);
  renameSync(req.file.path, originalPath);
  const convertedPath = `${originalPath}.wav`;

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(originalPath)
        .toFormat('wav')
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('start', (cmd) => {
          console.log('[FFmpeg]', cmd);
        })
        .on('end', () => {
          console.log('[FFmpeg] Conversion completed');
          resolve();
        })
        .on('error', (err) => {
          console.error('[FFmpeg Error]', err);
          reject(err);
        })
        .save(convertedPath);
    });

    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(convertedPath),
      model: 'whisper-1',
      response_format: 'text',
      language
    });

    console.log('[Whisper Transcript]', transcription);
    res.json({ success: true, transcript: transcription });
  } catch (err) {
    console.error('❌ Error during transcription:', err);
    res.status(500).json({ error: 'Whisper transcription failed' });
  } finally {
    unlink(originalPath, () => {});
    unlink(convertedPath, () => {});
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});





