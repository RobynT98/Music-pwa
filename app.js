const DB_NAME = 'darkacademiawizard-music-vault';
const DB_VERSION = 1;
const TRACK_STORE = 'tracks';
const PLAYLIST_STORE = 'playlists';

let db;
let tracks = [];
let playlists = [];
let currentTrack = null;

const $ = (id) => document.getElementById(id);

const fallbackCover = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
  <rect width="800" height="800" fill="#12090b"/>
  <text x="50%" y="48%" text-anchor="middle" fill="#f0c77b" font-size="58" font-family="Georgia">DarkAcademiaWizard</text>
  <text x="50%" y="57%" text-anchor="middle" fill="#c8a996" font-size="30" font-family="Georgia">Music Vault</text>
</svg>`)}`;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(TRACK_STORE)) {
        database.createObjectStore(TRACK_STORE, { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains(PLAYLIST_STORE)) {
        database.createObjectStore(PLAYLIST_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function putItem(storeName, item) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName, 'readwrite').put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function deleteItem(storeName, id) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName, 'readwrite').delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function clearStore(storeName) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName, 'readwrite').clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function makeId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `track-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function refreshData() {
  tracks = await getAll(TRACK_STORE);
  playlists = await getAll(PLAYLIST_STORE);

  renderTracks();
  renderPlaylists();
  renderPlaylistSelect();
}

function setActiveTab(tabId) {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === tabId);
  });
}

function renderTracks() {
  const grid = $('trackGrid');
  const empty = $('emptyLibrary');
  const search = $('searchInput').value.trim().toLowerCase();
  const sort = $('sortSelect').value;

  let list = tracks.filter((track) => {
    const haystack = [
      track.title,
      track.artist,
      track.category,
      track.year,
      ...(track.tags || [])
    ].join(' ').toLowerCase();

    return haystack.includes(search);
  });

  list.sort((a, b) => {
    if (sort === 'titleAsc') return (a.title || '').localeCompare(b.title || '');
    if (sort === 'artistAsc') return (a.artist || '').localeCompare(b.artist || '');
    if (sort === 'categoryAsc') return (a.category || '').localeCompare(b.category || '');
    if (sort === 'yearDesc') return Number(b.year || 0) - Number(a.year || 0);

    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });

  grid.innerHTML = '';
  empty.classList.toggle('hidden', tracks.length > 0);

  const template = $('trackCardTemplate');

  list.forEach((track) => {
    const node = template.content.cloneNode(true);

    node.querySelector('.track-cover').src = track.coverDataUrl || fallbackCover;
    node.querySelector('.track-title').textContent = track.title || 'Utan titel';
    node.querySelector('.track-meta').textContent =
      `${track.artist || 'Okänd artist'} • ${track.category || 'Okategori'} • ${track.year || 'Utan år'}`;
    node.querySelector('.track-tags').textContent =
      (track.tags || []).map((tag) => `#${tag}`).join(' ');

    node.querySelector('.track-card').addEventListener('click', () => {
      playTrack(track.id);
    });

    grid.appendChild(node);
  });
}

function playTrack(id) {
  const track = tracks.find((item) => item.id === id);
  if (!track) return;

  currentTrack = track;

  $('player').classList.remove('hidden');
  $('playerCover').src = track.coverDataUrl || fallbackCover;
  $('playerTitle').textContent = track.title || 'Utan titel';
  $('playerMeta').textContent =
    `${track.artist || 'Okänd artist'} • ${track.category || 'Okategori'} • ${track.year || 'Utan år'}`;

  $('audioPlayer').src = track.audioDataUrl || '';
  $('lyricsBox').textContent = track.lyricsSuno || track.lyricsClean || '';

  if (track.videoUrl) {
    $('videoLink').href = track.videoUrl;
    $('videoLink').classList.remove('hidden');
  } else {
    $('videoLink').classList.add('hidden');
  }
}

function clearForm() {
  $('trackForm').reset();
  $('trackId').value = '';
  $('formTitle').textContent = 'Lägg till låt';
  $('deleteTrackBtn').classList.add('hidden');
}

function fillForm(track) {
  $('trackId').value = track.id;
  $('titleInput').value = track.title || '';
  $('artistInput').value = track.artist || '';
  $('categoryInput').value = track.category || '';
  $('yearInput').value = track.year || '';
  $('tagsInput').value = (track.tags || []).join(', ');
  $('videoInput').value = track.videoUrl || '';
  $('lyricsSunoInput').value = track.lyricsSuno || '';
  $('lyricsCleanInput').value = track.lyricsClean || '';

  $('formTitle').textContent = `Redigera: ${track.title || 'Utan titel'}`;
  $('deleteTrackBtn').classList.remove('hidden');

  setActiveTab('editor');
}

async function saveTrack(event) {
  event.preventDefault();

  const id = $('trackId').value || makeId();
  const existing = tracks.find((track) => track.id === id);

  const audioDataUrl =
    await fileToDataUrl($('audioInput').files[0]) || existing?.audioDataUrl || '';

  const coverDataUrl =
    await fileToDataUrl($('coverInput').files[0]) || existing?.coverDataUrl || '';

  const track = {
    id,
    title: $('titleInput').value.trim(),
    artist: $('artistInput').value.trim() || 'DarkAcademiaWizard',
    category: $('categoryInput').value.trim(),
    year: $('yearInput').value ? Number($('yearInput').value) : '',
    tags: $('tagsInput').value.split(',').map((tag) => tag.trim()).filter(Boolean),
    videoUrl: $('videoInput').value.trim(),
    lyricsSuno: $('lyricsSunoInput').value,
    lyricsClean: $('lyricsCleanInput').value,
    audioDataUrl,
    coverDataUrl,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now()
  };

  await putItem(TRACK_STORE, track);
  await refreshData();

  clearForm();
  playTrack(id);
  setActiveTab('library');
}

async function removeCurrentFormTrack() {
  const id = $('trackId').value;
  if (!id) return;

  if (!confirm('Radera låten från vaulten?')) return;

  await deleteItem(TRACK_STORE, id);

  playlists = playlists.map((list) => ({
    ...list,
    trackIds: list.trackIds.filter((trackId) => trackId !== id)
  }));

  for (const playlist of playlists) {
    await putItem(PLAYLIST_STORE, playlist);
  }

  if (currentTrack?.id === id) currentTrack = null;

  $('player').classList.add('hidden');
  clearForm();

  await refreshData();
  setActiveTab('library');
}

async function createPlaylist() {
  const name = $('playlistNameInput').value.trim();
  if (!name) return;

  await putItem(PLAYLIST_STORE, {
    id: makeId(),
    name,
    trackIds: [],
    createdAt: Date.now()
  });

  $('playlistNameInput').value = '';
  await refreshData();
}

function renderPlaylistSelect() {
  const select = $('addPlaylistSelect');
  select.innerHTML = '';

  if (playlists.length === 0) {
    const option = document.createElement('option');
    option.textContent = 'Skapa en spellista först';
    option.value = '';
    select.appendChild(option);
    return;
  }

  playlists.forEach((playlist) => {
    const option = document.createElement('option');
    option.value = playlist.id;
    option.textContent = playlist.name;
    select.appendChild(option);
  });
}

async function addCurrentToPlaylist() {
  if (!currentTrack) return;

  const playlistId = $('addPlaylistSelect').value;
  const playlist = playlists.find((item) => item.id === playlistId);

  if (!playlist) return;

  if (!playlist.trackIds.includes(currentTrack.id)) {
    playlist.trackIds.push(currentTrack.id);
  }

  await putItem(PLAYLIST_STORE, playlist);
  await refreshData();
}

function renderPlaylists() {
  const area = $('playlistArea');
  area.innerHTML = '';

  if (playlists.length === 0) {
    area.innerHTML = '<p class="empty">Inga spellistor än.</p>';
    return;
  }

  playlists.forEach((playlist) => {
    const box = document.createElement('div');
    box.className = 'playlist-box';

    const title = document.createElement('h3');
    title.textContent = playlist.name;
    box.appendChild(title);

    if (playlist.trackIds.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Tom spellista.';
      box.appendChild(empty);
    }

    playlist.trackIds.forEach((trackId) => {
      const track = tracks.find((item) => item.id === trackId);
      if (!track) return;

      const row = document.createElement('div');
      row.className = 'playlist-track';
      row.innerHTML = `<span>${track.title || 'Utan titel'}</span>`;

      const controls = document.createElement('div');

      const playBtn = document.createElement('button');
      playBtn.textContent = 'Spela';
      playBtn.className = 'secondary';
      playBtn.addEventListener('click', () => playTrack(track.id));

      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Ta bort';
      removeBtn.className = 'danger';
      removeBtn.addEventListener('click', async () => {
        playlist.trackIds = playlist.trackIds.filter((id) => id !== track.id);
        await putItem(PLAYLIST_STORE, playlist);
        await refreshData();
      });

      controls.append(playBtn, removeBtn);
      row.appendChild(controls);
      box.appendChild(row);
    });

    const deletePlaylistBtn = document.createElement('button');
    deletePlaylistBtn.textContent = 'Radera spellista';
    deletePlaylistBtn.className = 'danger';

    deletePlaylistBtn.addEventListener('click', async () => {
      if (!confirm(`Radera spellistan "${playlist.name}"?`)) return;
      await deleteItem(PLAYLIST_STORE, playlist.id);
      await refreshData();
    });

    box.appendChild(deletePlaylistBtn);
    area.appendChild(box);
  });
}

function exportBackup() {
  const backup = {
    app: 'DarkAcademiaWizard Music Vault',
    version: 2,
    exportedAt: new Date().toISOString(),
    tracks,
    playlists
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `darkacademiawizard-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();

  URL.revokeObjectURL(url);
}

async function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const text = await file.text();
  const data = JSON.parse(text);

  if (!Array.isArray(data.tracks) || !Array.isArray(data.playlists)) {
    alert('Backupfilen verkar inte vara rätt format.');
    return;
  }

  if (!confirm('Importera backup?')) return;

  for (const track of data.tracks) {
    await putItem(TRACK_STORE, track);
  }

  for (const playlist of data.playlists) {
    await putItem(PLAYLIST_STORE, playlist);
  }

  await refreshData();
  event.target.value = '';
}

async function clearAll() {
  if (!confirm('Rensa hela vaulten? Exportera backup först om du vill spara.')) return;

  await clearStore(TRACK_STORE);
  await clearStore(PLAYLIST_STORE);

  currentTrack = null;
  $('player').classList.add('hidden');

  await refreshData();
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
  });

  $('searchInput').addEventListener('input', renderTracks);
  $('sortSelect').addEventListener('change', renderTracks);
  $('trackForm').addEventListener('submit', saveTrack);
  $('newTrackBtn').addEventListener('click', clearForm);
  $('deleteTrackBtn').addEventListener('click', removeCurrentFormTrack);

  $('editCurrentBtn').addEventListener('click', () => {
    if (currentTrack) fillForm(currentTrack);
  });

  $('showSunoBtn').addEventListener('click', () => {
    if (currentTrack) $('lyricsBox').textContent = currentTrack.lyricsSuno || '';
  });

  $('showCleanBtn').addEventListener('click', () => {
    if (currentTrack) $('lyricsBox').textContent = currentTrack.lyricsClean || '';
  });

  $('createPlaylistBtn').addEventListener('click', createPlaylist);
  $('addToPlaylistBtn').addEventListener('click', addCurrentToPlaylist);
  $('exportBtn').addEventListener('click', exportBackup);
  $('importInput').addEventListener('change', importBackup);
  $('clearAllBtn').addEventListener('click', clearAll);
}

async function init() {
  db = await openDB();
  bindEvents();
  await refreshData();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
}

init().catch((error) => {
  console.error(error);
  alert('Något gick fel när vaulten startade.');
});