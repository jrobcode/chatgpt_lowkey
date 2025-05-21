const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { createReadStream, unlink } = require('fs');
const { OpenAI } = require('openai');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  const originalPath = req.file.path;
  const convertedPath = `${originalPath}.wav`;
  const language = req.body.language || 'en';

  try {
    // Convert to WAV using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(originalPath)
        .toFormat('wav')
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('end', resolve)
        .on('error', reject)
        .save(convertedPath);
    });

    // Send converted file to Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(convertedPath),
      model: 'whisper-1',
      response_format: 'text',
      language
    });

    console.log('[Whisper Transcript]', transcription);

    res.json({ success: true, transcript: transcription });
  } catch (err) {
    console.error('Error during transcription:', err);
    res.status(500).json({ error: 'Whisper transcription failed' });
  } finally {
    // Cleanup temp files
    unlink(originalPath, () => {});
    unlink(convertedPath, () => {});
  }
});



