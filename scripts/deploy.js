require('dotenv').config({ path: '.env.local' });

const { spawn } = require('child_process');
const path = require('path');

// Required environment variables
const requiredEnvVars = [
  'AWS_PROFILE',
  'OPENAI_API_KEY',
  'RAPIDAPI_KEY'
];

// Check for missing environment variables
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:');
  missingEnvVars.forEach(envVar => console.error(`- ${envVar}`));
  process.exit(1);
}

// Construct the serverless deploy command
const deployCommand = [
  'deploy',
  '--aws-profile', process.env.AWS_PROFILE,
  '--param', `OPENAI_API_KEY=${process.env.OPENAI_API_KEY}`,
  '--param', `RAPIDAPI_KEY=${process.env.RAPIDAPI_KEY}`
];

// Execute the serverless deploy command
const serverless = spawn('serverless', deployCommand, {
  cwd: path.join(__dirname, '../backend'),
  stdio: 'inherit',
  shell: true
});

serverless.on('close', (code) => {
  if (code !== 0) {
    console.error(`Deployment failed with code ${code}`);
    process.exit(code);
  }
  console.log('Deployment completed successfully');
}); 