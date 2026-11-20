// Profile page logic
let currentUser = null;
let profileUser = null;

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

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

function renderProfilePost(post) {
  const isOwn = currentUser && post.user_id === currentUser.id;
  return `
    <div class="profile-post-card" id="ppost-${post.id}">
      <div class="profile-post-content">${escapeHtml(post.content)}</div>
      ${post.image_url ? `<img src="${post.image_url}" class="post-image" alt="post image">` : ''}
      <div class="profile-post-meta">
        <span>🤍 ${post.like_count} likes</span>
        <span>💬 ${post.comment_count} comments</span>
        <span class="post-time">${timeAgo(post.created_at)}</span>
      </div>
      ${isOwn ? `<button class="btn-danger btn-sm delete-post-btn" data-id="${post.id}">Delete</button>` : ''}
    </div>
  `;
}

async function loadProfile(username) {
  try {
    const data = await apiFetch(`/api/users/${username}`);
    profileUser = data.user;

    document.getElementById('profile-avatar').src = getAvatar(profileUser);
    document.getElementById('profile-username').textContent = '@' + profileUser.username;
    document.getElementById('profile-bio').textContent = profileUser.bio || 'No bio yet.';
    document.getElementById('profile-posts-count').textContent = profileUser.postCount;
    document.getElementById('profile-followers-count').textContent = profileUser.followerCount;
    document.getElementById('profile-following-count').textContent = profileUser.followingCount;
    document.title = `@${profileUser.username} — SocialApp`;

    const isOwn = currentUser && currentUser.id === profileUser.id;

    if (isOwn) {
      document.getElementById('edit-profile-btn').classList.remove('hidden');
      document.getElementById('follow-btn').classList.add('hidden');
    } else if (currentUser) {
      document.getElementById('follow-btn').classList.remove('hidden');
      document.getElementById('edit-profile-btn').classList.add('hidden');
      await checkFollowStatus();
    }

    await loadUserPosts(profileUser.id);
  } catch (err) {
    document.getElementById('profile-container').innerHTML = '<div class="error-state">User not found.</div>';
  }
}

async function checkFollowStatus() {
  try {
    const data = await apiFetch(`/api/users/${profileUser.id}/followers`);
    const isFollowing = data.followers.some(f => f.id === currentUser.id);
    const btn = document.getElementById('follow-btn');
    if (isFollowing) {
      btn.textContent = 'Unfollow';
      btn.classList.add('btn-outline');
      btn.classList.remove('btn-primary');
      btn.dataset.following = 'true';
    } else {
      btn.textContent = 'Follow';
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-outline');
      btn.dataset.following = 'false';
    }
  } catch {}
}

async function loadUserPosts(userId) {
  const container = document.getElementById('profile-posts');
  container.innerHTML = '<div class="loading">Loading posts...</div>';
  try {
    const data = await apiFetch(`/api/posts/user/${userId}`);
    if (data.posts.length === 0) {
      container.innerHTML = '<div class="empty-state">No posts yet.</div>';
      return;
    }
    container.innerHTML = data.posts.map(renderProfilePost).join('');
    container.querySelectorAll('.delete-post-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this post?')) return;
        try {
          await apiFetch(`/api/posts/${btn.dataset.id}`, { method: 'DELETE' });
          document.getElementById(`ppost-${btn.dataset.id}`).remove();
          showToast('Post deleted');
          // Update count
          const cnt = document.getElementById('profile-posts-count');
          cnt.textContent = Math.max(0, parseInt(cnt.textContent) - 1);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch {
    container.innerHTML = '<div class="error-state">Could not load posts.</div>';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/index.html';
    return;
  }

  try {
    const data = await apiFetch('/api/auth/me');
    currentUser = data.user;
  } catch {
    localStorage.removeItem('token');
    window.location.href = '/index.html';
    return;
  }

  // Navbar
  document.getElementById('nav-profile-link').href = `/profile.html?username=${currentUser.username}`;
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
  });

  // Search
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      const q = searchInput.value.trim();
      if (!q) { searchResults.classList.add('hidden'); return; }
      searchTimeout = setTimeout(async () => {
        try {
          const data = await apiFetch(`/api/users/search?q=${encodeURIComponent(q)}`);
          const getAvtr = u => u.avatar ? u.avatar : `https://ui-avatars.com/api/?name=${u.username[0].toUpperCase()}&background=6366f1&color=fff&size=64`;
          searchResults.innerHTML = data.users.slice(0, 6).map(u => `
            <a href="/profile.html?username=${u.username}" class="search-result-item">
              <img src="${getAvtr(u)}" class="avatar avatar-xs"> <span>@${u.username}</span>
            </a>
          `).join('') || '<div class="search-result-item">No users found</div>';
          searchResults.classList.remove('hidden');
        } catch {}
      }, 300);
    });
    document.addEventListener('click', e => {
      if (!searchInput.contains(e.target)) searchResults.classList.add('hidden');
    });
  }

  // Get username from URL
  const params = new URLSearchParams(window.location.search);
  const username = params.get('username');
  if (!username) {
    window.location.href = `/profile.html?username=${currentUser.username}`;
    return;
  }

  await loadProfile(username);

  // Follow / Unfollow
  const followBtn = document.getElementById('follow-btn');
  if (followBtn) {
    followBtn.addEventListener('click', async () => {
      const isFollowing = followBtn.dataset.following === 'true';
      followBtn.disabled = true;
      try {
        if (isFollowing) {
          await apiFetch(`/api/users/${profileUser.id}/follow`, { method: 'DELETE' });
          followBtn.textContent = 'Follow';
          followBtn.classList.remove('btn-outline');
          followBtn.classList.add('btn-primary');
          followBtn.dataset.following = 'false';
          showToast(`Unfollowed @${profileUser.username}`);
          const cnt = document.getElementById('profile-followers-count');
          cnt.textContent = Math.max(0, parseInt(cnt.textContent) - 1);
        } else {
          await apiFetch(`/api/users/${profileUser.id}/follow`, { method: 'POST' });
          followBtn.textContent = 'Unfollow';
          followBtn.classList.add('btn-outline');
          followBtn.classList.remove('btn-primary');
          followBtn.dataset.following = 'true';
          showToast(`Following @${profileUser.username}! 🎉`);
          const cnt = document.getElementById('profile-followers-count');
          cnt.textContent = parseInt(cnt.textContent) + 1;
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
      followBtn.disabled = false;
    });
  }

  // Edit profile
  const editBtn = document.getElementById('edit-profile-btn');
  const editForm = document.getElementById('edit-profile-form');
  if (editBtn && editForm) {
    editBtn.addEventListener('click', () => {
      editForm.classList.toggle('hidden');
      if (!editForm.classList.contains('hidden')) {
        document.getElementById('edit-bio').value = currentUser.bio || '';
        document.getElementById('edit-avatar').value = currentUser.avatar || '';
      }
    });

    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = editForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Saving...';
      try {
        const bio = document.getElementById('edit-bio').value;
        const avatar = document.getElementById('edit-avatar').value;
        const data = await apiFetch('/api/users/profile', {
          method: 'PUT',
          body: JSON.stringify({ bio, avatar })
        });
        currentUser = data.user;
        localStorage.setItem('user', JSON.stringify(currentUser));
        document.getElementById('profile-bio').textContent = bio || 'No bio yet.';
        document.getElementById('profile-avatar').src = getAvatar(currentUser);
        editForm.classList.add('hidden');
        showToast('Profile updated! ✅');
      } catch (err) {
        showToast(err.message, 'error');
      }
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    });
  }
});
