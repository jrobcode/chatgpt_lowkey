const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const app = express();
const upload = multer({ dest: 'uploads/' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/upload-audio', upload.single('file'), async (req, res) => {
  const inputPath = req.file.path;
  const outputPath = inputPath + '.mp3';

  // Convert WAV to MP3
  ffmpeg(inputPath)
    .toFormat('mp3')
    .audioCodec('libmp3lame')
    .on('end', async () => {
      try {
        // Send to OpenAI Whisper
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(outputPath),
          model: 'whisper-1',
        });

        // Cleanup temp files
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

        res.json({ text: transcription.text });
      } catch (err) {
        console.error('Transcription error:', err);
        res.status(500).json({ error: 'Transcription failed.' });
      }
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err);
      fs.unlinkSync(inputPath);
      res.status(500).json({ error: 'Audio conversion failed.' });
    })
    .save(outputPath);
});

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});






