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

app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  const filePath = req.file.path;

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(filePath),
      model: 'whisper-1',
      response_format: 'text'
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

app.get('/stream-chat', async (req, res) => {
  const prompt = req.query.q;
  if (!prompt) return res.status(400).send('Missing query');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      stream: true
    });

    for await (const chunk of stream) {
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) {
        res.write(`data: ${text}\n\n`);
      }
    }

    res.write('event: end\ndata: done\n\n');
    res.end();
  } catch (err) {
    console.error('Error in GPT stream:', err);
    res.write(`event: error\ndata: ${err.message}\n\n`);
    res.end();
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});

