// Feed page logic
let currentUser = null;

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

function getAvatar(user) {
  if (user && user.avatar && user.avatar.trim()) return user.avatar;
  const name = (user && user.username) ? user.username[0].toUpperCase() : '?';
  return `https://ui-avatars.com/api/?name=${name}&background=6366f1&color=fff&size=64`;
}

function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function renderPost(post) {
  const isOwn = currentUser && post.user_id === currentUser.id;
  const liked = post.is_liked === 1 || post.is_liked === true;
  return `
    <div class="post-card" id="post-${post.id}">
      <div class="post-header">
        <a href="/profile.html?username=${post.username}" class="post-user-link">
          <img src="${getAvatar(post)}" alt="${post.username}" class="avatar avatar-sm">
          <div>
            <span class="post-username">${post.username}</span>
            <span class="post-time">${timeAgo(post.created_at)}</span>
          </div>
        </a>
        ${isOwn ? `<button class="btn-icon delete-post-btn" data-id="${post.id}" title="Delete post">🗑️</button>` : ''}
      </div>
      <div class="post-content">${escapeHtml(post.content)}</div>
      ${post.image_url ? `<img src="${post.image_url}" alt="Post image" class="post-image">` : ''}
      <div class="post-actions">
        <button class="btn-action like-btn ${liked ? 'liked' : ''}" data-id="${post.id}" data-liked="${liked}">
          <span class="heart-icon">${liked ? '❤️' : '🤍'}</span>
          <span class="like-count">${post.like_count}</span>
        </button>
        <button class="btn-action comment-toggle-btn" data-id="${post.id}">
          💬 <span>${post.comment_count}</span>
        </button>
      </div>
      <div class="comment-section hidden" id="comments-${post.id}">
        <div class="comments-list" id="comments-list-${post.id}"></div>
        <div class="comment-input-row">
          <img src="${getAvatar(currentUser)}" alt="me" class="avatar avatar-xs">
          <input type="text" class="comment-input" placeholder="Write a comment..." id="comment-input-${post.id}">
          <button class="btn-primary btn-sm comment-submit-btn" data-id="${post.id}">Post</button>
        </div>
      </div>
    </div>
  `;
}

function renderComment(c) {
  const isOwn = currentUser && c.user_id === currentUser.id;
  return `
    <div class="comment-item" id="comment-${c.id}">
      <a href="/profile.html?username=${c.username}">
        <img src="${getAvatar(c)}" alt="${c.username}" class="avatar avatar-xs">
      </a>
      <div class="comment-body">
        <span class="comment-username">${c.username}</span>
        <span class="comment-text">${escapeHtml(c.content)}</span>
        <span class="comment-time">${timeAgo(c.created_at)}</span>
      </div>
      ${isOwn ? `<button class="btn-icon delete-comment-btn" data-id="${c.id}" title="Delete">✕</button>` : ''}
    </div>
  `;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

async function loadFeed() {
  const feedEl = document.getElementById('feed');
  feedEl.innerHTML = '<div class="loading">Loading posts...</div>';
  try {
    const data = await apiFetch('/api/posts/feed');
    if (data.posts.length === 0) {
      feedEl.innerHTML = '<div class="empty-state">No posts yet. Follow some users or create your first post! 🚀</div>';
      return;
    }
    feedEl.innerHTML = data.posts.map(renderPost).join('');
    attachPostEvents();
  } catch (err) {
    feedEl.innerHTML = '<div class="error-state">Failed to load feed.</div>';
  }
}

async function loadSuggestions() {
  const container = document.getElementById('suggestions-list');
  try {
    const data = await apiFetch('/api/users/search?q=');
    const suggestions = data.users.filter(u => u.id !== currentUser.id).slice(0, 5);
    if (suggestions.length === 0) {
      container.innerHTML = '<p class="text-muted">No suggestions right now.</p>';
      return;
    }
    container.innerHTML = suggestions.map(u => `
      <div class="suggestion-item">
        <a href="/profile.html?username=${u.username}" class="suggestion-link">
          <img src="${getAvatar(u)}" alt="${u.username}" class="avatar avatar-xs">
          <span class="suggestion-username">${u.username}</span>
        </a>
        <button class="btn-outline btn-sm follow-suggest-btn" data-id="${u.id}" data-username="${u.username}">Follow</button>
      </div>
    `).join('');

    container.querySelectorAll('.follow-suggest-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        try {
          await apiFetch(`/api/users/${id}/follow`, { method: 'POST' });
          btn.textContent = 'Following ✓';
          btn.classList.remove('btn-outline');
          btn.classList.add('btn-primary');
          showToast(`You are now following @${btn.dataset.username}`);
          loadSidebar();
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    container.innerHTML = '<p class="text-muted">Could not load suggestions.</p>';
  }
}

async function loadSidebar() {
  try {
    const data = await apiFetch(`/api/users/${currentUser.username}`);
    const u = data.user;
    document.getElementById('sidebar-followers').textContent = u.followerCount;
    document.getElementById('sidebar-following').textContent = u.followingCount;
  } catch {}
}

function attachPostEvents() {
  // Like buttons
  document.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const postId = btn.dataset.id;
      btn.disabled = true;
      try {
        const data = await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' });
        btn.dataset.liked = data.liked;
        btn.classList.toggle('liked', data.liked);
        btn.querySelector('.heart-icon').textContent = data.liked ? '❤️' : '🤍';
        btn.querySelector('.like-count').textContent = data.likeCount;
      } catch (err) {
        showToast(err.message, 'error');
      }
      btn.disabled = false;
    });
  });

  // Comment toggle
  document.querySelectorAll('.comment-toggle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const postId = btn.dataset.id;
      const section = document.getElementById(`comments-${postId}`);
      const isHidden = section.classList.contains('hidden');
      section.classList.toggle('hidden');
      if (isHidden) {
        await loadComments(postId);
      }
    });
  });

  // Delete post
  document.querySelectorAll('.delete-post-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this post?')) return;
      const postId = btn.dataset.id;
      try {
        await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
        document.getElementById(`post-${postId}`).remove();
        showToast('Post deleted');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  // Comment submit
  document.querySelectorAll('.comment-submit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const postId = btn.dataset.id;
      const input = document.getElementById(`comment-input-${postId}`);
      const content = input.value.trim();
      if (!content) return;
      btn.disabled = true;
      try {
        const data = await apiFetch(`/api/comments/${postId}`, {
          method: 'POST',
          body: JSON.stringify({ content })
        });
        const listEl = document.getElementById(`comments-list-${postId}`);
        listEl.insertAdjacentHTML('beforeend', renderComment(data.comment));
        input.value = '';
        // Update comment count
        const toggleBtn = document.querySelector(`.comment-toggle-btn[data-id="${postId}"] span`);
        if (toggleBtn) toggleBtn.textContent = parseInt(toggleBtn.textContent || 0) + 1;
        attachCommentDeleteEvents(listEl);
        showToast('Comment posted!');
      } catch (err) {
        showToast(err.message, 'error');
      }
      btn.disabled = false;
    });
  });

  // Enter key for comment inputs
  document.querySelectorAll('.comment-input').forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const postId = input.id.replace('comment-input-', '');
        document.querySelector(`.comment-submit-btn[data-id="${postId}"]`).click();
      }
    });
  });
}

async function loadComments(postId) {
  const listEl = document.getElementById(`comments-list-${postId}`);
  listEl.innerHTML = '<div class="loading">Loading comments...</div>';
  try {
    const data = await apiFetch(`/api/comments/${postId}`);
    if (data.comments.length === 0) {
      listEl.innerHTML = '<p class="text-muted no-comments">No comments yet. Be the first!</p>';
    } else {
      listEl.innerHTML = data.comments.map(renderComment).join('');
      attachCommentDeleteEvents(listEl);
    }
  } catch {
    listEl.innerHTML = '<p class="text-muted">Could not load comments.</p>';
  }
}

function attachCommentDeleteEvents(container) {
  container.querySelectorAll('.delete-comment-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const commentId = btn.dataset.id;
      try {
        await apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' });
        document.getElementById(`comment-${commentId}`).remove();
        showToast('Comment deleted');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

// Search
let searchTimeout;
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      const q = searchInput.value.trim();
      if (!q) { searchResults.classList.add('hidden'); return; }
      searchTimeout = setTimeout(async () => {
        try {
          const data = await apiFetch(`/api/users/search?q=${encodeURIComponent(q)}`);
          if (data.users.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item">No users found</div>';
          } else {
            searchResults.innerHTML = data.users.slice(0, 6).map(u => `
              <a href="/profile.html?username=${u.username}" class="search-result-item">
                <img src="${getAvatar(u)}" alt="${u.username}" class="avatar avatar-xs">
                <span>@${u.username}</span>
              </a>
            `).join('');
          }
          searchResults.classList.remove('hidden');
        } catch {}
      }, 300);
    });

    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target)) searchResults.classList.add('hidden');
    });
  }
});

// Create post
async function setupCreatePost() {
  const form = document.getElementById('create-post-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const textarea = document.getElementById('post-content');
    const imgInput = document.getElementById('post-image-url');
    const btn = form.querySelector('button[type="submit"]');
    const content = textarea.value.trim();
    if (!content) return;
    btn.disabled = true;
    btn.textContent = 'Posting...';
    try {
      const data = await apiFetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify({ content, image_url: imgInput.value.trim() })
      });
      textarea.value = '';
      imgInput.value = '';
      const feedEl = document.getElementById('feed');
      feedEl.insertAdjacentHTML('afterbegin', renderPost(data.post));
      attachPostEvents();
      showToast('Post created! 🎉');
    } catch (err) {
      showToast(err.message, 'error');
    }
    btn.disabled = false;
    btn.textContent = 'Post';
  });
}

// Main init
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/index.html';
    return;
  }

  try {
    const data = await apiFetch('/api/auth/me');
    currentUser = data.user;
    localStorage.setItem('user', JSON.stringify(currentUser));
  } catch {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
    return;
  }

  // Populate sidebar
  document.getElementById('sidebar-avatar').src = getAvatar(currentUser);
  document.getElementById('sidebar-username').textContent = '@' + currentUser.username;
  document.getElementById('sidebar-bio').textContent = currentUser.bio || '';
  document.getElementById('sidebar-profile-link').href = `/profile.html?username=${currentUser.username}`;
  document.getElementById('nav-profile-link').href = `/profile.html?username=${currentUser.username}`;

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
  });

  await loadSidebar();
  await loadFeed();
  await loadSuggestions();
  await setupCreatePost();
});
