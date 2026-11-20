const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/auth');

// GET /api/comments/:postId
router.get('/:postId', (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const comments = db.prepare(`
      SELECT
        c.id, c.content, c.created_at,
        u.id as user_id, u.username, u.avatar
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `).all(postId);
    res.json({ comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/comments/:postId
router.post('/:postId', authMiddleware, (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const result = db.prepare(
      'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)'
    ).run(postId, req.user.id, content.trim());

    const comment = db.prepare(`
      SELECT
        c.id, c.content, c.created_at,
        u.id as user_id, u.username, u.avatar
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/comments/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
