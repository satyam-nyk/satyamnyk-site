// Mobile Menu Toggle - Hamburger functionality
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobileNav');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  mobileNav.classList.toggle('active');
});

// Close menu when a link is clicked
document.querySelectorAll('.mobile-nav a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('active');
    mobileNav.classList.remove('active');
  });
});

// Scroll to section
function scrollToSection(sectionId) {
  if (sectionId.startsWith('#')) {
    sectionId = sectionId.substring(1);
  }
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
}

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
    delay: 1500
  },
  {
    type: 'ai',
    text: 'Thank you for calling! Welcome to our property consultation. Yes, we have some great options available. To help me find the perfect match for you, I\'d like to ask a few quick questions.',
    delay: 4500
  },
  {
    type: 'customer',
    text: 'Sure, go ahead.',
    delay: 7500
  },
  {
    type: 'ai',
    text: 'What is your budget range for the property?',
    delay: 9500
  },
  {
    type: 'customer',
    text: 'Around 80 to 90 lakhs.',
    delay: 12000
  },
  {
    type: 'ai',
    text: 'Excellent! And which location are you interested in? We have properties in Wakad, Hinjewadi, and Baner.',
    delay: 15000
  },
  {
    type: 'customer',
    text: 'Wakad would be perfect. How many bedrooms are available?',
    delay: 18000
  },
  {
    type: 'ai',
    text: 'In your budget at Wakad, we have beautiful 2 and 3 BHK options with modern amenities, parking, and a swimming pool.',
    delay: 21500
  },
  {
    type: 'customer',
    text: 'That sounds great! Can I schedule a site visit?',
    delay: 24500
  },
  {
    type: 'ai',
    text: 'Absolutely! I\'m connecting you with a specialist who will schedule your visit at your convenience. They\'ll also send you the property brochure.',
    delay: 28000
  },
  {
    type: 'system',
    text: '✓ Lead Qualified & Transferred to Specialist',
    delay: 31000
  }
];

// Lead panel updates with more realistic data
const leadPanelUpdates = [
  {
    delay: 2500,
    data: {
      intent: 'Property Inquiry',
      budget: '—',
      location: '—',
      score: '⊘'
    }
  },
  {
    delay: 8000,
    data: {
      intent: 'Property Inquiry',
      budget: '—',
      location: '—',
      score: 'MEDIUM'
    }
  },
  {
    delay: 13000,
    data: {
      intent: 'Active Buyer',
      budget: '₹80-90L',
      location: '—',
      score: 'MEDIUM'
    }
  },
  {
    delay: 19000,
    data: {
      intent: 'Active Buyer',
      budget: '₹80-90L',
      location: 'Wakad',
      score: 'HIGH'
    }
  },
  {
    delay: 24000,
    data: {
      intent: 'Ready to Visit',
      budget: '₹80-90L',
      location: 'Wakad',
      score: 'PREMIUM'
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

  // Add call header with waveform animation
  setTimeout(() => {
    const header = document.createElement('div');
    header.style.cssText = 'text-align: center; padding: 1rem 0; margin-bottom: 1rem; border-bottom: 1px solid rgba(0, 212, 255, 0.2);';
    header.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 0.5rem;">
        <span style="width: 8px; height: 8px; background: #00d4ff; border-radius: 50%; animation: pulse 1s infinite;"></span>
        <div style="font-weight: 600; color: #00d4ff;">Call in Progress</div>
      </div>
      <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.6);">Duration: <span id="callTimer">00:00</span></div>
    `;
    conversation.appendChild(header);
  }, 200);

  // Start call timer
  let seconds = 0;
  const timerInterval = setInterval(() => {
    seconds++;
    const timer = document.getElementById('callTimer');
    if (timer) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      timer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  }, 1000);

  // Helper function to add typing indicator
  const addTypingIndicator = () => {
    const typing = document.createElement('div');
    typing.className = 'demo-msg ai';
    typing.id = 'typingIndicator';
    typing.innerHTML = `
      <span class="label">AI Agent</span>
      <div class="typing-indicator">
        <span style="animation: bounce 1.4s infinite;"></span>
        <span style="animation: bounce 1.4s infinite 0.2s;"></span>
        <span style="animation: bounce 1.4s infinite 0.4s;"></span>
      </div>
    `;
    conversation.appendChild(typing);
    conversation.scrollTop = conversation.scrollHeight;
  };

  // Remove typing indicator
  const removeTypingIndicator = () => {
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
  };

  // Add conversation messages with typing indicators
  conversationFlow.forEach((msg, index) => {
    // Add typing indicator before AI messages
    if ((msg.type === 'ai' || msg.type === 'system') && index > 0) {
      setTimeout(() => {
        addTypingIndicator();
      }, msg.delay - 1000);
    }

    setTimeout(() => {
      removeTypingIndicator();
      
      const msgEl = document.createElement('div');
      
      if (msg.type === 'system') {
        msgEl.style.cssText = 'text-align: center; padding: 1rem; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; margin: 1rem 0; font-weight: 500; color: #10b981;';
        msgEl.textContent = msg.text;
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
    removeTypingIndicator();
    const completion = document.createElement('div');
    completion.style.cssText = 'text-align: center; padding: 1rem; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 6px; margin-top: 1rem; font-weight: 500; color: #10b981;';
    completion.innerHTML = '✓ Call Completed - Lead Successfully Qualified & Transferred';
    conversation.appendChild(completion);
    conversation.scrollTop = conversation.scrollHeight;
    
    // Clear timer when done
    clearInterval(timerInterval);
  }, 32000);
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
