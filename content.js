let cachedSummary = null;

function createSummaryButton() {
  const button = document.createElement('button');
  button.id = 'tiktok-summary-btn';
  button.textContent = 'Summarize Video';
  
  button.addEventListener('click', async () => {
    const container = document.getElementById('tiktok-summary-container');
    
    // If summary is already showing, just hide it
    if (container.style.display === 'block') {
      container.style.display = 'none';
      return;
    }
    
    // If we have a cached summary, show it immediately
    if (cachedSummary) {
      displaySummary(cachedSummary);
      return;
    }
    
    button.textContent = 'Summarizing...';
    
    // Simulate a brief loading delay
    setTimeout(() => {
      const mockSummary = "This video explains the RISEN framework for prompt engineering with ChatGPT. Key points:\n\n" +
        "• R - Role: Define the AI's role clearly\n" +
        "• I - Instructions: Give specific, clear instructions\n" +
        "• S - Steps: Break down complex tasks\n" +
        "• E - Examples: Provide examples when needed\n" +
        "• N - Niche: Specify the domain/context\n\n" +
        "The speaker emphasizes that this framework helps create more effective prompts for better AI responses.";
      
      cachedSummary = mockSummary;
      displaySummary(mockSummary);
      button.textContent = 'Summarize Video';
    }, 1000);
  });
  
  return button;
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
  container.innerHTML = summary.replace(/\n/g, '<br>');
  container.style.display = 'block';
}

function init() {
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