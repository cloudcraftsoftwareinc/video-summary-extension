# TikTok Video Summarizer Chrome Extension

A Chrome extension that summarizes TikTok videos using AI. The extension adds a button to TikTok video pages that, when clicked, sends the video URL to an API for processing and displays a summary of the video content.

## Features

- Automatically detects TikTok video pages
- Adds a "Summarize Video" button to the video interface
- Sends video URL to API for processing
- Polls for summary completion
- Displays video summary in a popup container

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Development

The extension consists of the following files:

- `manifest.json`: Extension configuration
- `content.js`: Main content script that handles video detection and UI
- `styles.css`: Styling for the button and summary container

## API Integration

The extension is prepared to work with an API that should:

1. Accept POST requests with video URLs
2. Return a job ID for tracking the summary process
3. Provide an endpoint for polling summary status
4. Return the completed summary when ready

Replace the placeholder API endpoints in `content.js` with your actual API endpoints.