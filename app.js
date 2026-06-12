let tracks = [];
let currentTrack = null;

const trackList = document.getElementById("trackList");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");

const playerSection = document.getElementById("playerSection");
const currentTitle = document.getElementById("currentTitle");
const currentCover = document.getElementById("currentCover");
const audioPlayer = document.getElementById("audioPlayer");
const videoLink = document.getElementById("videoLink");
const lyricsBox = document.getElementById("lyricsBox");

const addPlaylistBtn = document.getElementById("addPlaylistBtn");
const playlistList = document.getElementById("playlistList");

async function loadTracks() {
  const response = await fetch("tracks.json");
  tracks = await response.json();
  renderTracks();
  renderPlaylist();
}

function renderTracks() {
  const search = searchInput.value.toLowerCase();
  const sortBy = sortSelect.value;

  let filtered = tracks.filter(track => {
    const searchText = [
      track.title,
      track.artist,
      track.category,
      track.year,
      ...(track.tags || [])
    ].join(" ").toLowerCase();

    return searchText.includes(search);
  });

  filtered.sort((a, b) => {
    return String(a[sortBy]).localeCompare(String(b[sortBy]));
  });

  trackList.innerHTML = "";

  filtered.forEach(track => {
    const card = document.createElement("div");
    card.className = "track-card";

    card.innerHTML = `
      <img src="${track.cover}" alt="${track.title}">
      <h3>${track.title}</h3>
      <p>${track.artist}</p>
      <small>${track.category} • ${track.year}</small>
    `;

    card.addEventListener("click", () => playTrack(track));
    trackList.appendChild(card);
  });
}

function playTrack(track) {
  currentTrack = track;

  playerSection.classList.remove("hidden");
  currentTitle.textContent = `${track.title} - ${track.artist}`;
  currentCover.src = track.cover;
  audioPlayer.src = track.audio;

  if (track.video) {
    videoLink.href = track.video;
    videoLink.style.display = "inline";
  } else {
    videoLink.style.display = "none";
  }

  lyricsBox.textContent = "";
}

async function loadLyrics(type) {
  if (!currentTrack) return;

  const lyricsPath =
    type === "suno" ? currentTrack.lyricsSuno : currentTrack.lyricsClean;

  const response = await fetch(lyricsPath);
  const text = await response.text();

  lyricsBox.textContent = text;
}

function getPlaylist() {
  return JSON.parse(localStorage.getItem("playlist")) || [];
}

function savePlaylist(playlist) {
  localStorage.setItem("playlist", JSON.stringify(playlist));
}

function addToPlaylist() {
  if (!currentTrack) return;

  const playlist = getPlaylist();

  if (!playlist.includes(currentTrack.id)) {
    playlist.push(currentTrack.id);
    savePlaylist(playlist);
    renderPlaylist();
  }
}

function renderPlaylist() {
  const playlist = getPlaylist();
  playlistList.innerHTML = "";

  playlist.forEach(id => {
    const track = tracks.find(t => t.id === id);
    if (!track) return;

    const li = document.createElement("li");
    li.textContent = track.title;
    li.addEventListener("click", () => playTrack(track));
    playlistList.appendChild(li);
  });
}

searchInput.addEventListener("input", renderTracks);
sortSelect.addEventListener("change", renderTracks);

document.getElementById("showSunoLyrics").addEventListener("click", () => {
  loadLyrics("suno");
});

document.getElementById("showCleanLyrics").addEventListener("click", () => {
  loadLyrics("clean");
});

addPlaylistBtn.addEventListener("click", addToPlaylist);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

loadTracks();