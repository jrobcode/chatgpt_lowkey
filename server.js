const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');

const app = express();
app.use(cors());

const upload = multer({ dest: 'uploads/' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/chat-audio', upload.single('audio'), async (req, res) => {
  const inputPath = req.file.path;
  const mp3Path = inputPath + '.mp3';

  try {
    // Convert to mp3
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .on('end', resolve)
        .on('error', reject)
        .save(mp3Path);
    });

    // Transcribe
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(mp3Path),
      model: 'whisper-1',
    });

    console.log('Transcription:', transcription.text);

    // Send transcription to GPT
    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Respond in a friendly, concise voice.' },
        { role: 'user', content: transcription.text },
      ],
    });

    const gptResponse = chatCompletion.choices[0].message.content;
    console.log('GPT response:', gptResponse);

    // Convert GPT response to audio (TTS)
    const speechResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: gptResponse,
      response_format: 'mp3',
    });

    const audioBuffer = Buffer.from(await speechResponse.arrayBuffer());

    // Set headers and send audio
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
    });
    res.send(audioBuffer);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    // Clean up temp files
    fs.unlinkSync(inputPath);
    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
  }
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(3000, () => console.log('Server running on port 3000'));







