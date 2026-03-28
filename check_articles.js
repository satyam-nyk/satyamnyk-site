require('dotenv').config({ path: '/Users/lenovo/Downloads/satyamnyk-site/content-engine/.env.local' });

const mongoose = require('mongoose');

// Define schema
const articleSchema = new mongoose.Schema({
  title: String,
  slug: String,
  category: String,
  status: String,
  publishedAt: Date,
  createdAt: Date,
});

async function check() {
  try {
    const dbUrl = process.env.MONGODB_URI;
    if (!dbUrl) {
      console.error('MONGODB_URI not set');
      process.exit(1);
    }

    await mongoose.connect(dbUrl);
    const Article = mongoose.model('Article', articleSchema);
    
    const articles = await Article.find({ status: 'published' }).lean();
    
    console.log(`Total published articles: ${articles.length}`);
    console.log('\nBy category:');
    console.log(`- tech: ${articles.filter(a => a.category === 'tech').length}`);
    console.log(`- history: ${articles.filter(a => a.category === 'history').length}`);
    
    console.log('\nArticles:');
    articles.forEach(a => {
      console.log(`  [${a.category}] ${a.title}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

check();
