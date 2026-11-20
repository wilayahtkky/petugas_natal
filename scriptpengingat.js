const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwDsAI2Wjk69VAe2EJ0plZhuUBaBext_CKQFCQJypJzn4hg5eAwHhiNx0MocB41JVRN/exec";

let appData = {
  authorized: false,
  pic: "",
  korona: [],
  lilin: []
};

let savedPic = sessionStorage.getItem("adven_pic_name") || "";
let savedPassword = sessionStorage.getItem("adven_pic_pass") || "";

// Helper: Format Tanggal menjadi Hari & Tanggal Indonesia (contoh: "28 Nov 2026" -> Sabtu, 28 Nov 2026)
function parseIndoDateInfo(tanggalStr) {
  const monthMap = {
    jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4,
    jun: 5, jul: 6, agu: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11
  };
  const dayNames = ["Minggu,", "Senin,", "Selasa,", "Rabu,", "Kamis,", "Jumat,", "Sabtu,"];

  const parts = tanggalStr.trim().split(/[\s-]+/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const monKey = parts[1].toLowerCase().slice(0, 3);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;

    if (!isNaN(day) && monthMap[monKey] !== undefined && !isNaN(year)) {
      const dt = new Date(year, monthMap[monKey], day);
      const dayIdx = dt.getDay();
      return {
        hari: dayNames[dayIdx],
        tanggalDisplay: tanggalStr,
        cssClass: dayIdx === 6 ? "day-sabtu" : "day-minggu"
      };
    }
  }

  return { hari: "", tanggalDisplay: tanggalStr, cssClass: "day-minggu" };
}

function getShortWilayahLabel(wilayah) {
  const aliases = {
    "St. Theresia dari Kanak Kanak Yesus": "St. Theresia dKKY",
    "Santa Perawan Maria Ratu Rosari": "SPM Ratu Rosari"
  };
  return aliases[wilayah] || wilayah;
}

function formatWaHref(rawPhone) {
  const digits = (rawPhone || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  const waNum = digits.startsWith("0") ? "62" + digits.slice(1) : digits;
  return `https://wa.me/${waNum}`;
}

// Fetch data khusus PIC dari Google Apps Script
async function fetchPicScheduleData(picName, password, isFromForm = false) {
  const loader = document.getElementById("loaderBox");
  const mainContent = document.getElementById("mainContent");
  const loginCard = document.getElementById("loginCard");
  const picStatusBar = document.getElementById("picStatusBar");
  const errorText = document.getElementById("passErrorText");
  const submitBtn = document.getElementById("submitLoginBtn");

  if (!picName || !password) {
    showLoginScreen();
    return;
  }

  if (isFromForm) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Memeriksa...";
    errorText.classList.add("hidden");
  } else {
    loginCard.classList.add("hidden");
    loader.classList.remove("hidden");
  }

  try {
    const url = `${GAS_WEB_APP_URL}?pic=${encodeURIComponent(picName)}&password=${encodeURIComponent(password)}`;
    const response = await fetch(url);
    const json = await response.json();

    if (json.status === "success" && json.authorized) {
      appData = json;
      savedPic = picName;
      savedPassword = password;
      sessionStorage.setItem("adven_pic_name", picName);
      sessionStorage.setItem("adven_pic_pass", password);

      document.getElementById("activePicName").textContent = picName;
      loginCard.classList.add("hidden");
      picStatusBar.classList.remove("hidden");
      mainContent.classList.remove("hidden");

      renderKoronaTable(json.korona || []);
      renderLilinAccordions(json.lilin || []);
    } else {
      // Gagal login / password salah
      sessionStorage.removeItem("adven_pic_name");
      sessionStorage.removeItem("adven_pic_pass");
      showLoginScreen();
      if (isFromForm) {
        errorText.classList.remove("hidden");
      }
    }
  } catch (err) {
    console.error("Error memuat data PIC:", err);
    alert("Gagal menghubungi server. Periksa koneksi internet Anda.");
    if (!appData.authorized) showLoginScreen();
  } finally {
    loader.classList.add("hidden");
    if (isFromForm) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Masuk & Lihat Jadwal";
    }
  }
}

function showLoginScreen() {
  document.getElementById("loginCard").classList.remove("hidden");
  document.getElementById("picStatusBar").classList.add("hidden");
  document.getElementById("mainContent").classList.add("hidden");
  document.getElementById("loaderBox").classList.add("hidden");
}

// ==========================================
// 1. RENDER JADWAL PERARAKAN KORONA (FILTERED BY PIC)
// ==========================================
function renderKoronaTable(rows) {
  const tbody = document.getElementById("koronaTableBody");
  const countBadge = document.getElementById("koronaCountBadge");
  const emptyMsg = document.getElementById("koronaEmptyMsg");
  const tableWrapper = document.getElementById("koronaTableWrapper");

  tbody.innerHTML = "";
  countBadge.textContent = rows.length;

  if (rows.length === 0) {
    emptyMsg.classList.remove("hidden");
    tableWrapper.classList.add("hidden");
    return;
  }

  emptyMsg.classList.add("hidden");
  tableWrapper.classList.remove("hidden");

  // Group: Tanggal -> Jam -> Wilayah
  const dateGroups = [];
  rows.forEach((row) => {
    let dateObj = dateGroups.find((d) => d.tanggal === row.tanggal);
    if (!dateObj) {
      const meta = parseIndoDateInfo(row.tanggal);
      dateObj = {
        tanggal: row.tanggal,
        hari: meta.hari,
        tanggalDisplay: meta.tanggalDisplay,
        cssClass: meta.cssClass,
        jams: [],
        totalWilayahRows: 0
      };
      dateGroups.push(dateObj);
    }

    let jamObj = dateObj.jams.find((j) => j.jam === row.jam);
    if (!jamObj) {
      jamObj = { jam: row.jam, wilayahs: [] };
      dateObj.jams.push(jamObj);
    }

    let wilObj = jamObj.wilayahs.find((w) => w.wilayah === row.wilayah);
    if (!wilObj) {
      wilObj = {
        wilayah: row.wilayah,
        displayWilayah: getShortWilayahLabel(row.wilayah),
        items: []
      };
      jamObj.wilayahs.push(wilObj);
      dateObj.totalWilayahRows += 1;
    }

    wilObj.items.push({
      lingkungan: row.lingkungan,
      petugas: row.petugas || "-",
      wa: row.wa || ""
    });
  });

  dateGroups.forEach((dateGroup) => {
    let isFirstDateRow = true;

    dateGroup.jams.forEach((jamGroup) => {
      let isFirstJamRow = true;

      jamGroup.wilayahs.forEach((wilGroup) => {
        const tr = document.createElement("tr");
        if (isFirstDateRow) tr.classList.add("new-date");
        else if (isFirstJamRow) tr.classList.add("new-jam");

        if (isFirstDateRow) {
          const tdHari = document.createElement("td");
          tdHari.rowSpan = dateGroup.totalWilayahRows;
          tdHari.className = `cell-hari ${dateGroup.cssClass}`;
          tdHari.innerHTML = `${dateGroup.hari}<br>${dateGroup.tanggalDisplay}`;
          tr.appendChild(tdHari);
          isFirstDateRow = false;
        }

        if (isFirstJamRow) {
          const tdJam = document.createElement("td");
          tdJam.rowSpan = jamGroup.wilayahs.length;
          tdJam.className = `cell-jam ${dateGroup.cssClass}`;
          tdJam.textContent = `Pk ${jamGroup.jam.replace(":", ".")}`;
          tr.appendChild(tdJam);
          isFirstJamRow = false;
        }

        const tdWil = document.createElement("td");
        tdWil.className = `cell-clickable ${dateGroup.cssClass}`;
        tdWil.textContent = `${wilGroup.displayWilayah} (${wilGroup.items.length} lingk.)`;
        tdWil.addEventListener("click", () => {
          openKoronaModal(dateGroup, jamGroup.jam, wilGroup);
        });
        tr.appendChild(tdWil);

        tbody.appendChild(tr);
      });
    });
  });
}

function openKoronaModal(dateGroup, jam, wilGroup) {
  const modalBadge = document.getElementById("modalBadge");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");

  modalBadge.textContent = `${dateGroup.hari} ${dateGroup.tanggalDisplay} • Pk ${jam.replace(":", ".")}`;
  modalTitle.textContent = `Wilayah ${wilGroup.wilayah} (${wilGroup.items.length} lingk.)`;

  modalBody.innerHTML = wilGroup.items
    .map((item, idx) => {
      const phoneHtml = item.wa
        ? `<a class="phone-link" href="${formatWaHref(item.wa)}" target="_blank" rel="noopener">📞 ${item.wa}</a>`
        : `<span class="phone-empty">No. HP kosong</span>`;

      return `
        <div class="detail-item">
          <div class="detail-title">${idx + 1}. Lingk. ${item.lingkungan}</div>
          <div class="person-row">
            <span>Petugas: <strong>${item.petugas}</strong></span>
            ${phoneHtml}
          </div>
        </div>
      `;
    })
    .join("");

  showDetailModal();
}

// ==========================================
// 2. RENDER JADWAL PENYALA LILIN ADVEN (FILTERED BY PIC)
// ==========================================
function renderLilinAccordions(rows) {
  const container = document.getElementById("lilinSubAccordions");
  const countBadge = document.getElementById("lilinCountBadge");
  const emptyMsg = document.getElementById("lilinEmptyMsg");

  container.innerHTML = "";
  countBadge.textContent = rows.length;

  if (rows.length === 0) {
    emptyMsg.classList.remove("hidden");
    return;
  }

  emptyMsg.classList.add("hidden");

  const advenOrder = ["Adven I", "Adven II", "Adven III", "Adven IV"];
  const eventMap = {};
  advenOrder.forEach(ev => { eventMap[ev] = []; });

  rows.forEach((row) => {
    const evName = row.event || "Lainnya";
    if (!eventMap[evName]) eventMap[evName] = [];
    eventMap[evName].push(row);
  });

  Object.keys(eventMap).forEach((eventName, idx) => {
    const eventRows = eventMap[eventName];
    if (eventRows.length === 0) return;

    const panelId = `subPanelAdven_${idx}`;
    const section = document.createElement("div");
    section.className = "sub-acc";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "accordion-header sub-acc-btn";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("data-target", panelId);
    btn.innerHTML = `
      <span>🕯️ Minggu ${eventName} (${eventRows.length})</span>
      <span class="chevron">▾</span>
    `;

    const panel = document.createElement("div");
    panel.className = "accordion-panel";
    panel.id = panelId;

    const inner = document.createElement("div");
    inner.className = "sub-panel-inner";
    inner.innerHTML = buildLilinTableHtml(eventRows, eventName);

    panel.appendChild(inner);
    section.appendChild(btn);
    section.appendChild(panel);
    container.appendChild(section);
  });

  // Attach click handlers untuk tombol tabel Penyala Lilin
  container.querySelectorAll(".lilin-petugas-cell").forEach((cell) => {
    cell.addEventListener("click", () => {
      const payload = JSON.parse(cell.dataset.info);
      openLilinModal(payload);
    });
  });
}

function buildLilinTableHtml(eventRows, eventName) {
  // Group: Tanggal -> Jam -> Asal Petugas
  const dateGroups = [];
  eventRows.forEach((row) => {
    let dateObj = dateGroups.find((d) => d.tanggal === row.tanggal);
    if (!dateObj) {
      const meta = parseIndoDateInfo(row.tanggal);
      dateObj = {
        tanggal: row.tanggal,
        hari: meta.hari,
        tanggalDisplay: meta.tanggalDisplay,
        cssClass: meta.cssClass,
        slots: []
      };
      dateGroups.push(dateObj);
    }

    let slotObj = dateObj.slots.find((s) => s.jam === row.jam && s.asalPetugas === row.asalPetugas);
    if (!slotObj) {
      slotObj = {
        jam: row.jam,
        asalPetugas: row.asalPetugas,
        couples: []
      };
      dateObj.slots.push(slotObj);
    }

    slotObj.couples.push({
      namaSuami: row.namaSuami || "-",
      namaIstri: row.namaIstri || "-",
      noSuami: row.noSuami || "",
      noIstri: row.noIstri || ""
    });
  });

  let rowsHtml = "";
  dateGroups.forEach((dateGroup) => {
    dateGroup.slots.forEach((slot, sIdx) => {
      const isFirst = sIdx === 0;
      const trClass = isFirst ? "new-date" : "";
      const tdHariHtml = isFirst
        ? `<td rowspan="${dateGroup.slots.length}" class="cell-hari ${dateGroup.cssClass}">${dateGroup.hari}<br>${dateGroup.tanggalDisplay}</td>`
        : "";

      const payload = JSON.stringify({
        eventName: eventName,
        hari: dateGroup.hari,
        tanggalDisplay: dateGroup.tanggalDisplay,
        jam: slot.jam,
        asalPetugas: slot.asalPetugas,
        couples: slot.couples
      }).replace(/'/g, "&apos;");

      rowsHtml += `
        <tr class="${trClass}">
          ${tdHariHtml}
          <td class="cell-jam ${dateGroup.cssClass}">Pk ${slot.jam.replace(":", ".")}</td>
          <td class="cell-clickable lilin-petugas-cell ${dateGroup.cssClass}" data-info='${payload}'>
            ${slot.asalPetugas}
          </td>
        </tr>
      `;
    });
  });

  return `
    <div class="table-wrapper">
      <table class="schedule-table">
        <thead>
          <tr>
            <th class="col-hari">Hari / Tanggal</th>
            <th class="col-jam">Jam Misa</th>
            <th class="col-wilayah">Petugas</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

function openLilinModal(info) {
  const modalBadge = document.getElementById("modalBadge");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");

  modalBadge.textContent = `Minggu ${info.eventName} • ${info.hari} ${info.tanggalDisplay} • Pk ${info.jam.replace(":", ".")}`;
  modalTitle.textContent = `Petugas: ${info.asalPetugas}`;

  modalBody.innerHTML = info.couples
    .map((c, idx) => {
      const suamiPhoneHtml = c.noSuami
        ? `<a class="phone-link" href="${formatWaHref(c.noSuami)}" target="_blank" rel="noopener">📞 ${c.noSuami}</a>`
        : `<span class="phone-empty">No. HP kosong</span>`;

      const istriPhoneHtml = c.noIstri
        ? `<a class="phone-link" href="${formatWaHref(c.noIstri)}" target="_blank" rel="noopener">📞 ${c.noIstri}</a>`
        : `<span class="phone-empty">No. HP kosong</span>`;

      return `
        <div class="detail-item">
          <div class="detail-title">Pasutri Penyala Lilin ${info.couples.length > 1 ? `#${idx + 1}` : ""}</div>
          <div class="person-row">
            <span>👨 Suami: <strong>${c.namaSuami}</strong></span>
            ${suamiPhoneHtml}
          </div>
          <div class="person-row">
            <span>👩 Istri: <strong>${c.namaIstri}</strong></span>
            ${istriPhoneHtml}
          </div>
        </div>
      `;
    })
    .join("");

  showDetailModal();
}

// ==========================================
// 3. ACCORDION, LOGIN & MODAL CONTROLLERS
// ==========================================
document.addEventListener("click", (e) => {
  const headerBtn = e.target.closest(".accordion-header");
  if (!headerBtn) return;

  const targetId = headerBtn.getAttribute("data-target");
  const panel = document.getElementById(targetId);
  if (!panel) return;

  const isExpanded = headerBtn.getAttribute("aria-expanded") === "true";
  headerBtn.setAttribute("aria-expanded", String(!isExpanded));
  panel.classList.toggle("open", !isExpanded);
});

const detailModal = document.getElementById("detailModal");

function showDetailModal() {
  detailModal.classList.add("active");
  detailModal.setAttribute("aria-hidden", "false");
}

function closeDetailModal() {
  detailModal.classList.remove("active");
  detailModal.setAttribute("aria-hidden", "true");
}

document.getElementById("closeModalBtn").addEventListener("click", closeDetailModal);
detailModal.addEventListener("click", (e) => {
  if (e.target === detailModal) closeDetailModal();
});

// Submit form login PIC
document.getElementById("picLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const picVal = document.getElementById("picSelect").value.trim();
  const passVal = document.getElementById("passwordInput").value.trim();
  if (!picVal || !passVal) return;

  await fetchPicScheduleData(picVal, passVal, true);
});

// Tombol Keluar / Ganti PIC
document.getElementById("logoutBtn").addEventListener("click", () => {
  savedPic = "";
  savedPassword = "";
  appData = { authorized: false, pic: "", korona: [], lilin: [] };
  sessionStorage.removeItem("adven_pic_name");
  sessionStorage.removeItem("adven_pic_pass");
  document.getElementById("passwordInput").value = "";
  document.getElementById("passErrorText").classList.add("hidden");
  showLoginScreen();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDetailModal();
  }
});

// Init saat halaman dibuka
document.addEventListener("DOMContentLoaded", () => {
  if (savedPic && savedPassword) {
    document.getElementById("picSelect").value = savedPic;
    fetchPicScheduleData(savedPic, savedPassword, false);
  } else {
    showLoginScreen();
  }
});