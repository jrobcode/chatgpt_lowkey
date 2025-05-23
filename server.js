const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());

const upload = multer({ dest: 'uploads/' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = '9BWtsMINqrJLrRacOk9x'; // Change this to your preferred voice ID

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

    // Transcribe with Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(mp3Path),
      model: 'whisper-1',
    });

    console.log('Transcription:', transcription.text);

    // Get GPT response
    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Respond in a friendly, helpful voice.' },
        { role: 'user', content: transcription.text },
      ],
    });

    const gptResponse = chatCompletion.choices[0].message.content;
    console.log('GPT response:', gptResponse);

    // Generate speech with ElevenLabs
    const ttsResponse = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
      data: {
        text: gptResponse,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      },
    });

    // Send audio
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': ttsResponse.data.length,
    });
    res.send(ttsResponse.data);
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  } finally {
    // Clean up temp files
    fs.unlinkSync(inputPath);
    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
  }
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(3000, () => console.log('Server running on port 3000'));








