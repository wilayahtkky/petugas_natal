// Replace with your deployed Google Apps Script Web App URL
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxD44sLIDxWtvOPZzhyOjOoq_T8m6Ih_DIbecWsWD1oBXXpBYrRTLXpd5m9EmCL7wsURw/exec";

const DEFAULT_PICS = ["Warti", "Anik", "Helena", "Buntoro", "Ela", "Claire", "Kathrina"];

const state = {
  korona: [],
  lilin: [],
  authorized: false,
  username: "",
  password: ""
};

// DOM Elements
const filterEvent = document.getElementById("filterEvent");
const filterTanggal = document.getElementById("filterTanggal");
const filterJam = document.getElementById("filterJam");
const filterPic = document.getElementById("filterPic");
const btnResetFilter = document.getElementById("btnResetFilter");

const authBadge = document.getElementById("authBadge");
const btnToggleAuth = document.getElementById("btnToggleAuth");
const statusMessage = document.getElementById("statusMessage");
const scheduleContainer = document.getElementById("scheduleContainer");

// Modals & Combo Elements
const loginModal = document.getElementById("loginModal");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editError = document.getElementById("editError");

const editPicInput = document.getElementById("editPic");
const picComboWrapper = document.getElementById("picComboWrapper");
const btnTogglePicList = document.getElementById("btnTogglePicList");
const picDropdownList = document.getElementById("picDropdownList");

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  restoreSessionAuth();
  fetchScheduleData();
  bindEvents();
});

function restoreSessionAuth() {
  const savedUser = sessionStorage.getItem("adv_user");
  const savedPass = sessionStorage.getItem("adv_pass");
  if (savedUser && savedPass) {
    state.username = savedUser;
    state.password = savedPass;
  }
}

function bindEvents() {
  filterEvent.addEventListener("change", () => {
    populateDependentFilters();
    renderHierarchy();
  });

  filterTanggal.addEventListener("change", () => {
    populateJamFilter();
    populatePicFilter();
    renderHierarchy();
  });

  filterJam.addEventListener("change", () => {
    populatePicFilter();
    renderHierarchy();
  });

  filterPic.addEventListener("change", renderHierarchy);

  btnResetFilter.addEventListener("click", () => {
    filterEvent.value = "";
    filterTanggal.value = "";
    filterJam.value = "";
    filterPic.value = "";
    populateDependentFilters();
    renderHierarchy();
  });

  btnToggleAuth.addEventListener("click", () => {
    if (state.authorized) {
      logoutAdmin();
    } else {
      loginError.classList.add("hidden");
      loginForm.reset();
      loginModal.classList.remove("hidden");
      document.getElementById("inputUsername").focus();
    }
  });

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-close");
      document.getElementById(targetId).classList.add("hidden");
      picDropdownList.classList.add("hidden");
    });
  });

  // Custom PIC Combo Box events: show ALL PICs on focus or button click
  editPicInput.addEventListener("focus", () => {
    renderPicComboOptions(false);
    picDropdownList.classList.remove("hidden");
  });

  editPicInput.addEventListener("input", () => {
    renderPicComboOptions(true);
    picDropdownList.classList.remove("hidden");
  });

  btnTogglePicList.addEventListener("click", (e) => {
    e.preventDefault();
    if (picDropdownList.classList.contains("hidden")) {
      renderPicComboOptions(false);
      picDropdownList.classList.remove("hidden");
      editPicInput.focus();
    } else {
      picDropdownList.classList.add("hidden");
    }
  });

  document.addEventListener("click", (e) => {
    if (picComboWrapper && !picComboWrapper.contains(e.target)) {
      picDropdownList.classList.add("hidden");
    }
  });

  loginForm.addEventListener("submit", handleLoginSubmit);
  editForm.addEventListener("submit", handleEditSubmit);
}

function getAvailablePicOptions() {
  const sheetPics = getAllCombinedRows().map((r) => r.pic).filter(Boolean);
  return Array.from(new Set([...DEFAULT_PICS, ...sheetPics])).sort((a, b) =>
    a.localeCompare(b, "id", { sensitivity: "base" })
  );
}

function renderPicComboOptions(filterByTyping = false) {
  const allPics = getAvailablePicOptions();
  const query = editPicInput.value.trim().toLowerCase();

  const listToShow = filterByTyping && query
    ? allPics.filter((p) => p.toLowerCase().includes(query))
    : allPics;

  if (listToShow.length === 0) {
    picDropdownList.classList.add("hidden");
    return;
  }

  picDropdownList.innerHTML = listToShow.map((pic) => {
    const isCurrent = pic.toLowerCase() === query;
    return `<li role="option" class="${isCurrent ? "active" : ""}" data-pic="${escapeHtml(pic)}">${escapeHtml(pic)}</li>`;
  }).join("");

  picDropdownList.querySelectorAll("li").forEach((li) => {
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      editPicInput.value = li.getAttribute("data-pic");
      picDropdownList.classList.add("hidden");
    });
  });
}

function showStatus(msg, type = "") {
  statusMessage.textContent = msg;
  statusMessage.className = "status-banner" + (type ? ` ${type}` : "");
  statusMessage.classList.remove("hidden");
  if (type === "success") {
    setTimeout(() => statusMessage.classList.add("hidden"), 4000);
  }
}

function hideStatus() {
  statusMessage.classList.add("hidden");
}

async function fetchScheduleData() {
  showStatus("Memuat jadwal dari Google Sheets...");
  try {
    const url = new URL(GAS_WEB_APP_URL);
    url.searchParams.set("action", "getData");
    if (state.username && state.password) {
      url.searchParams.set("username", state.username);
      url.searchParams.set("password", state.password);
    }

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== "success") {
      throw new Error(data.message || "Gagal mengambil data.");
    }

    state.korona = data.korona || [];
    state.lilin = data.lilin || [];
    state.authorized = Boolean(data.authorized);

    if (!state.authorized && (state.username || state.password)) {
      state.username = "";
      state.password = "";
      sessionStorage.removeItem("adv_user");
      sessionStorage.removeItem("adv_pass");
    }

    updateAuthUI();
    populateEventFilter();
    populateDependentFilters();
    renderHierarchy();
    hideStatus();
  } catch (err) {
    showStatus("Terjadi kesalahan saat memuat data: " + err.message, "error");
  }
}

function updateAuthUI() {
  if (state.authorized) {
    authBadge.textContent = "Mode Edit Aktif (buntoro)";
    authBadge.className = "auth-badge unlocked";
    btnToggleAuth.textContent = "Logout";
  } else {
    authBadge.textContent = "Mode Publik";
    authBadge.className = "auth-badge locked";
    btnToggleAuth.textContent = "Kelola";
  }
}

function logoutAdmin() {
  state.authorized = false;
  state.username = "";
  state.password = "";
  sessionStorage.removeItem("adv_user");
  sessionStorage.removeItem("adv_pass");
  fetchScheduleData();
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById("inputUsername").value.trim();
  const password = document.getElementById("inputPassword").value.trim();
  const btnSubmit = document.getElementById("btnSubmitLogin");

  btnSubmit.disabled = true;
  btnSubmit.textContent = "Memeriksa...";
  loginError.classList.add("hidden");

  try {
    const url = new URL(GAS_WEB_APP_URL);
    url.searchParams.set("action", "login");
    url.searchParams.set("username", username);
    url.searchParams.set("password", password);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.authorized) {
      state.username = username;
      state.password = password;
      sessionStorage.setItem("adv_user", username);
      sessionStorage.setItem("adv_pass", password);
      loginModal.classList.add("hidden");
      await fetchScheduleData();
      showStatus("Login berhasil. Nomor telepon dan tombol edit telah dibuka.", "success");
    } else {
      loginError.textContent = data.message || "Username atau password salah.";
      loginError.classList.remove("hidden");
    }
  } catch (err) {
    loginError.textContent = "Gagal menghubungi server: " + err.message;
    loginError.classList.remove("hidden");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Masuk";
  }
}

function getAllCombinedRows() {
  return [...state.korona, ...state.lilin];
}

function sortEvents(events) {
  const order = ["Adven I", "Adven II", "Adven III", "Adven IV"];
  return events.sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

function formatEventHeading(ev) {
  if (/^adven\s+/i.test(ev)) {
    return `Minggu ${ev}`;
  }
  return ev;
}

function populateEventFilter() {
  const currentVal = filterEvent.value;
  const events = sortEvents(Array.from(new Set(getAllCombinedRows().map((r) => r.event).filter(Boolean))));

  filterEvent.innerHTML = `<option value="">Semua Minggu Adven</option>`;
  events.forEach((ev) => {
    const opt = document.createElement("option");
    opt.value = ev;
    opt.textContent = formatEventHeading(ev);
    filterEvent.appendChild(opt);
  });

  if (events.includes(currentVal)) {
    filterEvent.value = currentVal;
  }
}

function populateDependentFilters() {
  const selectedEvent = filterEvent.value;
  const currentTanggal = filterTanggal.value;

  const filteredByEvent = getAllCombinedRows().filter((r) => !selectedEvent || r.event === selectedEvent);
  const dates = Array.from(new Set(filteredByEvent.map((r) => r.tanggal).filter(Boolean)));

  filterTanggal.innerHTML = `<option value="">Semua Tanggal</option>`;
  dates.forEach((tgl) => {
    const opt = document.createElement("option");
    opt.value = tgl;
    opt.textContent = tgl;
    filterTanggal.appendChild(opt);
  });

  if (dates.includes(currentTanggal)) {
    filterTanggal.value = currentTanggal;
  } else {
    filterTanggal.value = "";
  }

  populateJamFilter();
  populatePicFilter();
}

function populateJamFilter() {
  const selectedEvent = filterEvent.value;
  const selectedTanggal = filterTanggal.value;
  const currentJam = filterJam.value;

  const matchingRows = getAllCombinedRows().filter((r) => {
    const matchEv = !selectedEvent || r.event === selectedEvent;
    const matchTgl = !selectedTanggal || r.tanggal === selectedTanggal;
    return matchEv && matchTgl;
  });

  const times = Array.from(new Set(matchingRows.map((r) => r.jam).filter(Boolean))).sort();

  filterJam.innerHTML = `<option value="">Semua Jam Misa</option>`;
  times.forEach((jam) => {
    const opt = document.createElement("option");
    opt.value = jam;
    opt.textContent = jam;
    filterJam.appendChild(opt);
  });

  if (times.includes(currentJam)) {
    filterJam.value = currentJam;
  } else {
    filterJam.value = "";
  }
}

function populatePicFilter() {
  const selectedEvent = filterEvent.value;
  const selectedTanggal = filterTanggal.value;
  const selectedJam = filterJam.value;
  const currentPic = filterPic.value;

  const matchingRows = getAllCombinedRows().filter((r) => {
    const matchEv = !selectedEvent || r.event === selectedEvent;
    const matchTgl = !selectedTanggal || r.tanggal === selectedTanggal;
    const matchJam = !selectedJam || r.jam === selectedJam;
    return matchEv && matchTgl && matchJam;
  });

  const pics = Array.from(new Set(matchingRows.map((r) => r.pic).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "id", { sensitivity: "base" })
  );

  filterPic.innerHTML = `<option value="">Semua PIC</option>`;
  pics.forEach((pic) => {
    const opt = document.createElement("option");
    opt.value = pic;
    opt.textContent = pic;
    filterPic.appendChild(opt);
  });

  if (pics.includes(currentPic)) {
    filterPic.value = currentPic;
  } else {
    filterPic.value = "";
  }
}

function hasActiveFilter() {
  return Boolean(filterEvent.value || filterTanggal.value || filterJam.value || filterPic.value);
}

function filterRow(row) {
  const ev = filterEvent.value;
  const tgl = filterTanggal.value;
  const jam = filterJam.value;
  const pic = filterPic.value;

  if (ev && row.event !== ev) return false;
  if (tgl && row.tanggal !== tgl) return false;
  if (jam && row.jam !== jam) return false;
  if (pic && String(row.pic || "").toLowerCase() !== pic.toLowerCase()) return false;
  return true;
}

function formatWaLink(phone, labelPrefix = "") {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  const waNum = digits.startsWith("0") ? "62" + digits.slice(1) : digits;
  const label = labelPrefix ? `${labelPrefix}: ${escapeHtml(phone)}` : escapeHtml(phone);
  return `<a class="phone-link" href="https://wa.me/${waNum}" target="_blank" rel="noopener">${label}</a>`;
}

function renderHierarchy() {
  const koronaFiltered = state.korona.filter(filterRow);
  const lilinFiltered = state.lilin.filter(filterRow);

  const tree = new Map();

  function ensureSlot(eventName, tanggal, jam) {
    const evKey = eventName || "Lainnya";
    const tglKey = tanggal || "Tanpa Tanggal";
    const jamKey = jam || "Tanpa Jam";

    if (!tree.has(evKey)) {
      tree.set(evKey, {
        pics: new Set(),
        dates: new Map()
      });
    }
    const evNode = tree.get(evKey);

    if (!evNode.dates.has(tglKey)) {
      evNode.dates.set(tglKey, new Map());
    }
    const tglNode = evNode.dates.get(tglKey);

    if (!tglNode.has(jamKey)) {
      tglNode.set(jamKey, { korona: [], lilin: [] });
    }
    return { evNode, slot: tglNode.get(jamKey) };
  }

  koronaFiltered.forEach((row) => {
    const { evNode, slot } = ensureSlot(row.event, row.tanggal, row.jam);
    if (row.pic) evNode.pics.add(row.pic);
    slot.korona.push(row);
  });

  lilinFiltered.forEach((row) => {
    const { evNode, slot } = ensureSlot(row.event, row.tanggal, row.jam);
    if (row.pic) evNode.pics.add(row.pic);
    slot.lilin.push(row);
  });

  if (tree.size === 0) {
    scheduleContainer.innerHTML = `<div class="empty-state">Tidak ada jadwal petugas yang sesuai dengan filter ini.</div>`;
    return;
  }

  const sortedEventKeys = sortEvents(Array.from(tree.keys()));
  // Minimized by default on initial open; auto-expanded if a filter is active
  const eventOpenAttr = hasActiveFilter() ? " open" : "";

  scheduleContainer.innerHTML = sortedEventKeys.map((evKey) => {
    const evNode = tree.get(evKey);
    const picChips = Array.from(evNode.pics)
      .sort()
      .map((p) => `<span class="event-pic-chip">${escapeHtml(p)}</span>`)
      .join("");

    const picSummaryHtml = picChips
      ? `<div class="event-pic-summary"><span class="event-pic-label">PIC Event:</span>${picChips}</div>`
      : "";

    const datesHtml = Array.from(evNode.dates.entries()).map(([tglKey, jamMap]) => {
      const sortedJams = Array.from(jamMap.keys()).sort();

      const jamsHtml = sortedJams.map((jamKey) => {
        const slot = jamMap.get(jamKey);

        const koronaPics = Array.from(new Set(slot.korona.map((r) => r.pic).filter(Boolean)));
        const koronaPicBadges = koronaPics
          .map((p) => `<span class="pic-badge">PIC: ${escapeHtml(p)}</span>`)
          .join("");

        return `
          <details class="jam-box" open>
            <summary class="jam-header">
              <div class="jam-title-row">
                <span class="chevron">&#9654;</span>
                <span class="jam-badge">Misa Pukul ${escapeHtml(jamKey)} WIB</span>
              </div>
              <span class="jam-summary-counts">Korona: ${slot.korona.length} &bull; Penyala Lilin: ${slot.lilin.length}</span>
            </summary>
            <div class="jam-body">
              <div class="role-split-grid">
                <!-- Sub-container: Korona -->
                <div class="role-panel korona">
                  <div class="role-panel-header">
                    <span>Petugas Korona</span>
                    <div class="korona-header-right">
                      ${koronaPicBadges}
                      <span class="role-count">${slot.korona.length} petugas</span>
                    </div>
                  </div>
                  <div class="role-list">
                    ${renderKoronaCards(slot.korona, koronaPics.length > 1)}
                  </div>
                </div>

                <!-- Sub-container: Penyala Lilin -->
                <div class="role-panel lilin">
                  <div class="role-panel-header">
                    <span>Pasutri Penyala Lilin</span>
                    <span class="role-count">${slot.lilin.length} pasutri</span>
                  </div>
                  <div class="role-list">
                    ${renderLilinCards(slot.lilin)}
                  </div>
                </div>
              </div>
            </div>
          </details>
        `;
      }).join("");

      return `
        <details class="date-box" open>
          <summary class="date-header">
            <div class="date-title-row">
              <span class="chevron">&#9654;</span>
              <h3>${escapeHtml(tglKey)}</h3>
            </div>
            <span class="date-meta-pill">${sortedJams.length} jadwal misa</span>
          </summary>
          <div class="date-body">
            ${jamsHtml}
          </div>
        </details>
      `;
    }).join("");

    return `
      <details class="event-box"${eventOpenAttr}>
        <summary class="event-header">
          <div class="event-title-row">
            <span class="chevron">&#9654;</span>
            <h2>${escapeHtml(formatEventHeading(evKey))}</h2>
          </div>
          ${picSummaryHtml}
        </summary>
        <div class="event-body">
          ${datesHtml}
        </div>
      </details>
    `;
  }).join("");
}

function renderKoronaCards(items, hasMixedPics = false) {
  if (!items || items.length === 0) {
    return `<div class="role-empty">Tidak ada jadwal Korona pada jam ini.</div>`;
  }

  return items.map((r) => {
    const originParts = [r.wilayah, r.lingkungan].filter(Boolean).map(escapeHtml).join(" &bull; ");
    const editBtn = state.authorized
      ? `<button type="button" class="btn btn-edit" onclick="openEditModal('jadwalkorona', ${r.rowIndex})">Edit</button>`
      : "";
    const phoneHtml = state.authorized && r.wa ? formatWaLink(r.wa, "WA") : "";
    const picHtml = hasMixedPics ? `<span class="pic-badge">PIC: ${escapeHtml(r.pic || "-")}</span>` : "";

    const metaRow = (picHtml || phoneHtml)
      ? `<div class="officer-meta">${picHtml}${phoneHtml}</div>`
      : "";

    return `
      <div class="officer-card">
        <div class="officer-top">
          <div>
            <div class="officer-origin">${originParts || "-"}</div>
            <div class="officer-name">${escapeHtml(r.namaPetugas || "(Belum diisi)")}</div>
          </div>
          ${editBtn}
        </div>
        ${metaRow}
      </div>
    `;
  }).join("");
}

function renderLilinCards(items) {
  if (!items || items.length === 0) {
    return `<div class="role-empty">Tidak ada jadwal Penyala Lilin pada jam ini.</div>`;
  }

  return items.map((r) => {
    const editBtn = state.authorized
      ? `<button type="button" class="btn btn-edit" onclick="openEditModal('jadwalpenyalalilin', ${r.rowIndex})">Edit</button>`
      : "";

    const suamiPhone = state.authorized && r.noSuami ? formatWaLink(r.noSuami, "Suami") : "";
    const istriPhone = state.authorized && r.noIstri ? formatWaLink(r.noIstri, "Istri") : "";
    const phonesWrap = (suamiPhone || istriPhone)
      ? `<div style="display:flex;flex-wrap:wrap;gap:0.35rem;">${suamiPhone}${istriPhone}</div>`
      : "";

    return `
      <div class="officer-card">
        <div class="officer-top">
          <div style="width:100%;">
            <div class="officer-origin">${escapeHtml(r.asalPetugas || "-")}</div>
            <div class="couple-names">
              <div class="couple-row">
                <span class="role-tag">Suami</span>
                <strong>${escapeHtml(r.namaSuami || "(Belum diisi)")}</strong>
              </div>
              <div class="couple-row">
                <span class="role-tag">Istri</span>
                <strong>${escapeHtml(r.namaIstri || "(Belum diisi)")}</strong>
              </div>
            </div>
          </div>
          ${editBtn}
        </div>
        <div class="officer-meta">
          <span class="pic-badge">PIC: ${escapeHtml(r.pic || "-")}</span>
          ${phonesWrap}
        </div>
      </div>
    `;
  }).join("");
}

window.openEditModal = function (sheetName, rowIndex) {
  if (!state.authorized) return;

  editError.classList.add("hidden");
  picDropdownList.classList.add("hidden");
  document.getElementById("editSheet").value = sheetName;
  document.getElementById("editRowIndex").value = rowIndex;

  const koronaFields = document.getElementById("koronaFields");
  const lilinFields = document.getElementById("lilinFields");
  const contextBox = document.getElementById("editContextInfo");

  if (sheetName === "jadwalkorona") {
    const row = state.korona.find((r) => r.rowIndex === rowIndex);
    if (!row) return;

    document.getElementById("editModalTitle").textContent = "Edit Petugas Korona";
    contextBox.innerHTML = `<strong>${escapeHtml(formatEventHeading(row.event))}</strong> &bull; ${escapeHtml(row.tanggal)} (${escapeHtml(row.jam)})<br>${escapeHtml(row.wilayah)} - ${escapeHtml(row.lingkungan)}`;

    koronaFields.classList.remove("hidden");
    lilinFields.classList.add("hidden");

    document.getElementById("editNamaPetugas").value = row.namaPetugas;
    document.getElementById("editWa").value = row.wa;
    editPicInput.value = row.pic;
  } else {
    const row = state.lilin.find((r) => r.rowIndex === rowIndex);
    if (!row) return;

    document.getElementById("editModalTitle").textContent = "Edit Pasutri Penyala Lilin";
    contextBox.innerHTML = `<strong>${escapeHtml(formatEventHeading(row.event))}</strong> &bull; ${escapeHtml(row.tanggal)} (${escapeHtml(row.jam)})<br>Asal: ${escapeHtml(row.asalPetugas)}`;

    koronaFields.classList.add("hidden");
    lilinFields.classList.remove("hidden");

    document.getElementById("editNamaSuami").value = row.namaSuami;
    document.getElementById("editNamaIstri").value = row.namaIstri;
    document.getElementById("editNoSuami").value = row.noSuami;
    document.getElementById("editNoIstri").value = row.noIstri;
    editPicInput.value = row.pic;
  }

  editModal.classList.remove("hidden");
};

async function handleEditSubmit(e) {
  e.preventDefault();
  const btnSave = document.getElementById("btnSaveEdit");
  btnSave.disabled = true;
  btnSave.textContent = "Menyimpan...";
  editError.classList.add("hidden");
  picDropdownList.classList.add("hidden");

  const sheet = document.getElementById("editSheet").value;
  const rowIndex = parseInt(document.getElementById("editRowIndex").value, 10);

  const payload = {
    username: state.username,
    password: state.password,
    sheet: sheet,
    rowIndex: rowIndex,
    pic: editPicInput.value.trim()
  };

  if (sheet === "jadwalkorona") {
    payload.namaPetugas = document.getElementById("editNamaPetugas").value.trim();
    payload.wa = document.getElementById("editWa").value.trim();
  } else {
    payload.namaSuami = document.getElementById("editNamaSuami").value.trim();
    payload.namaIstri = document.getElementById("editNamaIstri").value.trim();
    payload.noSuami = document.getElementById("editNoSuami").value.trim();
    payload.noIstri = document.getElementById("editNoIstri").value.trim();
  }

  try {
    const res = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === "success") {
      editModal.classList.add("hidden");
      await fetchScheduleData();
      showStatus(data.message || "Perubahan berhasil disimpan.", "success");
    } else {
      editError.textContent = data.message || "Gagal menyimpan perubahan.";
      editError.classList.remove("hidden");
    }
  } catch (err) {
    editError.textContent = "Gagal menghubungi server: " + err.message;
    editError.classList.remove("hidden");
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = "Simpan Perubahan";
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}