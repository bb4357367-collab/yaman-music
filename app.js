const tracks = [
  { title: "Lost In The Light", artist: "Parcels", album: "Midnight Frequency", duration: "3:48", cover: "cover-lost" },
  { title: "Sunset Lover", artist: "Petit Biscuit", album: "Presence", duration: "3:58", cover: "cover-sunset" },
  { title: "Borderline", artist: "Tame Impala", album: "The Slow Rush", duration: "3:59", cover: "cover-borderline" },
  { title: "Show Me How", artist: "Men I Trust", album: "Oncle Jazz", duration: "3:35", cover: "cover-show" },
  { title: "Sweet Disposition", artist: "The Temper Trap", album: "Conditions", duration: "3:54", cover: "cover-sweet" }
];
const queue = [tracks[0], tracks[1], tracks[2], tracks[3]];
let currentTrack = tracks[0];
let isPlaying = false;

const trackList = document.querySelector('#trackList');
const queueList = document.querySelector('#queueList');
const playButton = document.querySelector('#playButton');
const heroPlay = document.querySelector('#heroPlay');
const nowTitle = document.querySelector('#nowTitle');
const nowArtist = document.querySelector('#nowArtist');
const nowCover = document.querySelector('#nowCover');
const toast = document.querySelector('#toast');

function renderTracks(filter = '') {
  const filtered = tracks.filter((track) => `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(filter.toLowerCase()));
  trackList.innerHTML = filtered.length ? filtered.map((track, index) => `
    <button class="track-row ${track.title === currentTrack.title ? 'active' : ''}" data-title="${track.title}">
      <span class="track-index">${String(index + 1).padStart(2, '0')}</span>
      <span class="track-cover ${track.cover}"></span>
      <span class="track-meta"><strong>${track.title}</strong><small>${track.artist} · ${track.album}</small></span>
      <span class="track-duration">${track.duration}</span><span class="track-more">•••</span>
    </button>`).join('') : '<p class="subtle">No tracks found in your rotation.</p>';
  document.querySelectorAll('.track-row').forEach((row) => row.addEventListener('click', () => selectTrack(row.dataset.title)));
}

function renderQueue() {
  queueList.innerHTML = queue.length ? queue.map((track, index) => `
    <div class="queue-item"><span class="mini-cover ${track.cover}"></span><div><strong>${track.title}</strong><small>${track.artist}</small></div><span>${index === 0 ? 'now' : track.duration}</span></div>`).join('') : '<p class="subtle">Your queue is clear.</p>';
  document.querySelector('#queueCount').textContent = String(queue.length).padStart(2, '0');
}

function selectTrack(title) {
  const selected = tracks.find((track) => track.title === title) || tracks[0];
  currentTrack = selected;
  nowTitle.textContent = selected.title;
  nowArtist.textContent = `${selected.artist.toUpperCase()} · ${selected.album.toUpperCase()}`;
  nowCover.className = `now-cover ${selected.cover}`;
  isPlaying = true;
  updatePlayState();
  renderTracks(document.querySelector('#searchInput').value);
  showToast(`Playing ${selected.title}`);
}

function updatePlayState() {
  playButton.textContent = isPlaying ? 'Ⅱ' : '▶';
  playButton.title = isPlaying ? 'Pause' : 'Play';
  heroPlay.innerHTML = isPlaying ? '<span>Ⅱ</span> Pause mix' : '<span>▶</span> Play mix';
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 2400);
}

document.querySelector('#searchInput').addEventListener('input', (event) => renderTracks(event.target.value));
playButton.addEventListener('click', () => { isPlaying = !isPlaying; updatePlayState(); });
heroPlay.addEventListener('click', () => { isPlaying = !isPlaying; updatePlayState(); });
document.querySelector('#heroPlay').closest('.hero-actions').querySelector('.round-button').addEventListener('click', () => showToast('Added Midnight Frequency to your library'));
document.querySelector('#likeButton').addEventListener('click', (event) => { event.currentTarget.textContent = event.currentTarget.textContent === '♥' ? '♡' : '♥'; showToast(event.currentTarget.textContent === '♥' ? 'Added to liked tracks' : 'Removed from liked tracks'); });
document.querySelector('#clearQueue').addEventListener('click', () => { queue.splice(1); renderQueue(); showToast('Queue cleared'); });
document.querySelector('#connectButton').addEventListener('click', () => { document.querySelector('#connectText').textContent = 'Bot connected'; showToast('Bot connected to YAMAN LOUNGE'); });
document.querySelectorAll('[data-play]').forEach((card) => card.addEventListener('click', () => selectTrack(card.dataset.play === 'Night Drive' ? 'Borderline' : card.dataset.play === 'Deep Focus' ? 'Show Me How' : 'Lost In The Light')));
document.querySelectorAll('.tiny-play').forEach((button) => button.addEventListener('click', () => selectTrack(button.dataset.track)));
document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => { document.querySelectorAll('.nav-item').forEach((nav) => nav.classList.remove('active')); item.classList.add('active'); if (item.dataset.view === 'discover') showToast('Discover is ready for your next favorite'); if (item.dataset.view === 'library') showToast('Your library is looking good'); }));
document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector('#searchInput').focus(); } if (event.code === 'Space' && document.activeElement.tagName !== 'INPUT') { event.preventDefault(); isPlaying = !isPlaying; updatePlayState(); } });

const coverStyles = document.createElement('style');
coverStyles.textContent = `
  .cover-sunset { background-image: url('https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=120&q=80'); }
  .cover-borderline { background-image: url('https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=120&q=80'); }
  .cover-show { background-image: url('https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=120&q=80'); }
  .cover-sweet { background-image: url('https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=120&q=80'); }
`;
document.head.appendChild(coverStyles);
renderTracks();
renderQueue();
