const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { OpenAI } = require('openai');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const s3 = new S3Client({});
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function downloadTikTokVideo(url) {
  console.log('Starting video download for URL:', url);
  const options = {
    method: 'GET',
    url: 'https://tiktok-api23.p.rapidapi.com/api/download/video',
    params: { url: url },
    headers: {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'x-rapidapi-host': 'tiktok-api23.p.rapidapi.com'
    }
  };

  console.log('Calling RapidAPI...');
  const response = await axios(options);
  console.log('RapidAPI response:', JSON.stringify(response.data, null, 2));
  
  if (!response.data?.play) {
    console.error('No play URL in response:', response.data);
    throw new Error('No video URL found in API response');
  }

  console.log('Got video URL:', response.data.play);
  const videoResponse = await axios({
    method: 'GET',
    url: response.data.play,
    responseType: 'stream'
  });

  const tempPath = path.join('/tmp', `video-${Date.now()}.mp4`);
  console.log('Saving video to:', tempPath);
  const writer = fs.createWriteStream(tempPath);
  
  videoResponse.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      console.log('Video download completed');
      resolve(tempPath);
    });
    writer.on('error', (error) => {
      console.error('Error writing video file:', error);
      reject(error);
    });
  });
}

async function convertToMp3(videoPath) {
  console.log('Starting MP3 conversion for:', videoPath);
  const outputPath = videoPath.replace('.mp4', '.mp3');
  
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .toFormat('mp3')
      .on('start', (commandLine) => {
        console.log('FFmpeg conversion started:', commandLine);
      })
      .on('progress', (progress) => {
        console.log('FFmpeg progress:', progress);
      })
      .on('end', () => {
        console.log('FFmpeg conversion completed');
        resolve(outputPath);
      })
      .on('error', (error) => {
        console.error('FFmpeg conversion error:', error);
        reject(error);
      })
      .save(outputPath);
  });
}

async function getTranscript(audioPath) {
  console.log('Starting transcription for:', audioPath);
  const audioFile = await fs.promises.readFile(audioPath);
  console.log('Audio file size:', audioFile.length, 'bytes');
  
  const formData = new FormData();
  formData.append('file', new Blob([audioFile]), 'audio.mp3');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  
  console.log('Calling OpenAI Whisper API...');
  const transcript = await openai.audio.transcriptions.create({
    file: formData.get('file'),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"]
  });

  console.log('Got transcript:', JSON.stringify(transcript, null, 2));
  return transcript;
}

const generateSummary = async (transcript) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are a concise content summarizer. Structure your summaries exactly as follows:
        1. One short paragraph (2-3 sentences) highlighting the main message
        2. A single bulleted list of key points (3-5 points)
        3. (Optional) One "Bonus Insight" at the end - only if there's a particularly noteworthy observation or implication worth mentioning
        
        Keep the tone conversational but professional. Use bold text only for the optional "Bonus Insight:" prefix if included.`
      },
      {
        role: "user",
        content: `Please summarize the following transcript: ${transcript}`
      }
    ],
    temperature: 0.7,
    max_tokens: 500
  });

  return response.choices[0].message.content;
};

async function updateDynamoDB(jobId, data, status = 'completed') {
  try {
    await dynamodb.send(new UpdateCommand({
      TableName: process.env.JOBS_TABLE,
      Key: { jobId },
      UpdateExpression: 'SET #status = :status, transcript = :transcript, summary = :summary, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':transcript': data.transcript || null,
        ':summary': data.summary || null,
        ':updatedAt': new Date().toISOString()
      }
    }));
  } catch (error) {
    console.error('Error updating DynamoDB:', error);
    throw error;
  }
}

async function cleanupFiles(...filePaths) {
  const promises = filePaths.map(async (filePath) => {
    if (!filePath) return;
    try {
      await unlink(filePath);
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
    }
  });

  await Promise.all(promises);
}

module.exports.handler = async (event) => {
  for (const record of event.Records) {
    let videoPath, audioPath;
    try {
      const { jobId, url } = JSON.parse(record.body);
      console.log(`Starting job ${jobId} for URL: ${url}`);
      
      await updateDynamoDB(jobId, {}, 'processing');
      console.log('Updated status to processing');
      
      console.log('Downloading video...');
      videoPath = await downloadTikTokVideo(url);
      console.log('Video downloaded to:', videoPath);

      console.log('Converting to MP3...');
      audioPath = await convertToMp3(videoPath);
      console.log('Audio converted to:', audioPath);

      console.log('Getting transcript...');
      const transcriptResponse = await getTranscript(audioPath);
      console.log('Transcript received, length:', transcriptResponse.text.length);

      console.log('Generating summary...');
      const summary = await generateSummary(transcriptResponse.text);
      console.log('Summary generated:', summary);

      console.log('Updating database with results...');
      await updateDynamoDB(jobId, {
        transcript: transcriptResponse,
        summary: summary
      });

      console.log(`Successfully completed job ${jobId}`);

    } catch (error) {
      console.error('Error processing job:', error);
      try {
        const jobId = JSON.parse(record.body).jobId;
        console.log(`Updating job ${jobId} with error status`);
        await updateDynamoDB(jobId, {}, 'error');
      } catch (dbError) {
        console.error('Error updating error status:', dbError);
      }
    } finally {
      if (videoPath || audioPath) {
        console.log('Cleaning up temporary files...');
        await cleanupFiles(videoPath, audioPath);
        console.log('Cleanup completed');
      }
    }
  }
}; 