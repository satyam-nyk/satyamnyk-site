// Scroll functions
function scrollToPredictor() {
  const predictorSection = document.getElementById('predictor');
  predictorSection.scrollIntoView({ behavior: 'smooth' });
}

function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
  }
}

// Sample college data
const collegeDatabase = [
  { name: 'NIT Bhopal', course: 'Mechanical Engineering', baseRank: 25000 },
  { name: 'IIIT Gwalior', course: 'Information Technology', baseRank: 20000 },
  { name: 'IIT Indore', course: 'Computer Science', baseRank: 8000 },
  { name: 'MITS Gwalior', course: 'Electronics Engineering', baseRank: 35000 },
  { name: 'NIT Jabalpur', course: 'Civil Engineering', baseRank: 30000 },
];

// AI Counselor messages based on predictions
const counselorTemplates = {
  safe: "Based on your rank and historical cutoff trends, you have a strong chance of admission to {college}. This is a safe choice where you're likely to secure a seat.",
  high: "Your profile shows a high probability of admission to {college}. Your rank is well-aligned with the typical cutoff for this institution.",
  moderate: "{college} is a competitive option for your rank. You have a reasonable chance, but it's not guaranteed.",
  ambitious: "{college} is an ambitious choice based on your rank. Apply if you're interested, but also have safer backups.",
  dream: "{college} is a dream option for you. While unlikely, it's worth applying if it matches your goals."
};

function predictColleges() {
  const rank = parseInt(document.getElementById('rankInput').value);
  const marks = parseFloat(document.getElementById('marksInput').value);
  const category = document.getElementById('categorySelect').value;
  const exam = document.getElementById('examSelect').value;

  if (!rank || !marks || rank < 1 || marks < 0) {
    alert('Please fill in all fields with valid values');
    return;
  }

  // Show loading animation
  const loadingContainer = document.getElementById('loadingContainer');
  const resultsContainer = document.getElementById('resultsContainer');
  const counselorContainer = document.getElementById('counselorContainer');
  
  loadingContainer.style.display = 'block';
  resultsContainer.style.display = 'none';
  counselorContainer.style.display = 'none';

  // Simulate loading with delays
  setTimeout(() => {
    // Calculate probabilities based on rank
    const predictions = generatePredictions(rank, marks, category);
    
    // Display results
    displayResults(predictions);
    
    // Show AI counselor
    displayCounselor(predictions);
    
    // Hide loading
    loadingContainer.style.display = 'none';
    resultsContainer.style.display = 'block';
    counselorContainer.style.display = 'block';
  }, 3000);
}

function generatePredictions(rank, marks, category) {
  const predictions = [];
  
  // Create predictions for each college with probability calculation
  collegeDatabase.forEach(college => {
    let baseProb = calculateBaseProbability(rank, college.baseRank);
    
    // Adjust for category (SC/ST get better chances)
    if (category === 'sc' || category === 'st') {
      baseProb += 15;
    } else if (category === 'obc') {
      baseProb += 8;
    }
    
    // Adjust for board marks (higher is better)
    const marksAdjustment = (marks - 70) * 0.5;
    baseProb += marksAdjustment;
    
    // Cap between 10 and 95
    baseProb = Math.min(95, Math.max(10, baseProb));
    
    predictions.push({
      name: college.name,
      course: college.course,
      probability: Math.round(baseProb),
      chanceCategory: getChanceCategory(baseProb)
    });
  });
  
  // Sort by probability (descending)
  return predictions.sort((a, b) => b.probability - a.probability);
}

function calculateBaseProbability(rank, collegeBaseRank) {
  if (rank < collegeBaseRank * 0.4) {
    return 85 + Math.random() * 15;
  } else if (rank < collegeBaseRank * 0.7) {
    return 70 + Math.random() * 20;
  } else if (rank < collegeBaseRank * 1.0) {
    return 55 + Math.random() * 25;
  } else if (rank < collegeBaseRank * 1.3) {
    return 40 + Math.random() * 20;
  } else {
    return 15 + Math.random() * 25;
  }
}

function getChanceCategory(probability) {
  if (probability >= 80) return 'safe';
  if (probability >= 60) return 'high';
  if (probability >= 40) return 'moderate';
  if (probability >= 20) return 'ambitious';
  return 'dream';
}

function displayResults(predictions) {
  const collegeResults = document.getElementById('collegeResults');
  collegeResults.innerHTML = '';
  
  predictions.forEach((pred, index) => {
    const card = document.createElement('div');
    card.className = 'college-card';
    card.innerHTML = `
      <h4>${pred.name}</h4>
      <p style="color: var(--secondary-text); font-size: 0.9rem; margin-bottom: 1rem;">${pred.course}</p>
      <div class="probability-section">
        <div class="probability-value">${pred.probability}%</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: 0%; transition: width 1s ease ${index * 0.2}s;"></div>
        </div>
        <div class="chance-label chance-${pred.chanceCategory}">
          ${pred.chanceCategory.charAt(0).toUpperCase() + pred.chanceCategory.slice(1)}
        </div>
      </div>
    `;
    collegeResults.appendChild(card);
    
    // Animate progress bars
    setTimeout(() => {
      card.querySelector('.progress-fill').style.width = pred.probability + '%';
    }, 100);
  });
}

function displayCounselor(predictions) {
  const counselorChat = document.getElementById('counselorChat');
  counselorChat.innerHTML = '';
  
  // Create counselor messages
  const topColleges = predictions.slice(0, 3);
  const messages = [];
  
  // Initial greeting
  messages.push({
    text: `Based on your profile analysis, I've identified ${predictions.length} colleges where you have realistic admission chances.`,
    delay: 0
  });
  
  // Top recommendation
  if (topColleges.length > 0) {
    const message = counselorTemplates[topColleges[0].chanceCategory].replace(
      '{college}',
      `${topColleges[0].name} - ${topColleges[0].course}`
    );
    messages.push({ text: message, delay: 500 });
  }
  
  // Alternative recommendation
  if (topColleges.length > 1) {
    messages.push({
      text: `You may also consider ${topColleges[1].name} as a strong alternative with ${topColleges[1].probability}% probability.`,
      delay: 1000
    });
  }
  
  // General advice
  messages.push({
    text: `Apply to a mix of safe, target, and ambitious colleges. Focus on colleges in the "High Chance" and "Safe" categories for better success rates.`,
    delay: 1500
  });
  
  // Display messages with delay
  messages.forEach(msg => {
    setTimeout(() => {
      const messageEl = document.createElement('div');
      messageEl.className = 'counselor-message';
      messageEl.textContent = msg.text;
      counselorChat.appendChild(messageEl);
    }, msg.delay);
  });
}

// Smooth scroll behavior for nav links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// Add intersection observer for animations
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

// Observe all cards
document.querySelectorAll('.problem-card, .feature-card, .metric-card, .arch-block, .pipeline-step').forEach(el => {
  el.style.opacity = '0.8';
  el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
  observer.observe(el);
});
