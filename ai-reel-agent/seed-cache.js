import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./database.sqlite');

const cachedTopics = [
  {
    topic: 'Morning Motivation Challenge',
    description: 'Quick 3-minute motivation routine to start the day',
    alternatives: 'Daily motivation, morning routine, fitness challenge',
    score: 9.5
  },
  {
    topic: 'Hidden Features Nobody Knows',
    description: 'Revealing hidden features of everyday apps',
    alternatives: 'App secrets, tech tips, hidden tricks',
    score: 9.2
  },
  {
    topic: 'Life Hacks That Actually Work',
    description: 'Practical shortcuts to save time daily',
    alternatives: 'Time saving tips, productivity hacks, efficiency',
    score: 9.1
  },
  {
    topic: 'Mind-Blowing Facts',
    description: 'Jaw-dropping facts that are hard to believe',
    alternatives: 'Interesting facts, mind bending, trivia',
    score: 8.9
  },
  {
    topic: 'Quick Healthy Recipes',
    description: '30-second healthy meal prep ideas',
    alternatives: 'Easy recipes, meal prep, healthy food',
    score: 8.8
  },
  {
    topic: 'Productivity Hacks',
    description: 'Simple tricks to boost daily productivity',
    alternatives: 'Work smarter, efficiency tips, time management',
    score: 8.7
  },
  {
    topic: 'Viral Trends Breakdown',
    description: 'Explaining trending sounds and formats',
    alternatives: 'Trending content, viral sounds, format analysis',
    score: 8.6
  },
  {
    topic: 'Money-Saving Tips',
    description: 'Easy ways to save money daily',
    alternatives: 'Financial tips, budget hacks, savings',
    score: 8.5
  },
  {
    topic: 'DIY Life Improvements',
    description: 'Creative DIY solutions for everyday problems',
    alternatives: 'DIY projects, life hacks, creative solutions',
    score: 8.4
  },
  {
    topic: 'Psychology Facts',
    description: 'Fascinating human psychology facts',
    alternatives: 'Human behavior, mind facts, psychology',
    score: 8.3
  }
];

cachedTopics.forEach(topic => {
  db.run(
    `INSERT OR IGNORE INTO topics_cache (topic, description, alternative_descriptions, trending_score) 
     VALUES (?, ?, ?, ?)`,
    [topic.topic, topic.description, topic.alternatives, topic.score],
    (err) => {
      if (err) {
        console.error(`Error inserting ${topic.topic}:`, err);
      } else {
        console.log(`✓ Inserted: ${topic.topic}`);
      }
    }
  );
});

setTimeout(() => {
  db.close();
  console.log('\nCache seeding complete!');
}, 1000);
