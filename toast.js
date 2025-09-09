// Toast container element
let toastContainer = null;

// Initialize the toast container if it doesn't exist
function initToastContainer() {
  if (toastContainer) return;
  
  toastContainer = document.createElement('div');
  Object.assign(toastContainer.style, {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '10000',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    pointerEvents: 'none',
    maxWidth: '100%',
    width: 'auto',
    padding: '0 20px',
    boxSizing: 'border-box'
  });
  
  document.body.appendChild(toastContainer);
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {boolean} [isError=false] - Whether to show an error-style toast
 */
function showToast(message, isError = false) {
  // Initialize container if needed
  initToastContainer();
  
  // Create toast element
  const toastEl = document.createElement('div');
  
  // Apply base styles
  Object.assign(toastEl.style, {
    background: isError ? 'rgba(231, 76, 60, 0.9)' : 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '12px 24px',
    borderRadius: '24px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
    transform: 'translateY(20px)',
    opacity: '0',
    whiteSpace: 'nowrap',
    textAlign: 'center',
    pointerEvents: 'auto',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    backdropFilter: 'blur(4px)'
  });
  
  // Set message
  toastEl.textContent = message;
  
  // Add to container
  toastContainer.appendChild(toastEl);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toastEl.style.transform = 'translateY(0)';
    toastEl.style.opacity = '1';
  });
  
  // Auto-remove after delay
  const removeTimeout = setTimeout(() => {
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translateY(-20px)';
    
    // Remove from DOM after animation
    setTimeout(() => {
      if (toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
    }, 300);
  }, 4000); // 4 seconds total visibility
  
  // Allow manual dismissal
  toastEl.addEventListener('click', () => {
    clearTimeout(removeTimeout);
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translateY(-20px)';
    
    setTimeout(() => {
      if (toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
    }, 300);
  });
}

export { showToast };
