const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

module.exports.handler = async (event) => {
  try {
    const { jobId } = event.pathParameters;

    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.JOBS_TABLE,
      Key: { jobId }
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': 'https://www.tiktok.com',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ error: 'Job not found' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': 'https://www.tiktok.com',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(result.Item)
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