const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

let db;

async function getDb() {
  if (db) return db;
  db = await open({
    filename: path.join(__dirname, 'social.db'),
    driver: sqlite3.Database
  });

  await db.exec('PRAGMA journal_mode = WAL');
  await db.exec('PRAGMA foreign_keys = ON');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      bio TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(post_id) REFERENCES posts(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      UNIQUE(post_id, user_id),
      FOREIGN KEY(post_id) REFERENCES posts(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS followers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER NOT NULL,
      following_id INTEGER NOT NULL,
      UNIQUE(follower_id, following_id),
      FOREIGN KEY(follower_id) REFERENCES users(id),
      FOREIGN KEY(following_id) REFERENCES users(id)
    );
  `);

  // Seed demo data if no users exist
  const row = await db.get('SELECT COUNT(*) as cnt FROM users');
  if (row.cnt === 0) {
    const hash = bcrypt.hashSync('password123', 10);
    await db.run(
      'INSERT OR IGNORE INTO users (username, email, password, bio) VALUES (?, ?, ?, ?)',
      'demo', 'demo@example.com', hash, 'This is the demo account! 👋'
    );
    const hash2 = bcrypt.hashSync('password123', 10);
    await db.run(
      'INSERT OR IGNORE INTO users (username, email, password, bio) VALUES (?, ?, ?, ?)',
      'alice', 'alice@example.com', hash2, 'Hey there! I am Alice 🌸'
    );
    const hash3 = bcrypt.hashSync('password123', 10);
    await db.run(
      'INSERT OR IGNORE INTO users (username, email, password, bio) VALUES (?, ?, ?, ?)',
      'bob', 'bob@example.com', hash3, 'Bob here. Love coding! 💻'
    );

    const demoUser = await db.get('SELECT id FROM users WHERE username = ?', 'demo');
    const alice = await db.get('SELECT id FROM users WHERE username = ?', 'alice');
    const bob = await db.get('SELECT id FROM users WHERE username = ?', 'bob');

    await db.run('INSERT INTO posts (user_id, content) VALUES (?, ?)', demoUser.id, 'Welcome to SocialApp! 🎉 This is the demo account. Feel free to explore!');
    await db.run('INSERT INTO posts (user_id, content) VALUES (?, ?)', alice.id, 'Just joined SocialApp! Excited to connect with everyone 🌟');
    await db.run('INSERT INTO posts (user_id, content) VALUES (?, ?)', bob.id, 'Hello world from Bob! #coding #dev');

    await db.run('INSERT OR IGNORE INTO followers (follower_id, following_id) VALUES (?, ?)', demoUser.id, alice.id);
    await db.run('INSERT OR IGNORE INTO followers (follower_id, following_id) VALUES (?, ?)', alice.id, demoUser.id);

    console.log('Demo data seeded successfully');
  }

  return db;
}

module.exports = { getDb };
