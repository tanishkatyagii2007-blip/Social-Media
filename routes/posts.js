const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/auth');

// GET /api/posts/feed
router.get('/feed', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const posts = db.prepare(`
      SELECT
        p.id, p.content, p.image_url, p.created_at,
        u.id as user_id, u.username, u.avatar, u.bio,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as like_count,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) as is_liked
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.user_id = ?
        OR p.user_id IN (SELECT following_id FROM followers WHERE follower_id = ?)
      ORDER BY p.created_at DESC
      LIMIT 50
    `).all(userId, userId, userId);

    res.json({ posts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/posts/user/:userId
router.get('/user/:userId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const viewerId = req.user ? req.user.id : 0;

    const posts = db.prepare(`
      SELECT
        p.id, p.content, p.image_url, p.created_at,
        u.id as user_id, u.username, u.avatar, u.bio,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as like_count,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
        0 as is_liked
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `).all(userId);

    res.json({ posts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/posts
router.post('/', authMiddleware, (req, res) => {
  try {
    const { content, image_url } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = db.prepare(
      'INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)'
    ).run(req.user.id, content.trim(), image_url || '');

    const post = db.prepare(`
      SELECT
        p.id, p.content, p.image_url, p.created_at,
        u.id as user_id, u.username, u.avatar, u.bio,
        0 as like_count,
        0 as comment_count,
        0 as is_liked
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ post });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/posts/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    db.prepare('DELETE FROM likes WHERE post_id = ?').run(postId);
    db.prepare('DELETE FROM comments WHERE post_id = ?').run(postId);
    db.prepare('DELETE FROM posts WHERE id = ?').run(postId);

    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/posts/:id/like (toggle)
router.post('/:id/like', authMiddleware, (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.user.id;

    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const existing = db.prepare('SELECT id FROM likes WHERE post_id = ? AND user_id = ?').get(postId, userId);
    let liked;
    if (existing) {
      db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(postId, userId);
      liked = false;
    } else {
      db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)').run(postId, userId);
      liked = true;
    }

    const likeCount = db.prepare('SELECT COUNT(*) as cnt FROM likes WHERE post_id = ?').get(postId).cnt;
    res.json({ liked, likeCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
