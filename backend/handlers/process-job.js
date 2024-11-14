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

async function getTranscriptFromAPI(url) {
  console.log('Getting transcript from RapidAPI for URL:', url);
  const options = {
    method: 'GET',
    url: 'https://tiktok-video-transcript.p.rapidapi.com/transcribe',
    params: {
      url: url,
      language: 'EN',
      timestamps: 'false'
    },
    headers: {
      'x-rapidapi-host': 'tiktok-video-transcript.p.rapidapi.com',
      'x-rapidapi-key': process.env.RAPIDAPI_KEY
    }
  };

  const response = await axios(options);
  console.log('Transcript API response:', JSON.stringify(response.data, null, 2));
  
  if (!response.data?.success || !response.data?.text) {
    throw new Error('Invalid transcript response from API');
  }

  return {
    text: response.data.text,
    language: 'en'
  };
}

const generateSummary = async (transcript) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are a concise content summarizer. Structure your summaries exactly as follows:
        1. One VERY short paragraph (MAX 2 SHORT sentences) highlighting the main message
        2. A single bulleted list of key takeaways (3-5 points)
        3. (Optional) One "Bonus Insight" at the end - only if there's a particularly noteworthy observation or implication worth mentioning. Max one SHORT sentence.
        
        Keep the tone conversational but professional. Use bold text only for the optional "Bonus:" prefix if included.`
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
    try {
      const { jobId, url } = JSON.parse(record.body);
      console.log(`Starting job ${jobId} for URL: ${url}`);
      
      await updateDynamoDB(jobId, {}, 'processing');
      
      const transcriptResponse = await getTranscriptFromAPI(url);
      console.log('Transcript received, length:', transcriptResponse.text.length);

      console.log('Generating summary...');
      const summary = await generateSummary(transcriptResponse.text);
      console.log('Summary generated:', summary);

      await updateDynamoDB(jobId, {
        transcript: transcriptResponse,
        summary: summary
      });

      console.log(`Successfully completed job ${jobId}`);

    } catch (error) {
      console.error('Error processing job:', error);
      try {
        const jobId = JSON.parse(record.body).jobId;
        await updateDynamoDB(jobId, {}, 'error');
      } catch (dbError) {
        console.error('Error updating error status:', dbError);
      }
    }
  }
}; 