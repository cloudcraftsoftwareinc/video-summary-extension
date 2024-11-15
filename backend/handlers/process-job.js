const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const axios = require('axios');
const { OpenAI } = require('openai');

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function getTranscriptFromAPI(url) {
  console.log('Getting transcript for URL:', url);
  const response = await axios({
    method: 'POST',
    url: 'https://submagic-free-tools.fly.dev/api/tiktok-transcription',
    headers: {
      'Content-Type': 'application/json'
    },
    data: { url }
  });

  console.log('Transcript API response:', JSON.stringify(response.data, null, 2));
  
  if (!response.data?.transcripts?.['eng-US']) {
    throw new Error('No transcript found in API response');
  }

  // Clean up the WEBVTT formatting from the transcript
  const cleanTranscript = response.data.transcripts['eng-US']
    .replace('WEBVTT', '')
    .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/g, '')
    .replace(/^\s*\n/gm, '')
    .trim();

  return {
    text: cleanTranscript,
    language: 'en',
    title: response.data.videoTitle
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