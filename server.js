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

const upload = multer({ dest: 'uploads/' });

// 🔹 POST /upload-audio — Transcribe speech to text
app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  const filePath = req.file.path;
  const language = req.body.language || 'en'; // default to English if not provided

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(filePath),
      model: 'whisper-1',
      response_format: 'text',
      language: language // <-- dynamic language
    });

    console.log('[Whisper Transcript]', transcription);

    res.json({ success: true, transcript: transcription });
  } catch (err) {
    console.error('❌ Error during transcription:', err);
    res.status(500).json({ error: 'Whisper transcription failed' });
  } finally {
    unlink(filePath, () => {}); // clean up temp file
  }
});

// 🔹 GET /stream-chat?q=Your transcript — Get GPT + TTS
app.get('/stream-chat', async (req, res) => {
  const prompt = req.query.q;
  if (!prompt) return res.status(400).send('Missing query');

  try {
    const gptStream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      stream: true
    });

    let finalText = '';

    for await (const chunk of gptStream) {
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) finalText += text;
    }

    const ttsResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova', // shimmer, echo, alloy, etc.
      input: finalText
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'inline; filename="response.mp3"');

    ttsResponse.body.pipe(res); // stream audio to client
  } catch (err) {
    console.error('❌ Error in GPT or TTS:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});





