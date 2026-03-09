// Demo Modal Functions
const modal = document.getElementById('demoModal');

function startDemo() {
  modal.classList.add('active');
}

function closeDemo() {
  modal.classList.remove('active');
  // Clear conversation on close
  const conversation = document.getElementById('demoConversation');
  conversation.innerHTML = '';
}

// Conversation data
const conversationFlow = [
  {
    type: 'customer',
    text: 'Hi, is the apartment available?',
    delay: 500
  },
  {
    type: 'ai',
    text: 'Yes, the apartment is currently available. I\'d be happy to help qualify your interest.',
    delay: 2500
  },
  {
    type: 'ai',
    text: 'Are you looking for a 2 BHK or 3 BHK?',
    delay: 3500
  },
  {
    type: 'customer',
    text: '2 BHK.',
    delay: 5000
  },
  {
    type: 'ai',
    text: 'Great! What is your budget range?',
    delay: 6000
  },
  {
    type: 'customer',
    text: 'Around 90 lakhs.',
    delay: 7500
  },
  {
    type: 'ai',
    text: 'Perfect! Let me find the best match for you. One moment...',
    delay: 9000
  },
  {
    type: 'system',
    text: 'Connecting you to a sales advisor...',
    delay: 11000
  }
];

// Lead panel updates
const leadPanelUpdates = [
  {
    delay: 1500,
    data: {
      intent: 'Property Inquiry',
      budget: '—',
      location: '—',
      score: '—'
    }
  },
  {
    delay: 4500,
    data: {
      intent: 'Property Inquiry',
      budget: '—',
      location: '—',
      score: 'MEDIUM'
    }
  },
  {
    delay: 6500,
    data: {
      intent: 'Property Inquiry',
      budget: '₹90L',
      location: '—',
      score: 'MEDIUM'
    }
  },
  {
    delay: 8500,
    data: {
      intent: 'Property Inquiry',
      budget: '₹90L',
      location: 'Wakad',
      score: 'HIGH'
    }
  }
];

// Simulate conversation
function simulateConversation() {
  const conversation = document.getElementById('demoConversation');
  const leadPanel = document.getElementById('demoLeadPanel');
  
  // Clear previous content
  conversation.innerHTML = '';
  leadPanel.innerHTML = `
    <div class="lead-item">
      <span>Intent</span>
      <strong>—</strong>
    </div>
    <div class="lead-item">
      <span>Budget</span>
      <strong>—</strong>
    </div>
    <div class="lead-item">
      <span>Location</span>
      <strong>—</strong>
    </div>
    <div class="lead-item">
      <span>Lead Score</span>
      <strong>—</strong>
    </div>
  `;

  // Add initial greeting
  setTimeout(() => {
    const greeting = document.createElement('div');
    greeting.className = 'demo-msg ai';
    greeting.innerHTML = '<span class="label">AI Agent</span><p>Thank you for calling! I\'ll help answer your questions. What can I help you with today?</p>';
    conversation.appendChild(greeting);
    conversation.scrollTop = conversation.scrollHeight;
  }, 300);

  // Add conversation messages
  conversationFlow.forEach((msg, index) => {
    setTimeout(() => {
      const msgEl = document.createElement('div');
      
      if (msg.type === 'system') {
        msgEl.className = 'demo-msg ai';
        msgEl.innerHTML = `<span class="label">System</span><p>${msg.text}</p>`;
      } else {
        msgEl.className = `demo-msg ${msg.type}`;
        const label = msg.type === 'customer' ? 'Customer' : 'AI Agent';
        msgEl.innerHTML = `<span class="label">${label}</span><p>${msg.text}</p>`;
      }
      
      conversation.appendChild(msgEl);
      conversation.scrollTop = conversation.scrollHeight;
    }, msg.delay);
  });

  // Update lead panel
  leadPanelUpdates.forEach(update => {
    setTimeout(() => {
      updateLeadPanel(update.data);
    }, update.delay);
  });

  // Show completion message
  setTimeout(() => {
    const completion = document.createElement('div');
    completion.className = 'demo-msg ai';
    completion.innerHTML = '<span class="label">System</span><p>Your information has been captured and a specialist will contact you within 2 hours.</p>';
    conversation.appendChild(completion);
    conversation.scrollTop = conversation.scrollHeight;
  }, 12000);
}

// Update lead panel data
function updateLeadPanel(data) {
  const items = document.querySelectorAll('#demoLeadPanel .lead-item strong');
  
  if (items.length >= 4) {
    items[0].textContent = data.intent || '—';
    items[1].textContent = data.budget || '—';
    items[2].textContent = data.location || '—';
    
    const scoreItem = items[3];
    scoreItem.textContent = data.score || '—';
    
    // Update lead score color
    const scoreContainer = scoreItem.parentElement;
    scoreContainer.classList.remove('score-high', 'score-medium', 'score-low');
    if (data.score === 'HIGH') {
      scoreContainer.classList.add('score-high');
      scoreItem.style.color = '#10b981';
    } else if (data.score === 'MEDIUM') {
      scoreContainer.classList.add('score-medium');
      scoreItem.style.color = '#f59e0b';
    }
  }
}

// Add styles for score colors dynamically
const style = document.createElement('style');
style.textContent = `
  .score-high strong {
    color: #10b981 !important;
  }
  .score-medium strong {
    color: #f59e0b !important;
  }
  .score-low strong {
    color: #ef4444 !important;
  }
`;
document.head.appendChild(style);

// Close modal on outside click
window.addEventListener('click', (e) => {
  if (e.target === modal) {
    closeDemo();
  }
});

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// Add intersection observer for lazy animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, observerOptions);

// Observe all animation elements
document.querySelectorAll('.problem-card, .feature-card, .metric-card, .arch-block').forEach(el => {
  el.style.opacity = '0.8';
  el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
  observer.observe(el);
});
