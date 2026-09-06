import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
getStorage(app);
getAuth(app);

const gallery = document.getElementById("firebaseGallery");

// Har user ka ek unique ID — localStorage mein save hoga
function getUserId() {
  let uid = localStorage.getItem("smartalone_uid");
  if (!uid) {
    uid = "user_" + Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem("smartalone_uid", uid);
  }
  return uid;
}

// Like toggle — Firestore mein save hoga
window.toggleLike = async function(btn) {
  const postId = btn.dataset.postId;
  if (!postId) return;

  const userId = getUserId();
  const likeRef = doc(db, "likes", postId + "_" + userId);
  const postRef = doc(db, "likes_count", postId);

  const alreadyLiked = btn.dataset.liked === "true";

  // UI turant update (optimistic)
  btn.disabled = true;
  const countEl = btn.querySelector(".like-count");
  let current = parseInt(countEl.textContent) || 0;

  if (alreadyLiked) {
    btn.dataset.liked = "false";
    btn.classList.remove("liked");
    countEl.textContent = Math.max(0, current - 1);
    // Firestore se unlike
    await setDoc(likeRef, { liked: false, userId, postId });
    await updateDoc(postRef, { count: increment(-1) }).catch(() =>
      setDoc(postRef, { count: 0 })
    );
  } else {
    btn.dataset.liked = "true";
    btn.classList.add("liked");
    countEl.textContent = current + 1;
    btn.style.transform = "scale(1.2)";
    setTimeout(() => btn.style.transform = "", 200);
    // Firestore mein like save karo
    await setDoc(likeRef, { liked: true, userId, postId });
    await updateDoc(postRef, { count: increment(1) }).catch(() =>
      setDoc(postRef, { count: 1 })
    );
  }

  btn.disabled = false;
};

// Kisi bhi post ke liye like button setup karo
async function setupLikeBtn(btn, postId) {
  btn.dataset.postId = postId;
  const userId = getUserId();

  // User ne pehle like kiya tha?
  const likeRef = doc(db, "likes", postId + "_" + userId);
  const likeSnap = await getDoc(likeRef);
  if (likeSnap.exists() && likeSnap.data().liked) {
    btn.dataset.liked = "true";
    btn.classList.add("liked");
  }

  // Real-time like count sunna
  const postRef = doc(db, "likes_count", postId);
  onSnapshot(postRef, snap => {
    const count = snap.exists() ? (snap.data().count || 0) : 0;
    btn.querySelector(".like-count").textContent = Math.max(0, count);
  });
}

// Static cards ke liye (index.html mein hardcoded)
document.querySelectorAll(".card-like[data-post-id]").forEach(btn => {
  setupLikeBtn(btn, btn.dataset.postId);
});
document.querySelectorAll(".hero-like[data-post-id]").forEach(btn => {
  setupLikeBtn(btn, btn.dataset.postId);
});

// ── HTML escape ──
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[ch]));
}

// ── Firebase se aane wale cards ──
function createCard(postId, post) {
  const card = document.createElement("div");
  card.className = "gallery-card";

  const title = escapeHTML(post.title || "New Frame");
  const tag   = escapeHTML(post.tag   || "#smartalone");
  const type  = post.mediaType === "video" ? "Video" : "Photo";
  const date  = post.createdAt?.toDate
    ? post.createdAt.toDate().toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })
    : "2026";

  const media = post.mediaType === "video"
    ? `<video src="${post.mediaUrl}" controls playsinline preload="metadata"></video>`
    : `<img src="${post.mediaUrl}" alt="${title}" loading="lazy">`;

  card.innerHTML = `
    ${media}
    <div class="card-overlay">
      <h3>${title}</h3>
      <div class="card-meta">${type} · ${date}</div>
      <span class="card-tag">${tag}</span>
    </div>
    <button class="like-btn card-like" onclick="toggleLike(this)" aria-label="Like">
      <i class="fas fa-heart"></i>
      <span class="like-count">0</span>
    </button>
  `;

  // Like button setup
  const likeBtn = card.querySelector(".card-like");
  setupLikeBtn(likeBtn, postId);

  return card;
}

// Real-time posts listener
const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));
onSnapshot(postsQuery, snapshot => {
  gallery.replaceChildren();
  snapshot.forEach(docSnap => {
    gallery.appendChild(createCard(docSnap.id, docSnap.data()));
  });
}, error => {
  console.error("Firebase posts error:", error);
});

// CSS auto-refresh
setInterval(() => {
  document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    if (!link.href.includes("cdnjs") && !link.href.includes("fonts")) {
      link.href = link.href.split("?")[0] + "?t=" + Date.now();
    }
  });
}, 30000);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      if (!link.href.includes("cdnjs") && !link.href.includes("fonts")) {
        link.href = link.href.split("?")[0] + "?t=" + Date.now();
      }
    });
  }
});
