const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/auth');

// GET /api/users/search?q=
router.get('/search', (req, res) => {
  try {
    const q = req.query.q || '';
    const users = db.prepare(
      'SELECT id, username, bio, avatar FROM users WHERE username LIKE ? LIMIT 20'
    ).all(`%${q}%`);
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:username
router.get('/:username', (req, res) => {
  try {
    const user = db.prepare(
      'SELECT id, username, email, bio, avatar, created_at FROM users WHERE username = ?'
    ).get(req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const postCount = db.prepare('SELECT COUNT(*) as cnt FROM posts WHERE user_id = ?').get(user.id).cnt;
    const followerCount = db.prepare('SELECT COUNT(*) as cnt FROM followers WHERE following_id = ?').get(user.id).cnt;
    const followingCount = db.prepare('SELECT COUNT(*) as cnt FROM followers WHERE follower_id = ?').get(user.id).cnt;

    res.json({ user: { ...user, postCount, followerCount, followingCount } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/profile
router.put('/profile', authMiddleware, (req, res) => {
  try {
    const { bio, avatar } = req.body;
    db.prepare('UPDATE users SET bio = ?, avatar = ? WHERE id = ?').run(
      bio || '',
      avatar || '',
      req.user.id
    );
    const user = db.prepare('SELECT id, username, email, bio, avatar, created_at FROM users WHERE id = ?').get(req.user.id);
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/:id/follow
router.post('/:id/follow', authMiddleware, (req, res) => {
  try {
    const followingId = parseInt(req.params.id);
    if (followingId === req.user.id) {
      return res.status(400).json({ error: 'You cannot follow yourself' });
    }
    const target = db.prepare('SELECT id FROM users WHERE id = ?').get(followingId);
    if (!target) return res.status(404).json({ error: 'User not found' });

    db.prepare('INSERT OR IGNORE INTO followers (follower_id, following_id) VALUES (?, ?)').run(req.user.id, followingId);
    res.json({ message: 'Followed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/users/:id/follow
router.delete('/:id/follow', authMiddleware, (req, res) => {
  try {
    const followingId = parseInt(req.params.id);
    db.prepare('DELETE FROM followers WHERE follower_id = ? AND following_id = ?').run(req.user.id, followingId);
    res.json({ message: 'Unfollowed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:id/followers
router.get('/:id/followers', (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const followers = db.prepare(`
      SELECT u.id, u.username, u.bio, u.avatar
      FROM followers f
      JOIN users u ON u.id = f.follower_id
      WHERE f.following_id = ?
    `).all(userId);
    res.json({ followers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:id/following
router.get('/:id/following', (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const following = db.prepare(`
      SELECT u.id, u.username, u.bio, u.avatar
      FROM followers f
      JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = ?
    `).all(userId);
    res.json({ following });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
