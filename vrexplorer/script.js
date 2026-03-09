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

// Room data for the apartment viewer
const roomData = {
    'Living Room': {
        description: '360° panoramic space with natural lighting and balcony access',
        info: [
            '360° panoramic space with natural lighting',
            'East-facing balcony with city views',
            'Dimensions: 18ft × 22ft',
            'Premium marble flooring',
            'Full-wall glass partition to balcony'
        ]
    },
    'Kitchen': {
        description: 'Modern kitchen with island and premium appliances',
        info: [
            'Modular kitchen with island counter',
            'Premium stainless steel appliances',
            'Dimensions: 12ft × 14ft',
            'Integrated dishwasher and microwave',
            'Morning sunlight through east window'
        ]
    },
    'Bedroom': {
        description: 'Spacious master bedroom with attached balcony',
        info: [
            'Spacious master suite with walk-in closet',
            'Attached balcony with garden views',
            'Dimensions: 16ft × 18ft',
            'AC provision and split AC ready',
            'Soft carpet flooring with premium finish'
        ]
    },
    'Balcony': {
        description: 'Panoramic view balcony overlooking the neighborhood',
        info: [
            'Panoramic balcony with unobstructed views',
            'Weather-resistant flooring',
            'Space for outdoor furniture arrangement',
            'Neighborhood sight-seeing views',
            'Adjacent to living room and bedroom'
        ]
    },
    'Amenities': {
        description: 'World-class facilities including pool, gym, and gardens',
        info: [
            'Olympic-size swimming pool with jacuzzi',
            'Equipped gym with cardio and strength training',
            'Landscape gardens and meditation areas',
            'Kids play zone with safety features',
            'Community lounge and multipurpose halls'
        ]
    }
};

// Switch room in apartment viewer
function switchRoom(roomName, buttonElement) {
    // Update active button
    document.querySelectorAll('.room-button').forEach(btn => {
        btn.classList.remove('active');
    });
    buttonElement.classList.add('active');

    // Update viewer display
    const viewerContent = document.getElementById('viewerContent');
    const roomInfo = document.getElementById('roomInfo');
    
    // Update content with fade animation
    viewerContent.style.opacity = '0';
    
    setTimeout(() => {
        const data = roomData[roomName];
        
        document.querySelector('.room-indicator').textContent = roomName;
        document.querySelector('.room-visualization').textContent = data.description;
        
        // Clear and rebuild info list
        roomInfo.innerHTML = '';
        data.info.forEach(info => {
            const li = document.createElement('li');
            li.textContent = info;
            roomInfo.appendChild(li);
        });
        
        // Update room details heading
        document.querySelector('.room-details h3').textContent = roomName;
        
        viewerContent.style.opacity = '1';
    }, 150);
}

// Switch room in VR walkthrough
function switchVRRoom(roomName, buttonElement) {
    // Update active button
    document.querySelectorAll('.vr-room-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    buttonElement.classList.add('active');

    // Update VR room indicator
    const vrRoomIndicator = document.getElementById('vrRoomIndicator');
    vrRoomIndicator.style.opacity = '0';
    
    setTimeout(() => {
        vrRoomIndicator.textContent = `You are exploring: ${roomName}`;
        vrRoomIndicator.style.opacity = '1';
    }, 200);
}

// Scroll to specific section
function scrollToSection(sectionId) {
    const element = document.querySelector(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

// Intersection Observer for scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.animation = 'fadeInUp 0.8s ease-out forwards';
        }
    });
}, observerOptions);

// Observe all cards for animation
document.addEventListener('DOMContentLoaded', () => {
    // Add fade-in animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);

    // Observe cards
    const cards = document.querySelectorAll(
        '.problem-card, .solution-card, .feature-card, .metric-card, .arch-layer'
    );
    cards.forEach(card => {
        observer.observe(card);
    });

    // Set initial opacity for observer targets
    cards.forEach(card => {
        card.style.opacity = '0';
    });

    // Initialize room viewer with fade transition
    const viewerContent = document.getElementById('viewerContent');
    viewerContent.style.transition = 'opacity 0.3s ease-out';
});
