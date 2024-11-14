const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const sqs = new SQSClient({});

module.exports.handler = async (event) => {
  try {
    const { url } = JSON.parse(event.body);
    
    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'URL is required' })
      };
    }

    const jobId = uuidv4();
    const timestamp = new Date().toISOString();

    // Save job to DynamoDB
    await dynamodb.send(new PutCommand({
      TableName: process.env.JOBS_TABLE,
      Item: {
        jobId,
        url,
        status: 'pending',
        createdAt: timestamp,
        updatedAt: timestamp
      }
    }));

    // Send job to SQS using the full queue URL
    await sqs.send(new SendMessageCommand({
      QueueUrl: process.env.JOBS_QUEUE_URL,  // Using the full queue URL
      MessageBody: JSON.stringify({
        jobId,
        url
      })
    }));

    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': 'https://www.tiktok.com',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ jobId })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': 'https://www.tiktok.com',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 