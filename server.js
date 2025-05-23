require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { OpenAI } = require('openai');
const axios = require('axios');

const app = express();
const upload = multer({ dest: 'uploads/' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/chat-audio', upload.single('audio'), async (req, res) => {
 const filePath = req.file.path;

 try {
   // Transcribe the MP3 with Whisper
   const transcription = await openai.audio.transcriptions.create({
     file: fs.createReadStream(filePath),
     model: 'whisper-1',
   });

   const userMessage = transcription.text;
   console.log('Transcription:', userMessage);

   // Send to ChatGPT and stream the response
   const chatStream = await openai.chat.completions.create({
     model: 'gpt-4',
     messages: [{ role: 'user', content: userMessage }],
     stream: true,
   });

   res.set({
     'Content-Type': 'audio/mpeg',
     'Transfer-Encoding': 'chunked',
   });

   for await (const chunk of chatStream) {
     const content = chunk.choices?.[0]?.delta?.content;
     if (!content) continue;

     // Send each content chunk to ElevenLabs and stream back audio
     const audioStream = await axios({
       method: 'POST',
       url: `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}/stream`,
       headers: {
         'xi-api-key': process.env.ELEVENLABS_API_KEY,
         'Content-Type': 'application/json',
       },
       data: {
         text: content,
         model_id: 'eleven_monolingual_v1',
         voice_settings: {
           stability: 0.5,
           similarity_boost: 0.75,
         },
       },
       responseType: 'stream',
     });

     await new Promise((resolve, reject) => {
       audioStream.data.pipe(res, { end: false });
       audioStream.data.on('end', resolve);
       audioStream.data.on('error', reject);
     });
   }

   res.end();
 } catch (error) {
   console.error(error);
   res.status(500).send('Error processing request');
 } finally {
   fs.unlinkSync(filePath); // clean up uploaded file
 }
});

app.listen(3000, () => {
 console.log('Server listening on port 3000');
});







