import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./database.sqlite');

const mockVideos = [
  {
    topic: 'Morning Motivation',
    videoFile: 'motivation_morning_01.mp4',
    videoUrl: 'https://example.com/videos/motivation_01.mp4',
    method: 'heygen',
    duration: 45
  },
  {
    topic: 'Hidden Features',
    videoFile: 'tech_features_01.mp4',
    videoUrl: 'https://example.com/videos/tech_01.mp4',
    method: 'heygen',
    duration: 45
  },
  {
    topic: 'Life Hacks',
    videoFile: 'lifehacks_01.mp4',
    videoUrl: 'https://example.com/videos/lifehacks_01.mp4',
    method: 'heygen',
    duration: 45
  },
  {
    topic: 'Mind-Blowing Facts',
    videoFile: 'facts_interesting_01.mp4',
    videoUrl: 'https://example.com/videos/facts_01.mp4',
    method: 'heygen',
    duration: 45
  },
  {
    topic: 'Quick Recipes',
    videoFile: 'recipes_healthy_01.mp4',
    videoUrl: 'https://example.com/videos/recipes_01.mp4',
    method: 'heygen',
    duration: 45
  }
];

mockVideos.forEach(video => {
  db.run(
    `INSERT OR IGNORE INTO video_cache (video_file, video_url, topic, generation_date, generation_method) 
     VALUES (?, ?, ?, date('now'), ?)`,
    [video.videoFile, video.videoUrl, video.topic, video.method],
    (err) => {
      if (err) {
        console.error(`Error inserting ${video.topic}:`, err);
      } else {
        console.log(`✓ Inserted mock video: ${video.videoFile}`);
      }
    }
  );
});

setTimeout(() => {
  db.close();
  console.log('\nMock video seeding complete!');
}, 1000);
