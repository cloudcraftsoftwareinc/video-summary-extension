let cachedSummary = null;
const API_BASE_URL = 'https://f1m2gfj676.execute-api.us-east-1.amazonaws.com';

function createSummaryButton() {
  const button = document.createElement('button');
  button.id = 'tiktok-summary-btn';
  button.textContent = 'Summarize Video';
  
  button.addEventListener('click', async () => {
    const container = document.getElementById('tiktok-summary-container');
    
    if (container.style.display === 'block') {
      container.style.display = 'none';
      return;
    }
    
    if (cachedSummary) {
      displaySummary(cachedSummary);
      return;
    }
    
    button.textContent = 'Summarizing...';
    
    try {
      const videoUrl = window.location.href;
      const createResponse = await fetch(`${API_BASE_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl })
      });
      
      if (!createResponse.ok) throw new Error('Failed to create job');
      
      const { jobId } = await createResponse.json();
      
      const pollInterval = setInterval(async () => {
        const statusResponse = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
        if (!statusResponse.ok) {
          clearInterval(pollInterval);
          throw new Error('Failed to get job status');
        }
        
        const job = await statusResponse.json();
        
        if (job.status === 'completed' && job.summary) {
          clearInterval(pollInterval);
          cachedSummary = job.summary;
          displaySummary(job.summary);
          button.textContent = 'Summarize Video';
        } else if (job.status === 'error') {
          clearInterval(pollInterval);
          displaySummary('Error processing video. Please try again.');
          button.textContent = 'Summarize Video';
        }
      }, 2000);
      
    } catch (error) {
      console.error('Error:', error);
      displaySummary('Error processing video. Please try again.');
      button.textContent = 'Summarize Video';
    }
  });
  
  return button;
}

function createSummaryContainer() {
  const container = document.createElement('div');
  container.id = 'tiktok-summary-container';
  container.style.cssText = `
    display: none;
    position: fixed;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    width: 450px;
    background: white;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 9999999;
    max-height: 80vh;
    overflow-y: auto;
  `;
  return container;
}

function displaySummary(summary) {
  const container = document.getElementById('tiktok-summary-container');
  container.innerHTML = `
    <div style="
      font-size: 16px;
      line-height: 1.5;
      color: #000;
    ">
      ${convertMarkdownToHTML(summary)}
    </div>
  `;
  container.style.display = 'block';
}

function convertMarkdownToHTML(markdown) {
  return markdown
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li style="margin: 8px 0; padding-left: 16px;">$1</li>')
    .replace(/(<li.*<\/li>)\s*(?=<li>|$)/s, '<ul style="list-style-type: disc; margin: 12px 0;">$1</ul>')
    .replace(/^(?!\s*[-*]\s+)(.+)$/gm, '<p style="margin: 12px 0;">$1</p>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\s*\n/g, '<br>');
}

function init() {
  if (document.querySelector('#tiktok-summary-btn')) return;

  const videoElement = document.querySelector('video');
  if (!videoElement) return;

  const videoContainer = videoElement.closest('[class*="DivVideoWrapper"]') || 
                        videoElement.closest('[class*="DivVideoPlayerContainer"]') || 
                        videoElement.parentElement;

  if (videoContainer) {
    const button = createSummaryButton();
    const summaryContainer = createSummaryContainer();
    
    document.body.appendChild(summaryContainer);
    videoContainer.appendChild(button);
    
    document.addEventListener('click', (e) => {
      const container = document.getElementById('tiktok-summary-container');
      if (container && !container.contains(e.target) && 
          e.target.id !== 'tiktok-summary-btn') {
        container.style.display = 'none';
      }
    });
  }
}

// Initialize
setTimeout(() => {
  if (window.location.pathname.includes('/video/')) {
    init();
  }
}, 2000);

// Watch for navigation
const observer = new MutationObserver(
  debounce(() => {
    if (window.location.pathname.includes('/video/')) {
      init();
    }
  }, 1000)
);

observer.observe(document.body, {
  childList: true,
  subtree: true
});

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
} 