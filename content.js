let cachedSummary = null;
const API_BASE_URL = 'https://f1m2gfj676.execute-api.us-east-1.amazonaws.com';

function createSummaryButton() {
  const button = document.createElement('button');
  button.id = 'tiktok-summary-btn';
  button.textContent = 'Summarize Video';
  
  button.addEventListener('click', async () => {
    const container = document.getElementById('tiktok-summary-container');
    
    // If summary is already showing, just hide it
    if (container.style.display === 'block') {
      console.log('Hiding existing summary');
      container.style.display = 'none';
      return;
    }
    
    // If we have a cached summary, show it immediately
    if (cachedSummary) {
      console.log('Using cached summary');
      displaySummary(cachedSummary);
      return;
    }
    
    button.textContent = 'Summarizing...';
    
    try {
      const videoUrl = window.location.href;
      console.log('Creating job for URL:', videoUrl);
      
      // Create the job
      const createResponse = await fetch(`${API_BASE_URL}/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: videoUrl })
      });
      
      if (!createResponse.ok) {
        console.error('Failed to create job:', await createResponse.text());
        throw new Error('Failed to create job');
      }
      
      const { jobId } = await createResponse.json();
      console.log('Job created with ID:', jobId);
      
      // Poll for the result
      console.log('Starting polling for job:', jobId);
      const pollInterval = setInterval(async () => {
        console.log('Polling job:', jobId);
        const statusResponse = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
        
        if (!statusResponse.ok) {
          console.error('Failed to get job status:', await statusResponse.text());
          clearInterval(pollInterval);
          throw new Error('Failed to get job status');
        }
        
        const job = await statusResponse.json();
        console.log('Job status:', job.status);
        
        if (job.status === 'completed' && job.transcript) {
          console.log('Job completed successfully');
          clearInterval(pollInterval);
          const summary = formatTranscript(job);
          console.log('Generated summary:', summary);
          cachedSummary = summary;
          displaySummary(summary);
          button.textContent = 'Summarize Video';
        } else if (job.status === 'error') {
          console.error('Job failed:', job);
          clearInterval(pollInterval);
          displaySummary('Error processing video. Please try again.');
          button.textContent = 'Summarize Video';
        } else {
          console.log('Job still processing:', job);
        }
      }, 2000);
      
    } catch (error) {
      console.error('Error in summarize flow:', error);
      displaySummary('Error processing video. Please try again.');
      button.textContent = 'Summarize Video';
    }
  });
  
  return button;
}

function formatTranscript(job) {
  // Return the summary if available
  if (job.summary) {
    return job.summary;
  }
  
  // Fallback to transcript if no summary
  if (job.transcript && job.transcript.text) {
    return job.transcript.text;
  }
  
  return 'No summary available';
}

function createSummaryContainer() {
  const container = document.createElement('div');
  container.id = 'tiktok-summary-container';
  
  // Add click handler to prevent clicks inside the container from closing it
  container.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  return container;
}

function displaySummary(summary) {
  const container = document.getElementById('tiktok-summary-container');
  
  // Create a div for the markdown content
  container.innerHTML = `
    <div class="markdown-content">
      ${convertMarkdownToHTML(summary)}
    </div>
  `;
  container.style.display = 'block';
}

// Add this new function to handle markdown conversion
function convertMarkdownToHTML(markdown) {
  // Basic markdown conversion for bullets and paragraphs
  return markdown
    // Convert bullet points
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>')
    // Wrap lists in ul tags
    .replace(/(<li>.*<\/li>)\s*(?=<li>|$)/s, '<ul>$1</ul>')
    // Convert paragraphs
    .replace(/^(?!\s*[-*]\s+)(.+)$/gm, '<p>$1</p>')
    // Convert line breaks
    .replace(/\n\s*\n/g, '<br>')
    // Handle bold text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Handle italic text
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

function init() {
  // Add this at the beginning of the init function
  if (!document.querySelector('#tiktok-summary-styles')) {
    const style = document.createElement('style');
    style.id = 'tiktok-summary-styles';
    style.textContent = `
      .markdown-content {
        font-size: 1rem;
        line-height: 1.6;
      }
      
      .markdown-content ul {
        padding-left: 1.5rem;
        margin: 1rem 0;
      }
      
      .markdown-content li {
        margin: 0.5rem 0;
      }
      
      .markdown-content p {
        margin: 1rem 0;
      }
    `;
    document.head.appendChild(style);
  }

  // If we're already processing, don't start another init
  if (document.querySelector('#tiktok-summary-btn')) {
    return;
  }

  const videoElement = document.querySelector('video');
  if (!videoElement) {
    return;
  }

  // Get the container that holds the video player
  const videoContainer = videoElement.closest('[class*="DivVideoWrapper"]') || 
                        videoElement.closest('[class*="DivVideoPlayerContainer"]') || 
                        videoElement.parentElement;

  if (videoContainer) {
    console.log('Found video container, adding button');
    const button = createSummaryButton();
    const summaryContainer = createSummaryContainer();
    
    // Make sure the video container is positioned relatively
    videoContainer.style.position = 'relative';
    
    // Add click handler to video container to close summary when clicking outside
    document.addEventListener('click', () => {
      const container = document.getElementById('tiktok-summary-container');
      if (container) {
        container.style.display = 'none';
      }
    });
    
    // Add the button and container to the video container
    videoContainer.appendChild(button);
    videoContainer.appendChild(summaryContainer);
    
    // Prevent button clicks from closing the summary
    button.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
}

// Delay the initial check to ensure TikTok's content is loaded
setTimeout(() => {
  if (window.location.pathname.includes('/video/')) {
    init();
  }
}, 2000);

// Debounce function to prevent too many calls
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Debounced init function
const debouncedInit = debounce(() => {
  if (window.location.pathname.includes('/video/')) {
    init();
  }
}, 1000);

// Watch for video container changes since TikTok is a SPA
const observer = new MutationObserver((mutations) => {
  debouncedInit();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
}); 