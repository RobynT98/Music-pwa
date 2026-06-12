const DB_NAME = "darkacademiawizard-music-vault";
const DB_VERSION = 3;
const TRACK_STORE = "tracks";
const PLAYLIST_STORE = "playlists";

let db;
let tracks = [];
let playlists = [];
let currentTrack = null;
let currentAudioUrl = null;
let currentCoverUrl = null;

const $ = id => document.getElementById(id);

const fallbackCover = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
  <rect width="800" height="800" fill="#12090b"/>
  <text x="50%" y="48%" text-anchor="middle" fill="#f0c77b" font-size="58" font-family="Georgia">DarkAcademiaWizard</text>
  <text x="50%" y="57%" text-anchor="middle" fill="#c8a996" font-size="30" font-family="Georgia">Music Vault</text>
</svg>`)}`;

function makeId() {
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(TRACK_STORE)) {
        database.createObjectStore(TRACK_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(PLAYLIST_STORE)) {
        database.createObjectStore(PLAYLIST_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function store(name, mode = "readonly") {
  return db.transaction(name, mode).objectStore(name);
}

function getAll(name) {
  return new Promise((resolve, reject) => {
    const request = store(name).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function put(name, item) {
  return new Promise((resolve, reject) => {
    const request = store(name, "readwrite").put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function remove(name, id) {
  return new Promise((resolve, reject) => {
    const request = store(name, "readwrite").delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function clear(name) {
  return new Promise((resolve, reject) => {
    const request = store(name, "readwrite").clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getCoverSource(track) {
  if (track.coverBlob) return URL.createObjectURL(track.coverBlob);
  if (track.coverDataUrl) return track.coverDataUrl;
  return fallbackCover;
}

function getAudioSource(track) {
  if (track.audioBlob) return URL.createObjectURL(track.audioBlob);
  if (track.audioDataUrl) return track.audioDataUrl;
  return "";
}

async function refreshData() {
  tracks = await getAll(TRACK_STORE);
  playlists = await getAll(PLAYLIST_STORE);

  renderTracks();
  renderPlaylists();
  renderPlaylistSelect();
}

function setActiveTab(tabId) {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  document.querySelectorAll(".panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === tabId);
  });
}

function renderTracks() {
  const grid = $("trackGrid");
  const empty = $("emptyLibrary");
  const search = $("searchInput").value.toLowerCase();
  const sort = $("sortSelect").value;

  let list = tracks.filter(track => {
    return [
      track.title,
      track.artist,
      track.category,
      track.year,
      ...(track.tags || [])
    ].join(" ").toLowerCase().includes(search);
  });

  list.sort((a, b) => {
    if (sort === "titleAsc") return (a.title || "").localeCompare(b.title || "");
    if (sort === "artistAsc") return (a.artist || "").localeCompare(b.artist || "");
    if (sort === "categoryAsc") return (a.category || "").localeCompare(b.category || "");
    if (sort === "yearDesc") return Number(b.year || 0) - Number(a.year || 0);
    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });

  grid.innerHTML = "";
  empty.classList.toggle("hidden", tracks.length > 0);

  const template = $("trackCardTemplate");

  list.forEach(track => {
    const node = template.content.cloneNode(true);

    node.querySelector(".track-cover").src = getCoverSource(track);
    node.querySelector(".track-title").textContent = track.title || "Utan titel";
    node.querySelector(".track-meta").textContent =
      `${track.artist || "Okänd artist"} • ${track.category || "Okategori"} • ${track.year || "Utan år"}`;
    node.querySelector(".track-tags").textContent =
      (track.tags || []).map(tag => `#${tag}`).join(" ");

    node.querySelector(".track-card").addEventListener("click", () => playTrack(track.id));
    grid.appendChild(node);
  });
}

function playTrack(id) {
  const track = tracks.find(t => t.id === id);
  if (!track) return;

  currentTrack = track;

  if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
  if (currentCoverUrl) URL.revokeObjectURL(currentCoverUrl);

  currentAudioUrl = getAudioSource(track);
  currentCoverUrl = getCoverSource(track);

  $("player").classList.remove("hidden");
  $("playerCover").src = currentCoverUrl;
  $("playerTitle").textContent = track.title || "Utan titel";
  $("playerMeta").textContent =
    `${track.artist || "Okänd artist"} • ${track.category || "Okategori"} • ${track.year || "Utan år"}`;

  $("audioPlayer").src = currentAudioUrl;
  $("lyricsBox").textContent = track.lyricsSuno || track.lyricsClean || "Ingen lyrics sparad ännu.";

  if (track.videoUrl) {
    $("videoLink").href = track.videoUrl;
    $("videoLink").classList.remove("hidden");
  } else {
    $("videoLink").classList.add("hidden");
  }
}

function clearForm() {
  $("trackForm").reset();
  $("trackId").value = "";
  $("formTitle").textContent = "Lägg till låt";
  $("deleteTrackBtn").classList.add("hidden");
}

function fillForm(track) {
  $("trackId").value = track.id;
  $("titleInput").value = track.title || "";
  $("artistInput").value = track.artist || "";
  $("categoryInput").value = track.category || "";
  $("yearInput").value = track.year || "";
  $("tagsInput").value = (track.tags || []).join(", ");
  $("videoInput").value = track.videoUrl || "";
  $("lyricsSunoInput").value = track.lyricsSuno || "";
  $("lyricsCleanInput").value = track.lyricsClean || "";

  $("formTitle").textContent = `Redigera: ${track.title || "Utan titel"}`;
  $("deleteTrackBtn").classList.remove("hidden");
  setActiveTab("editor");
}

async function saveTrack(event) {
  event.preventDefault();

  try {
    const id = $("trackId").value || makeId();
    const existing = tracks.find(t => t.id === id);

    const audioFile = $("audioInput").files[0];
    const coverFile = $("coverInput").files[0];

    const track = {
      id,
      title: $("titleInput").value.trim(),
      artist: $("artistInput").value.trim() || "DarkAcademiaWizard",
      category: $("categoryInput").value.trim(),
      year: $("yearInput").value ? Number($("yearInput").value) : "",
      tags: $("tagsInput").value.split(",").map(t => t.trim()).filter(Boolean),
      videoUrl: $("videoInput").value.trim(),
      lyricsSuno: $("lyricsSunoInput").value,
      lyricsClean: $("lyricsCleanInput").value,

      audioBlob: audioFile || existing?.audioBlob || null,
      coverBlob: coverFile || existing?.coverBlob || null,

      audioDataUrl: existing?.audioDataUrl || "",
      coverDataUrl: existing?.coverDataUrl || "",

      audioName: audioFile?.name || existing?.audioName || "",
      coverName: coverFile?.name || existing?.coverName || "",

      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    if (!track.title) {
      alert("Titel saknas.");
      return;
    }

    await put(TRACK_STORE, track);
    await refreshData();

    clearForm();
    playTrack(id);
    setActiveTab("library");

    alert("Låten sparades.");
  } catch (error) {
    console.error(error);
    alert("Kunde inte spara låten. Testa en mindre fil eller rensa webbplatsdata.");
  }
}

async function deleteFormTrack() {
  const id = $("trackId").value;
  if (!id) return;

  if (!confirm("Radera låten?")) return;

  await remove(TRACK_STORE, id);

  playlists = playlists.map(list => ({
    ...list,
    trackIds: list.trackIds.filter(trackId => trackId !== id)
  }));

  for (const playlist of playlists) {
    await put(PLAYLIST_STORE, playlist);
  }

  clearForm();
  $("player").classList.add("hidden");
  await refreshData();
  setActiveTab("library");
}

async function createPlaylist() {
  const name = $("playlistNameInput").value.trim();
  if (!name) return;

  await put(PLAYLIST_STORE, {
    id: makeId(),
    name,
    trackIds: [],
    createdAt: Date.now()
  });

  $("playlistNameInput").value = "";
  await refreshData();
}

function renderPlaylistSelect() {
  const select = $("addPlaylistSelect");
  select.innerHTML = "";

  if (playlists.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Ingen spellista skapad";
    select.appendChild(option);
    return;
  }

  playlists.forEach(playlist => {
    const option = document.createElement("option");
    option.value = playlist.id;
    option.textContent = playlist.name;
    select.appendChild(option);
  });
}

async function addCurrentToPlaylist() {
  if (!currentTrack) return;

  const playlist = playlists.find(p => p.id === $("addPlaylistSelect").value);
  if (!playlist) {
    alert("Skapa en spellista först.");
    return;
  }

  if (!playlist.trackIds.includes(currentTrack.id)) {
    playlist.trackIds.push(currentTrack.id);
  }

  await put(PLAYLIST_STORE, playlist);
  await refreshData();

  alert("Tillagd i spellista.");
}

function renderPlaylists() {
  const area = $("playlistArea");
  area.innerHTML = "";

  if (playlists.length === 0) {
    area.innerHTML = `<p class="empty">Inga spellistor än.</p>`;
    return;
  }

  playlists.forEach(playlist => {
    const box = document.createElement("div");
    box.className = "playlist-box";
    box.innerHTML = `<h3>${playlist.name}</h3>`;

    playlist.trackIds.forEach(trackId => {
      const track = tracks.find(t => t.id === trackId);
      if (!track) return;

      const row = document.createElement("div");
      row.className = "playlist-track";
      row.innerHTML = `
        <span>${track.title}</span>
        <button class="secondary">Spela</button>
      `;

      row.querySelector("button").addEventListener("click", () => playTrack(track.id));
      box.appendChild(row);
    });

    const del = document.createElement("button");
    del.textContent = "Radera spellista";
    del.className = "danger";
    del.addEventListener("click", async () => {
      await remove(PLAYLIST_STORE, playlist.id);
      await refreshData();
    });

    box.appendChild(del);
    area.appendChild(box);
  });
}

function blobToBase64(blob) {
  return new Promise(resolve => {
    if (!blob) return resolve("");

    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(dataUrl) {
  if (!dataUrl) return null;

  const parts = dataUrl.split(",");
  const mime = parts[0].match(/:(.*?);/)?.[1] || "application/octet-stream";
  const binary = atob(parts[1]);
  const array = [];

  for (let i = 0; i < binary.length; i++) {
    array.push(binary.charCodeAt(i));
  }

  return new Blob([new Uint8Array(array)], { type: mime });
}

async function exportBackup() {
  const exportTracks = [];

  for (const track of tracks) {
    exportTracks.push({
      ...track,
      audioBlob: undefined,
      coverBlob: undefined,
      audioBackup: await blobToBase64(track.audioBlob),
      coverBackup: await blobToBase64(track.coverBlob)
    });
  }

  const backup = {
    app: "DarkAcademiaWizard Music Vault",
    version: 3,
    exportedAt: new Date().toISOString(),
    tracks: exportTracks,
    playlists
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `darkacademiawizard-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();

  URL.revokeObjectURL(url);
}

async function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!Array.isArray(data.tracks) || !Array.isArray(data.playlists)) {
      alert("Fel backupformat.");
      return;
    }

    for (const track of data.tracks) {
      const importedTrack = {
        ...track,
        audioBlob: track.audioBackup ? base64ToBlob(track.audioBackup) : track.audioBlob || null,
        coverBlob: track.coverBackup ? base64ToBlob(track.coverBackup) : track.coverBlob || null
      };

      delete importedTrack.audioBackup;
      delete importedTrack.coverBackup;

      await put(TRACK_STORE, importedTrack);
    }

    for (const playlist of data.playlists) {
      await put(PLAYLIST_STORE, playlist);
    }

    await refreshData();
    alert("Backup importerad.");
  } catch (error) {
    console.error(error);
    alert("Kunde inte importera backup.");
  }

  event.target.value = "";
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  $("searchInput").addEventListener("input", renderTracks);
  $("sortSelect").addEventListener("change", renderTracks);
  $("trackForm").addEventListener("submit", saveTrack);
  $("newTrackBtn").addEventListener("click", clearForm);
  $("deleteTrackBtn").addEventListener("click", deleteFormTrack);

  $("editCurrentBtn").addEventListener("click", () => {
    if (currentTrack) fillForm(currentTrack);
  });

  $("showSunoBtn").addEventListener("click", () => {
    if (!currentTrack) return;
    $("lyricsBox").textContent = currentTrack.lyricsSuno || "Ingen Suno-version sparad.";
  });

  $("showCleanBtn").addEventListener("click", () => {
    if (!currentTrack) return;
    $("lyricsBox").textContent = currentTrack.lyricsClean || "Ingen ren text sparad.";
  });

  $("createPlaylistBtn").addEventListener("click", createPlaylist);
  $("addToPlaylistBtn").addEventListener("click", addCurrentToPlaylist);

  $("exportBtn").addEventListener("click", exportBackup);
  $("importInput").addEventListener("change", importBackup);

  $("clearAllBtn").addEventListener("click", async () => {
    if (!confirm("Rensa hela vaulten?")) return;
    await clear(TRACK_STORE);
    await clear(PLAYLIST_STORE);
    await refreshData();
    $("player").classList.add("hidden");
  });
}

async function init() {
  db = await openDB();
  bindEvents();
  await refreshData();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
  }
}

init().catch(error => {
  console.error(error);
  alert("Appen kunde inte starta.");
});