const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { createReadStream, unlink } = require('fs');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json());

// Accept only .webm or .wav files
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    // keep original filename or generate unique if you want
    cb(null, file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['audio/webm', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type, only .webm and .wav allowed'));
  }
};

const upload = multer({ storage, fileFilter });

app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  const filePath = req.file.path;
  const language = req.body.language || 'en';

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(filePath),
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
    unlink(filePath, () => {});
  }
});

// GPT + TTS streaming remains unchanged

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});





