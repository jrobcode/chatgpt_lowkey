import dotenv from 'dotenv';
dotenv.config();
import express, { json } from 'express';
import multer from 'multer';
import { createReadStream, unlink } from 'fs';
import cors from 'cors';
import { OpenAI } from 'openai';

const app = express();
const port = process.env.PORT || 3000;

// Configure OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors());
app.use(json());

// Multer setup for receiving audio files
const upload = multer({ dest: 'uploads/' });

/**git init
git add {folder_name}
git commit -m "{commit_message}"
git branch -M main
git remote add origin {repository_url}
git push -u origin maingit init
git add {folder_name}
git commit -m "{commit_message}"
git branch -M main
git remote add origin {repository_url}
git push -u origin maingit init
git add {folder_name}
git commit -m "{commit_message}"
git branch -M main
git remote add origin {repository_url}
git push -u origin maingit init
git add {folder_name}
git commit -m "{commit_message}"
git branch -M main
git remote add origin {repository_url}
git push -u origin main
 * Route: /upload-audio
 * - Accepts audio chunks (webm, wav, etc.)
 * - Transcribes using Whisper
 * - Streams ChatGPT response
 */
app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  const filePath = req.file.path;

  try {
    // Transcribe using Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(filePath),
      model: 'whisper-1',
      response_format: 'text'
    });

    console.log('[Whisper Transcript]', transcription);

    // Respond immediately with a streaming link
    res.json({ success: true, transcript: transcription });

  } catch (err) {
    console.error('Error during transcription:', err);
    res.status(500).json({ error: 'Whisper transcription failed' });
  } finally {
    unlink(filePath, () => {}); // Clean up uploaded file
  }
});

/**
 * Route: /stream-chat?q=...
 * - Accepts ?q=some text
 * - Streams ChatGPT reply using Server-Sent Events (SSE)
 */
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

// Start server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
