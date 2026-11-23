(async function startAquaSmart() {
  const authReady = await window.aquaAuthReady;
  if (!authReady || !window.aquaAuth) return;

const navItems = document.querySelectorAll(".nav-item");
const sidebar = document.getElementById("sidebar");
const modal = document.getElementById("pondModal");
const pondForm = document.getElementById("pondForm");
const pondRows = document.getElementById("pondRows");
const searchInput = document.querySelector(".search input");
const toast = document.getElementById("toast");
const overviewPage = document.getElementById("overviewPage");
const subPage = document.getElementById("subPage");
const isAdmin = () => window.aquaAuth?.isAdmin?.() === true;
function enforceAdminAction(action) { if (isAdmin()) return true; showToast("Tài khoản chỉ có quyền xem. Chỉ Admin mới được chỉnh dữ liệu.", true); return false; }
function applyViewerMode() { if (isAdmin()) return; document.querySelectorAll("#addPondButton, .pond-action, .delete-market-item, .save-market-price, #pondModal").forEach((element) => element.style.display = "none"); document.querySelectorAll("#pondForm, #marketItemForm, #inspectionForm, #journalEntryForm, #reportForm").forEach((form) => form.querySelectorAll("input, textarea, select, button").forEach((control) => control.disabled = true)); if (!document.querySelector(".viewer-mode-banner")) { const banner = document.createElement("div"); banner.className = "viewer-mode-banner utility-card"; banner.textContent = "Chế độ xem: tài khoản này không thể thêm, sửa hoặc xóa dữ liệu."; (document.querySelector(".content") || document.body).prepend(banner); } }

function storageKey(key) {
  const account = window.aquaAuth?.getCurrentUser();
  return account ? `${key}:${account.id || account.email}` : key;
}

function readAppData(key) {
  return localStorage.getItem(storageKey(key));
}

function reportSyncError(error) {
  showToast(`Chưa đồng bộ được dữ liệu với máy chủ: ${error.message || "hãy kiểm tra kết nối và cấu hình Supabase."}`, true);
}

function writeAppData(key, value) {
  if (!enforceAdminAction("edit data")) return false;
  localStorage.setItem(storageKey(key), JSON.stringify(value));
  window.aquaAuth.saveAppData(key, value).catch(reportSyncError);
  return true;
}

function writeAppDataBatch(entries) {
  if (!enforceAdminAction("edit data")) return false;
  entries.forEach(([key, value]) => {
    localStorage.setItem(storageKey(key), JSON.stringify(value));
  });
  window.aquaAuth.saveAppDataBatch(entries).catch(reportSyncError);
  return true;
}

const defaultPonds = [
  { id: 1, name: "Ao Cá 01", area: 1500, species: "Cá chép", temperature: 28.2, ph: 7.6, do: 6.8, status: "good" },
  { id: 2, name: "Ao Tôm 03", area: 1200, species: "Tôm sú", temperature: 29.1, ph: 8.1, do: 5.2, status: "warning" },
  { id: 3, name: "Ao Cá 05", area: 1800, species: "Cá tra", temperature: 27.6, ph: 7.2, do: 7.1, status: "good" }
];

let ponds = loadPonds();
let pondPowerStates = loadPondPowerStates();
let editingId = null;
let toastTimer;

const defaultMarketItems = [
  { id: 1, name: "Tôm sú", category: "Tôm", price: 220000, image: "" },
  { id: 2, name: "Tôm thẻ chân trắng", category: "Tôm", price: 165000, image: "" },
  { id: 3, name: "Cá tra", category: "Cá", price: 32000, image: "" },
  { id: 4, name: "Cá chép", category: "Cá", price: 55000, image: "" }
];
const equipmentDevices = [
  { id: "sensor", name: "Cảm biến SEN-008", type: "Cảm biến chất lượng nước", pond: "Ao Tôm 03", status: "Kết nối", battery: "68%", updated: "5 phút trước", image: "images/devices/sensor.svg", description: "Theo dõi các chỉ số môi trường trong ao nuôi." },
  { id: "aerator", name: "Máy sục khí AQ-12", type: "Máy sục khí", pond: "Ao Cá 01", status: "Đang chạy", battery: "—", updated: "1 phút trước", image: "images/devices/aerator.svg", description: "Bổ sung oxy cho nước ao trong quá trình nuôi." },
  { id: "camera", name: "Camera CAM-01", type: "Camera giám sát", pond: "Ao Cá 01", status: "Đang phát", battery: "—", updated: "Trực tiếp", image: "images/devices/camera.svg", description: "Theo dõi hình ảnh khu vực ao nuôi." },
  { id: "camera-2", name: "Camera CAM-02", type: "Camera giám sát", pond: "Ao Tôm 03", status: "Đang phát", battery: "—", updated: "Trực tiếp", image: "images/devices/camera.svg", description: "Theo dõi hình ảnh khu vực ao nuôi." },
  { id: "water-level-1", name: "Cảm biến mực nước WL-01", type: "Cảm biến mực nước", pond: "Ao Cá 01", status: "Bình thường", battery: "—", updated: "1 phút trước", image: "images/devices/water-level.svg", description: "Đo và theo dõi mực nước trong ao." },
  { id: "water-level", name: "Cảm biến mực nước WL-03", type: "Cảm biến mực nước", pond: "Ao Tôm 03", status: "Bình thường", battery: "82%", updated: "1 phút trước", image: "images/devices/water-level.svg", description: "Đo và theo dõi mực nước trong ao." },
  { id: "water-level-5", name: "Cảm biến mực nước WL-05", type: "Cảm biến mực nước", pond: "Ao Cá 05", status: "Cần theo dõi", battery: "—", updated: "2 phút trước", image: "images/devices/water-level.svg", description: "Đo và theo dõi mực nước trong ao." }
];
let marketItems = loadMarketItems();
const defaultReportMonths = [
  { month: "Tháng 6", yield: 8.2, growth: 86, cost: 28 },
  { month: "Tháng 7", yield: 9.1, growth: 88, cost: 31 },
  { month: "Tháng 8", yield: 10.4, growth: 90, cost: 34 },
  { month: "Tháng 9", yield: 9.8, growth: 91.5, cost: 32 },
  { month: "Tháng 10", yield: 11.3, growth: 92.4, cost: 36 },
  { month: "Tháng 11", yield: 12.8, growth: 94.2, cost: 38.5 }
];
let reportMonths = loadReportMonths();
const defaultJournalEntries = [
  { id: 1, when: "2026-11-18T06:30:00+07:00", pond: "Ao Cá 01", activity: "Cho ăn - 24 kg", status: "Hoàn tất" },
  { id: 2, when: "2026-11-18T05:15:00+07:00", pond: "Ao Tôm 03", activity: "Kiểm tra oxy", status: "Hoàn tất" }
];
let journalEntries = loadJournalEntries();
let pondInspections = loadPondInspections();

function loadReportMonths() {
  try {
    const saved = JSON.parse(readAppData("aquasmart-report-months"));
    return Array.isArray(saved) && saved.length === 6 && saved.every((record) =>
      record && typeof record.month === "string" &&
      [record.yield, record.growth, record.cost].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0)
    ) ? saved : defaultReportMonths;
  } catch {
    return defaultReportMonths;
  }
}

function loadJournalEntries() {
  try {
    const saved = JSON.parse(readAppData("aquasmart-journal"));
    return Array.isArray(saved) ? saved : defaultJournalEntries;
  } catch {
    return defaultJournalEntries;
  }
}

function loadPondInspections() {
  try {
    const saved = JSON.parse(readAppData("aquasmart-pond-inspections"));
    return Array.isArray(saved) && saved.every((record) =>
      record && typeof record.pondName === "string" &&
      typeof record.checkedAt === "string" && Number.isFinite(Date.parse(record.checkedAt)) &&
      [record.temperature, record.ph, record.do].every((value) => Number.isFinite(Number(value))) &&
      ["good", "warning", "critical"].includes(record.status) &&
      typeof record.note === "string"
    ) ? saved : [];
  } catch {
    return [];
  }
}

function loadMarketItems() {
  try {
    const saved = JSON.parse(readAppData("aquasmart-market-items"));
    return Array.isArray(saved) ? saved : defaultMarketItems;
  } catch {
    return defaultMarketItems;
  }
}

function saveMarketItems() {
  if (!enforceAdminAction("edit market")) return false;
  try {
    writeAppData("aquasmart-market-items", marketItems);
    return true;
  } catch {
    showToast("Không thể lưu dữ liệu. Ảnh có thể quá lớn, hãy chọn ảnh nhỏ hơn.", true);
    return false;
  }
}

function loadPonds() {
  try {
    const saved = JSON.parse(readAppData("aquasmart-ponds"));
    return Array.isArray(saved) ? saved : defaultPonds;
  } catch {
    return defaultPonds;
  }
}

function loadPondPowerStates() {
  try {
    const saved = JSON.parse(readAppData("aquasmart-pond-power-states"));
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

function savePonds() {
  if (!enforceAdminAction("edit ponds")) return false;
  writeAppData("aquasmart-ponds", ponds);
}

function savePondPowerStates() {
  if (!enforceAdminAction("edit equipment")) return false;
  try {
    writeAppData("aquasmart-pond-power-states", pondPowerStates);
    return true;
  } catch {
    showToast("Không thể lưu trạng thái công tắc mô phỏng.", true);
    return false;
  }
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.className = `toast show${isError ? " error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.className = "toast", 2600);
}

function escapeHtml(value) {
  const span = document.createElement("span");
  span.textContent = value;
  return span.innerHTML;
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function statusLabel(status) {
  if (status === "warning") return '<span class="status-badge warning"><i></i>Cần theo dõi</span>';
  if (status === "critical") return '<span class="status-badge warning"><i></i>Nguy cấp</span>';
  return '<span class="status-badge good"><i></i>Tốt</span>';
}

function getPondStatus(temperature, ph, oxygen) {
  if (oxygen < 4 || temperature < 15 || temperature > 35 || ph < 5.5 || ph > 9.5) return "critical";
  if (oxygen < 6 || temperature < 20 || temperature > 32 || ph < 6.5 || ph > 8.5) return "warning";
  return "good";
}

function refreshPondViews() {
  const rows = document.getElementById("subPondRows") || pondRows;
  if (rows) renderPonds(searchInput.value, rows);
  const pondMonitorGrid = document.getElementById("pondDeviceMonitorGrid");
  if (pondMonitorGrid) renderPondMonitoring(pondMonitorGrid);
  if (document.getElementById("overviewPondCount")) {
    updateOverview();
    window.chartLabels = null;
    window.chartTemperature = null;
    window.chartOxygen = null;
    drawChart();
  }
}

function renderPondMonitoring(target) {
  if (!target) return;
  if (!ponds.length) {
    target.innerHTML = '<p class="pond-monitor-empty">Hãy thêm ao nuôi để theo dõi nguồn điện và camera.</p>';
    return;
  }

  target.innerHTML = ponds.map((pond) => {
    const powerOn = pondPowerStates[pond.id] !== false;
    return `
      <article class="pond-monitor-card">
        <h3>${escapeHtml(pond.name)}</h3>
        <div class="pond-monitor-devices">
          <section class="pond-monitor-device">
            <img src="images/devices/power-switch.svg" alt="Minh họa công tắc nguồn điện">
            <div class="pond-monitor-device-copy"><strong>Công tắc nguồn điện</strong><small>Điều khiển mô phỏng</small></div>
            <button class="pond-power-toggle ${powerOn ? "is-on" : "is-off"}" type="button" role="switch" aria-checked="${powerOn}" aria-label="${powerOn ? "Tắt" : "Bật"} nguồn mô phỏng ${escapeAttribute(pond.name)}" data-pond-power="${escapeAttribute(pond.id)}">
              <span>${powerOn ? "Đang bật" : "Đang tắt"}</span><i aria-hidden="true"></i>
            </button>
          </section>
          <section class="pond-monitor-device">
            <img src="images/devices/night-camera.svg" alt="Minh họa camera hồng ngoại ban đêm">
            <div class="pond-monitor-device-copy"><strong>Camera ban đêm</strong><small>Hình ảnh minh họa</small></div>
            <button class="secondary-button pond-camera-open" type="button" data-pond-camera="${escapeAttribute(pond.id)}">Xem camera</button>
          </section>
        </div>
      </article>
    `;
  }).join("");

  target.querySelectorAll(".pond-power-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const pondId = button.dataset.pondPower;
      const previousState = pondPowerStates[pondId] !== false;
      const pond = ponds.find((item) => String(item.id) === pondId);
      pondPowerStates[pondId] = !previousState;
      if (!savePondPowerStates()) {
        pondPowerStates[pondId] = previousState;
        renderPondMonitoring(target);
        return;
      }
      renderPondMonitoring(target);
      showToast(`Đã ${previousState ? "tắt" : "bật"} nguồn mô phỏng${pond ? ` cho ${pond.name}` : ""}`);
    });
  });

  target.querySelectorAll(".pond-camera-open").forEach((button) => {
    button.addEventListener("click", () => {
      const pond = ponds.find((item) => String(item.id) === button.dataset.pondCamera);
      const cameraDialog = document.getElementById("pondCameraDialog");
      if (!pond || !cameraDialog) return;
      document.getElementById("pondCameraTitle").textContent = `Camera ban đêm • ${pond.name}`;
      document.getElementById("pondCameraCaption").textContent = `Hình minh họa camera hồng ngoại tại ${pond.name}.`;
      cameraDialog.showModal();
    });
  });
}

function renderPonds(query = "", target = pondRows) {
  const needle = query.trim().toLowerCase();
  const filtered = ponds.filter((pond) =>
    [pond.name, pond.species, pond.area].some((value) => String(value).toLowerCase().includes(needle))
  );

  if (!filtered.length) {
    target.innerHTML = '<div class="pond-empty">Không tìm thấy ao nuôi phù hợp</div>';
    return;
  }

  target.innerHTML = filtered.map((pond) => `
    <div class="pond-row" data-id="${pond.id}">
      <div class="pond-name">
        <div class="pond-thumb"><svg viewBox="0 0 40 40"><path d="M5 26c5-3 10-3 15 0s10 3 15 0M6 31c5-3 10-3 14 0s9 3 14 0"/><circle cx="20" cy="16" r="7"/></svg></div>
        <div><strong>${escapeHtml(pond.name)}</strong><small>${Number(pond.area).toLocaleString("vi-VN")} m² • ${escapeHtml(pond.species)}</small></div>
      </div>
      <strong>${Number(pond.temperature).toFixed(1)}°C</strong>
      <strong>${Number(pond.ph).toFixed(1)}</strong>
      <strong>${Number(pond.do).toFixed(1)}</strong>
      ${statusLabel(pond.status)}
      <div class="pond-actions">
        <button class="pond-action edit" type="button" data-action="edit" title="Sửa" aria-label="Sửa ${escapeHtml(pond.name)}">✎</button>
        <button class="pond-action delete" type="button" data-action="delete" title="Xóa" aria-label="Xóa ${escapeHtml(pond.name)}">×</button>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".pond-action").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.closest(".pond-row").dataset.id);
      if (button.dataset.action === "edit") openModal(id);
      if (button.dataset.action === "delete") deletePond(id);
    });
  });
}

function openModal(id = null) {
  if (!enforceAdminAction("edit ponds")) return;
  if (!modal || !pondForm) return;
  editingId = id;
  pondForm.reset();
  document.getElementById("modalTitle").textContent = id ? "Chỉnh sửa ao nuôi" : "Thêm ao nuôi mới";

  if (id) {
    const pond = ponds.find((item) => item.id === id);
    if (!pond) return;
    pondForm.elements.name.value = pond.name;
    pondForm.elements.area.value = pond.area;
    pondForm.elements.species.value = pond.species;
    pondForm.elements.note.value = pond.note || "";
    pondForm.elements.temperature.value = pond.temperature;
    pondForm.elements.ph.value = pond.ph;
    pondForm.elements.do.value = pond.do;
  } else {
    pondForm.elements.area.value = 1500;
    pondForm.elements.temperature.value = 28;
    pondForm.elements.ph.value = 7.5;
    pondForm.elements.do.value = 6.5;
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  pondForm.elements.name.focus();
}

function closeModal() {
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  editingId = null;
}

function deletePond(id) {
  if (!enforceAdminAction("edit ponds")) return;
  const pond = ponds.find((item) => item.id === id);
  if (!pond) return;
  if (!window.confirm(`Xóa "${pond.name}" khỏi danh sách?`)) return;
  ponds = ponds.filter((item) => item.id !== id);
  savePonds();
  refreshPondViews();
  showToast(`Đã xóa ${pond.name}`);
}

function subHeading(title, subtitle, actionText = "") {
  return `
    <div class="sub-heading">
      <div><p class="eyebrow">AQUASMART</p><h1>${title}</h1><p>${subtitle}</p></div>
      ${actionText ? `<button class="primary-button" type="button">${actionText}</button>` : ""}
    </div>
  `;
}

function renderMarketItems(query = "") {
  const cards = document.getElementById("marketItemsGrid");
  if (!cards) return;
  const needle = query.trim().toLocaleLowerCase("vi");
  const filtered = marketItems.filter((item) =>
    `${item.name} ${item.category}`.toLocaleLowerCase("vi").includes(needle)
  );
  const average = marketItems.length
    ? Math.round(marketItems.reduce((sum, item) => sum + Number(item.price || 0), 0) / marketItems.length)
    : 0;
  const averageElement = document.getElementById("marketAveragePrice");
  if (averageElement) averageElement.textContent = `${average.toLocaleString("vi-VN")} đ/kg`;

  if (!filtered.length) {
    cards.innerHTML = '<div class="pond-empty">Không tìm thấy mặt hàng phù hợp</div>';
    return;
  }

  cards.innerHTML = filtered.map((item) => `
    <article class="market-card" data-market-id="${item.id}">
      <div class="market-image">${/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(item.image || "")
        ? `<img src="${item.image}" alt="${escapeAttribute(item.name)}">`
        : `<div class="market-image-placeholder" aria-hidden="true">${item.category === "Tôm" ? "🦐" : "🐟"}</div>`}
        <label class="image-upload-button">Đổi ảnh<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-market-upload="${item.id}" aria-label="Tải ảnh ${escapeAttribute(item.name)}"></label>
      </div>
      <div class="market-card-body">
        <div class="market-card-title"><div><span class="market-category">${escapeHtml(item.category)}</span><h3>${escapeHtml(item.name)}</h3></div><button class="pond-action delete-market-item" type="button" aria-label="Xóa ${escapeHtml(item.name)}">×</button></div>
        <label class="form-field">Giá trung bình (đ/kg)<input type="number" min="500" step="500" value="${Number(item.price)}" data-market-price="${item.id}"></label>
        <button class="secondary-button save-market-price" type="button" data-market-save="${item.id}">Cập nhật giá</button>
      </div>
    </article>
  `).join("");

  cards.querySelectorAll("[data-market-upload]").forEach((input) => {
    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) return;
      if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
        showToast("Chọn ảnh PNG, JPEG, WebP hoặc GIF.", true);
        input.value = "";
        return;
      }
      if (file.size > 1024 * 1024) {
        showToast("Ảnh tối đa 1 MB để lưu được trên thiết bị.", true);
        input.value = "";
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const item = marketItems.find((product) => product.id === Number(input.dataset.marketUpload));
        if (!item) return;
        const oldImage = item.image;
        item.image = String(reader.result);
        if (saveMarketItems()) {
          renderMarketItems(searchInput.value);
          showToast(`Đã cập nhật ảnh ${item.name}`);
        } else {
          item.image = oldImage;
        }
      });
      reader.addEventListener("error", () => showToast("Không đọc được ảnh đã chọn.", true));
      reader.readAsDataURL(file);
    });
  });

  cards.querySelectorAll("[data-market-save]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.marketSave);
      const item = marketItems.find((product) => product.id === id);
      const input = cards.querySelector(`[data-market-price="${id}"]`);
      const price = Number(input.value);
      if (!Number.isFinite(price) || price <= 0) {
        showToast("Giá phải là số lớn hơn 0.", true);
        return;
      }
      const oldPrice = item.price;
      item.price = price;
      if (saveMarketItems()) {
        renderMarketItems(searchInput.value);
        showToast(`Đã cập nhật giá ${item.name}`);
      } else {
        item.price = oldPrice;
      }
    });
  });

  cards.querySelectorAll(".delete-market-item").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.closest("[data-market-id]").dataset.marketId);
      const removed = marketItems.find((item) => item.id === id);
      if (!removed || !window.confirm(`Xóa ${removed.name} khỏi danh mục?`)) return;
      marketItems = marketItems.filter((item) => item.id !== id);
      if (saveMarketItems()) {
        renderMarketItems(searchInput.value);
        showToast(`Đã xóa ${removed.name}`);
      } else {
        marketItems.push(removed);
      }
    });
  });
}

function renderReportBarCharts() {
  const chartGrid = document.getElementById("reportChartGrid");
  if (!chartGrid) return;
  const months = reportMonths.map((record) => record.month);
  const datasets = [
    { key: "yield", name: "Năng suất thu hoạch", unit: "tấn", values: reportMonths.map((record) => Number(record.yield)), color: "#159f98", step: 5 },
    { key: "growth", name: "Tỷ lệ sinh trưởng", unit: "%", values: reportMonths.map((record) => Number(record.growth)), color: "#8d74e8", step: 20 },
    { key: "cost", name: "Chi phí thức ăn", unit: "triệu đồng", values: reportMonths.map((record) => Number(record.cost)), color: "#4c8bf5", step: 10 }
  ];
  const latest = reportMonths[reportMonths.length - 1];
  document.getElementById("reportYieldKpi").textContent = `${Number(latest.yield).toLocaleString("vi-VN")} tấn`;
  document.getElementById("reportGrowthKpi").textContent = `${Number(latest.growth).toLocaleString("vi-VN")}%`;
  document.getElementById("reportCostKpi").textContent = `${Number(latest.cost).toLocaleString("vi-VN")} tr`;
  chartGrid.innerHTML = datasets.map((dataset) => {
    const maximum = Math.ceil(Math.max(...dataset.values, 0) / dataset.step) * dataset.step || dataset.step;
    const ticks = [maximum, maximum * .75, maximum * .5, maximum * .25, 0];
    const xPositions = dataset.values.map((_, index) => 52 + index * 110);
    const gridYPositions = [35, 71.25, 107.5, 143.75, 180];
    const points = dataset.values.map((value, index) => ({
      x: xPositions[index],
      y: 180 - (value / maximum) * 145,
      value: Number.isInteger(value) ? value : value.toFixed(1),
      month: months[index]
    }));
    const pointList = points.map((point) => `${point.x},${point.y}`).join(" ");
    return `<section class="report-mini-chart">
      <h4>${dataset.name}</h4>
      <p>Đơn vị: ${dataset.unit}</p>
      <div class="mini-chart-wrap">
        <div class="mini-line-chart">
          <svg viewBox="0 0 640 220" preserveAspectRatio="none" role="img" aria-label="${dataset.name} theo tháng, đơn vị ${dataset.unit}">
            ${gridYPositions.map((y, index) => `<line x1="40" y1="${y}" x2="630" y2="${y}" class="line-grid"/><text x="34" y="${y + 3}" text-anchor="end" class="line-axis">${Number.isInteger(ticks[index]) ? ticks[index] : ticks[index].toFixed(1)}</text>`).join("")}
            <polyline points="${pointList}" fill="none" stroke="${dataset.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            ${points.map((point) => `<g><circle cx="${point.x}" cy="${point.y}" r="4" fill="white" stroke="${dataset.color}" stroke-width="3"><title>${escapeHtml(point.month)}: ${point.value} ${dataset.unit}</title></circle><text x="${point.x}" y="${Math.max(20, point.y - 10)}" text-anchor="middle" class="line-value">${point.value}</text><text x="${point.x}" y="210" text-anchor="middle" class="line-month">${escapeHtml(point.month.replace("Tháng ", "T"))}</text></g>`).join("")}
          </svg>
        </div>
      </div>
    </section>`;
  }).join("");
}

function renderJournalEntries() {
  const rows = document.getElementById("journalRows");
  if (!rows) return;
  rows.innerHTML = journalEntries.length
    ? journalEntries.map((entry) => `
      <tr><td>${escapeHtml(new Date(entry.when).toLocaleString("vi-VN"))}</td><td>${escapeHtml(entry.pond)}</td><td>${escapeHtml(entry.activity)}</td><td><span class="tag">${escapeHtml(entry.status)}</span></td></tr>
    `).join("")
    : '<tr><td colspan="4" class="journal-empty">Chưa có nhật ký. Hãy thêm hoạt động mới.</td></tr>';
}

function renderJournalSummary() {
  const chart = document.querySelector(".activity-pie");
  if (!chart) return;
  const categories = [
    { key: "feeding", label: "Cho ăn", matches: /cho ăn|thức ăn/i, color: "#4c8bf5" },
    { key: "environment", label: "Kiểm tra môi trường", matches: /oxy|ph\b|môi trường|nước|nhiệt độ/i, color: "#12b3a6" },
    { key: "treatment", label: "Xử lý ao", matches: /xử lý|thuốc|vệ sinh|thay nước/i, color: "#edae42" },
    { key: "health", label: "Kiểm tra sức khỏe", matches: /sức khỏe|kiểm tra cá|kiểm tra tôm/i, color: "#8d74e8" }
  ];
  const counts = Object.fromEntries(categories.map((category) => [category.key, 0]));
  journalEntries.forEach((entry) => {
    const category = categories.find((item) => item.matches.test(entry.activity)) || categories[3];
    counts[category.key] += 1;
  });
  const total = journalEntries.length;
  const percentages = categories.map((item) => total ? (counts[item.key] / total) * 100 : 0);
  let end = 0;
  const slices = categories.map((item, index) => {
    const start = end;
    end += percentages[index];
    return `${item.color} ${start}% ${end}%`;
  });
  chart.style.background = total ? `conic-gradient(${slices.join(", ")})` : "conic-gradient(#edf2f3 0 100%)";
  chart.setAttribute("aria-label", `Cơ cấu ${total} hoạt động nhật ký: ${categories.map((item, index) => `${item.label} ${percentages[index].toFixed(0)} phần trăm`).join(", ")}`);
  document.getElementById("journalActivityTotal").textContent = total;
  categories.forEach((item, index) => {
    const value = document.querySelector(`[data-journal-category="${item.key}"]`);
    if (value) value.textContent = `${percentages[index].toFixed(0)}%`;
  });
}

function renderPondInspectionHistory() {
  const rows = document.getElementById("pondInspectionRows");
  if (!rows) return;
  rows.innerHTML = pondInspections.length
    ? pondInspections.map((record) => `
      <tr>
        <td>${escapeHtml(new Date(record.checkedAt).toLocaleString("vi-VN"))}</td>
        <td>${escapeHtml(record.pondName)}</td>
        <td>${Number(record.temperature).toFixed(1)}°C / pH ${Number(record.ph).toFixed(1)} / ${Number(record.do).toFixed(1)} mg/L</td>
        <td>${statusLabel(record.status)}</td>
        <td>${escapeHtml(record.note || "—")}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="5" class="journal-empty">Chưa có lần kiểm tra nào.</td></tr>';
}

function updateOverview() {
  const total = ponds.length;
  const warning = ponds.filter((pond) => pond.status === "warning").length;
  const critical = ponds.filter((pond) => pond.status === "critical").length;
  const good = Math.max(0, total - warning - critical);
  const average = (field) => total
    ? (ponds.reduce((sum, pond) => sum + Number(pond[field] || 0), 0) / total).toFixed(1)
    : "—";
  const percentGood = total ? Math.round((good / total) * 100) : 0;
  document.getElementById("overviewPondCount").textContent = total;
  document.getElementById("overviewActivePonds").textContent = total - critical;
  document.getElementById("overviewTemperature").textContent = average("temperature");
  document.getElementById("overviewOxygen").textContent = average("do");
  document.getElementById("overviewAlertCount").textContent = warning + critical;
  document.getElementById("overviewCriticalCount").textContent = critical;
  document.getElementById("overviewHealthRing").style.setProperty("--value", percentGood);
  document.getElementById("overviewHealthPercent").textContent = `${percentGood}%`;
  document.getElementById("overviewGoodPonds").textContent = `${good} ao`;
  document.getElementById("overviewWarningPonds").textContent = `${warning} ao`;
  document.getElementById("overviewDangerPonds").textContent = `${critical} ao`;
  document.getElementById("overviewPondListCount").textContent = `${total} ao đang được quản lý`;
}

function exportReportCsv() {
  const rows = [
    ["Tháng", "Năng suất (tấn)", "Tỷ lệ sinh trưởng (%)", "Chi phí thức ăn (triệu đồng)"],
    ...reportMonths.map((record) => [record.month, record.yield, record.growth, record.cost])
  ];
  const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "aquasmart-bao-cao.csv";
  link.click();
  URL.revokeObjectURL(url);
  showToast("Đã xuất báo cáo CSV");
}

function exportPondInspectionsCsv() {
  if (!pondInspections.length) {
    showToast("Chưa có dữ liệu kiểm tra để xuất.", true);
    return;
  }
  const rows = [
    ["Thời gian", "Ao nuôi", "Nhiệt độ (°C)", "pH", "DO (mg/L)", "Trạng thái", "Ghi chú"],
    ...pondInspections.map((record) => [
      new Date(record.checkedAt).toLocaleString("vi-VN"),
      record.pondName,
      record.temperature,
      record.ph,
      record.do,
      record.status,
      record.note || ""
    ])
  ];
  const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "aquasmart-kiem-tra-ao.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Đã xuất báo cáo kiểm tra ao");
}

function renderEquipmentRows() {
  return equipmentDevices.map((device) => `
    <tr>
      <td><button class="equipment-open equipment-image-button" type="button" data-device-id="${escapeAttribute(device.id)}" aria-label="Kiểm tra ${escapeAttribute(device.name)}"><img class="equipment-thumb" src="${escapeAttribute(device.image)}" alt=""></button></td>
      <td><button class="equipment-open equipment-name-button" type="button" data-device-id="${escapeAttribute(device.id)}">${escapeHtml(device.name)}</button></td>
      <td>${escapeHtml(device.pond)}</td>
      <td><span class="tag">${escapeHtml(device.status)}</span></td>
      <td>${escapeHtml(device.battery)}</td>
      <td>${escapeHtml(device.updated)}</td>
      <td><button class="equipment-open secondary-button" type="button" data-device-id="${escapeAttribute(device.id)}">Kiểm tra</button></td>
    </tr>
  `).join("");
}

function renderSubPage(page) {
  const totalPonds = ponds.length;
  const warningPonds = ponds.filter((pond) => pond.status === "warning").length;
  const criticalPonds = ponds.filter((pond) => pond.status === "critical").length;
  const goodPonds = Math.max(0, totalPonds - warningPonds - criticalPonds);
  const goodPercent = totalPonds ? (goodPonds / totalPonds) * 100 : 0;
  const warningPercent = totalPonds ? (warningPonds / totalPonds) * 100 : 0;
  const criticalPercent = totalPonds ? (criticalPonds / totalPonds) * 100 : 0;
  const goodEnd = goodPercent;
  const warningEnd = goodPercent + warningPercent;
  const pondPie = totalPonds
    ? `conic-gradient(#35b98a 0 ${goodEnd}%, #edae42 ${goodEnd}% ${warningEnd}%, #e85d68 ${warningEnd}% 100%)`
    : "conic-gradient(#edf2f3 0 100%)";
  const monitorCard = (title, field, unit, scale) => `
    <article class="utility-card"><h3>${title}</h3>${ponds.length ? ponds.map((pond) => {
      const value = Number(pond[field]) || 0;
      const meterWidth = Math.max(0, Math.min(100, (value / scale) * 100));
      return `<div class="meter-row"><span>${escapeHtml(pond.name)}</span><div class="meter-track"><span style="width:${meterWidth}%"></span></div><strong>${value.toFixed(1)}${unit}</strong></div>`;
    }).join("") : '<p>Chưa có ao nuôi để hiển thị.</p>'}</article>
  `;
  const pages = {
    ponds: `
      ${subHeading("Quản lý ao", "Theo dõi, chỉnh sửa và tạo mới ao nuôi", "+ Thêm ao nuôi")}
      <section class="panel pond-panel" style="height:auto">
        <div class="panel-header"><div><h2>Danh sách ao nuôi</h2><p>${ponds.length} ao đang được quản lý</p></div></div>
        <div class="pond-table"><div class="table-head"><span>AO NUÔI</span><span>NHIỆT ĐỘ</span><span>pH</span><span>DO</span><span>TRẠNG THÁI</span><span></span></div><div id="subPondRows"></div></div>
      </section>
      <section class="utility-card pond-monitor-section">
        <div class="pond-monitor-heading"><div><h2>Giám sát nguồn điện & camera</h2><p>Công tắc có thể bật/tắt trong bản mô phỏng; camera chưa kết nối phần cứng.</p></div><span class="pond-demo-badge">BẢN MÔ PHỎNG</span></div>
        <div id="pondDeviceMonitorGrid" class="pond-monitor-grid"></div>
      </section>
      <dialog id="pondCameraDialog" class="pond-camera-dialog" aria-labelledby="pondCameraTitle">
        <header class="pond-camera-dialog-header"><div><h2 id="pondCameraTitle">Camera ban đêm</h2><p>Theo dõi hồng ngoại ban đêm</p></div><button class="equipment-dialog-close" type="button" aria-label="Đóng">×</button></header>
        <figure><img src="images/devices/night-camera.svg" alt="Hình ảnh minh họa camera theo dõi ban đêm"><figcaption id="pondCameraCaption"></figcaption></figure>
        <p class="pond-camera-demo-note">Đây là hình minh họa, không phải luồng hình ảnh trực tiếp.</p>
      </dialog>
    `,
    monitor: `
      ${subHeading("Giám sát môi trường", "Theo dõi các chỉ số đã ghi nhận; chưa kết nối cảm biến")}
      <div class="utility-grid">
        <section class="utility-card full-panel pie-summary">
          <div><h3>Tổng hợp trạng thái môi trường</h3><p class="pie-caption">${totalPonds} ao đang được quản lý</p></div>
          <div class="pie-content">
            <div class="pie-chart" role="img" aria-label="Trạng thái ${totalPonds} ao: ${goodPonds} tốt, ${warningPonds} cần theo dõi, ${criticalPonds} nguy cấp" style="background:${pondPie}"><div><strong>${totalPonds}</strong><span>ao nuôi</span></div></div>
            <div class="pie-legend">
              <div><span><i class="pie-dot good-pie"></i>Tốt</span><strong>${goodPonds} ao (${goodPercent.toFixed(0)}%)</strong></div>
              <div><span><i class="pie-dot warning-pie"></i>Cần theo dõi</span><strong>${warningPonds} ao (${warningPercent.toFixed(0)}%)</strong></div>
              <div><span><i class="pie-dot critical-pie"></i>Nguy cấp</span><strong>${criticalPonds} ao (${criticalPercent.toFixed(0)}%)</strong></div>
            </div>
          </div>
        </section>
        ${monitorCard("Nhiệt độ", "temperature", "°C", 40)}
        ${monitorCard("Nồng độ oxy", "do", " mg/L", 10)}
        ${monitorCard("Độ pH", "ph", "", 14)}
      </div>
      <section class="utility-card inspection-panel">
        <div class="inspection-heading"><div><h3>Kiểm tra & báo cáo ao</h3><p>Ghi nhận số đo để cập nhật tình trạng và lịch sử kiểm tra.</p></div></div>
        ${ponds.length ? `
          <form id="pondInspectionForm" class="inspection-form">
            <label class="form-field">Ao nuôi<select name="pondId" id="inspectionPondSelect">${ponds.map((pond) => `<option value="${escapeAttribute(pond.id)}">${escapeHtml(pond.name)}</option>`).join("")}</select></label>
            <label class="form-field">Nhiệt độ (°C)<input name="temperature" type="number" min="0.1" step="0.1" required value="${escapeAttribute(ponds[0].temperature)}"></label>
            <label class="form-field">pH<input name="ph" type="number" min="0.1" max="14" step="0.1" required value="${escapeAttribute(ponds[0].ph)}"></label>
            <label class="form-field">DO (mg/L)<input name="do" type="number" min="0.1" step="0.1" required value="${escapeAttribute(ponds[0].do)}"></label>
            <label class="form-field inspection-note">Ghi chú<input name="note" placeholder="Ví dụ: kiểm tra sau khi thay nước"></label>
            <div class="inspection-submit"><span>Trạng thái dự kiến <strong id="inspectionStatusPreview" aria-live="polite">${statusLabel(ponds[0].status)}</strong></span><button type="submit" class="primary-button">Lưu lần kiểm tra</button></div>
          </form>
        ` : '<p>Hãy thêm ao nuôi trước khi ghi nhận kiểm tra.</p>'}
      </section>
      <section class="utility-card inspection-history">
        <div class="inspection-heading"><div><h3>Lịch sử kiểm tra</h3><p>Các lần kiểm tra và cập nhật gần đây</p></div><button id="exportInspectionReport" type="button" class="secondary-button">Xuất báo cáo CSV</button></div>
        <div class="table-scroll"><table class="utility-table"><thead><tr><th>THỜI GIAN</th><th>AO NUÔI</th><th>CHỈ SỐ</th><th>TÌNH TRẠNG</th><th>GHI CHÚ</th></tr></thead><tbody id="pondInspectionRows"></tbody></table></div>
      </section>
    `,
    log: `
      ${subHeading("Nhật ký nuôi", "Ghi chép hoạt động chăm sóc và cho ăn", "+ Tạo nhật ký")}
      <div class="utility-grid">
        <section class="utility-card full-panel pie-summary">
          <div><h3>Cơ cấu hoạt động nuôi</h3><p class="pie-caption">Phân bổ theo các nhật ký đã ghi nhận</p></div>
          <div class="pie-content">
            <div class="pie-chart activity-pie" role="img" aria-label="Biểu đồ cơ cấu hoạt động"><div><strong id="journalActivityTotal">0</strong><span>hoạt động</span></div></div>
            <div class="pie-legend">
              <div><span><i class="pie-dot feed-pie"></i>Cho ăn</span><strong data-journal-category="feeding">0%</strong></div>
              <div><span><i class="pie-dot environment-pie"></i>Kiểm tra môi trường</span><strong data-journal-category="environment">0%</strong></div>
              <div><span><i class="pie-dot treatment-pie"></i>Xử lý ao</span><strong data-journal-category="treatment">0%</strong></div>
              <div><span><i class="pie-dot health-pie"></i>Kiểm tra sức khỏe / khác</span><strong data-journal-category="health">0%</strong></div>
            </div>
          </div>
        </section>
        <section class="utility-card wide-panel"><h3>Nhật ký gần đây</h3><table class="utility-table"><thead><tr><th>THỜI GIAN</th><th>AO</th><th>HOẠT ĐỘNG</th><th>TRẠNG THÁI</th></tr></thead><tbody id="journalRows"></tbody></table></section>
        <section class="utility-card"><h3>Lịch chăm sóc</h3><p>Cho ăn buổi chiều<br><strong>Ao Cá 01 • 16:30</strong></p><p>Lấy mẫu nước<br><strong>Ao Tôm 03 • 17:00</strong></p></section>
        <form id="journalEntryForm" class="utility-card journal-entry-form">
          <h3>Thêm nhật ký</h3>
          <label class="form-field">Ao nuôi<select name="pond">${ponds.map((pond) => `<option>${escapeHtml(pond.name)}</option>`).join("")}</select></label>
          <label class="form-field">Thời gian<input name="when" type="datetime-local" value="${new Date().toISOString().slice(0, 16)}" required></label>
          <label class="form-field">Hoạt động<input name="activity" required placeholder="Ví dụ: Cho ăn - 10 kg"></label>
          <button type="submit" class="primary-button">Lưu nhật ký</button>
        </form>
      </div>
    `,
    equipment: `
      ${subHeading("Thiết bị", "Quản lý cảm biến và thiết bị vận hành", "+ Thêm thiết bị")}
      <div class="utility-grid">
        <section class="utility-card full-panel"><h3>Danh sách thiết bị</h3><div class="equipment-table-scroll"><table class="utility-table equipment-table"><thead><tr><th>HÌNH ẢNH</th><th>THIẾT BỊ</th><th>AO</th><th>TRẠNG THÁI</th><th>PIN / NGUỒN</th><th>CẬP NHẬT</th><th></th></tr></thead><tbody>${renderEquipmentRows()}</tbody></table></div></section>
        <section class="utility-card">
          <h3>Camera theo dõi</h3>
          <div class="camera-grid">
            <article class="camera-card">
              <div class="camera-preview"><span class="live-badge">● LIVE</span><div class="camera-placeholder">Ao Cá 01</div></div>
              <div class="camera-info"><div><button class="equipment-open equipment-name-button" type="button" data-device-id="camera">CAM-01</button><small>Ao Cá 01 • 1080p</small></div><button class="pond-action camera-fullscreen" type="button" title="Xem toàn màn hình">⛶</button></div>
            </article>
            <article class="camera-card">
              <div class="camera-preview camera-preview-2"><span class="live-badge">● LIVE</span><div class="camera-placeholder">Ao Tôm 03</div></div>
              <div class="camera-info"><div><button class="equipment-open equipment-name-button" type="button" data-device-id="camera-2">CAM-02</button><small>Ao Tôm 03 • 1080p</small></div><button class="pond-action camera-fullscreen" type="button" title="Xem toàn màn hình">⛶</button></div>
            </article>
          </div>
        </section>
        <section class="utility-card">
          <h3>Hệ thống theo dõi mực nước</h3>
          <div class="water-list">
            <div class="water-item"><div><strong>Ao Cá 01</strong><button class="equipment-open equipment-id-button" type="button" data-device-id="water-level-1">WL-01 • 1 phút trước</button></div><div class="water-level"><span style="width:78%"></span></div><strong>1.56 m</strong><span class="tag">Bình thường</span></div>
            <div class="water-item"><div><strong>Ao Tôm 03</strong><button class="equipment-open equipment-id-button" type="button" data-device-id="water-level">WL-03 • 1 phút trước</button></div><div class="water-level"><span style="width:64%"></span></div><strong>1.28 m</strong><span class="tag">Bình thường</span></div>
            <div class="water-item"><div><strong>Ao Cá 05</strong><button class="equipment-open equipment-id-button" type="button" data-device-id="water-level-5">WL-05 • 2 phút trước</button></div><div class="water-level"><span style="width:46%"></span></div><strong>0.92 m</strong><span class="tag warning-tag">Cần theo dõi</span></div>
          </div>
        </section>
      </div>
      <dialog id="equipmentDialog" class="equipment-dialog" aria-labelledby="equipmentDialogTitle">
        <header class="equipment-dialog-header"><div><h2 id="equipmentDialogTitle">Chi tiết thiết bị</h2><p>Xem thông tin và chạy kiểm tra mô phỏng</p></div><button class="equipment-dialog-close" type="button" aria-label="Đóng">×</button></header>
        <div id="equipmentDialogContent"></div>
      </dialog>
    `,
    market: `
      ${subHeading("Quản lý tôm cá", "Quản lý hình ảnh và giá tham khảo trung bình")}
      <div class="market-summary">
        <div><span>Giá trung bình danh mục</span><strong id="marketAveragePrice">—</strong><small>Giá tham khảo mẫu, cập nhật thủ công</small></div>
        <div><span>Số mặt hàng</span><strong>${marketItems.length}</strong><small>Cá và thủy sản nuôi</small></div>
      </div>
      <section class="utility-card market-add-panel">
        <h3>Thêm mặt hàng</h3>
        <form id="marketItemForm" class="market-add-form">
          <label class="form-field">Tên mặt hàng<input name="name" required placeholder="Ví dụ: Cá rô phi"></label>
          <label class="form-field">Loại<select name="category"><option>Cá</option><option>Tôm</option></select></label>
          <label class="form-field">Giá trung bình (đ/kg)<input name="price" type="number" min="500" step="500" required placeholder="50000"></label>
          <label class="form-field">Hình ảnh<input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>
          <button class="primary-button" type="submit">Thêm mặt hàng</button>
        </form>
        <p class="market-note">Giá trên trang là dữ liệu tham khảo mẫu, không phải báo giá thị trường trực tiếp. Ảnh tải lên được lưu trong trình duyệt này (tối đa 1 MB/ảnh).</p>
      </section>
      <div class="market-items-grid" id="marketItemsGrid"></div>
    `,
    reports: `
      ${subHeading("Báo cáo", "Tổng hợp hiệu suất nuôi và cảnh báo", "Xuất báo cáo")}
      <div class="utility-grid">
        <article class="utility-card"><h3>Năng suất</h3><strong id="reportYieldKpi" class="report-kpi"></strong><p>Tháng mới nhất</p></article>
        <article class="utility-card"><h3>Tỷ lệ sinh trưởng</h3><strong id="reportGrowthKpi" class="report-kpi"></strong><p>Tháng mới nhất</p></article>
        <article class="utility-card"><h3>Chi phí thức ăn</h3><strong id="reportCostKpi" class="report-kpi"></strong><p>Tháng mới nhất</p></article>
      </div>
      <section class="utility-card report-chart-card">
        <div class="report-chart-header"><div><h3>Biểu đồ đường theo tháng</h3><p>Dữ liệu minh họa; mỗi biểu đồ sử dụng thang đo riêng theo đơn vị chỉ số.</p></div>
        </div>
        <div class="report-chart-grid" id="reportChartGrid"></div>
        <form id="reportDataForm" class="report-data-form">
          <strong>Cập nhật số liệu tháng</strong>
          <label class="form-field">Tháng<select name="month" id="reportMonthSelect">${reportMonths.map((record) => `<option value="${escapeAttribute(record.month)}">${escapeHtml(record.month)}</option>`).join("")}</select></label>
          <label class="form-field">Năng suất (tấn)<input name="yield" type="number" min="0" step="any" required></label>
          <label class="form-field">Sinh trưởng (%)<input name="growth" type="number" min="0" max="100" step="any" required></label>
          <label class="form-field">Thức ăn (triệu đồng)<input name="cost" type="number" min="0" step="any" required></label>
          <button type="submit" class="primary-button">Lưu số liệu</button>
        </form>
      </section>
    `,
    settings: `
      ${subHeading("Cài đặt", "Tùy chỉnh tài khoản và thông báo")}
      <div class="utility-grid">
        <section class="utility-card wide-panel"><h3>Tài khoản</h3><form id="accountSettingsForm"><label class="form-field">Họ và tên<input name="name" required value="${escapeAttribute(window.aquaAuth?.getCurrentUser()?.name || "")}"></label><label class="form-field">Email<input name="email" type="email" required value="${escapeAttribute(window.aquaAuth?.getCurrentUser()?.email || "")}"></label><div class="action-row"><button class="primary-button" type="submit" id="saveSettings">Lưu thay đổi</button></div></form></section>
        <section class="utility-card"><h3>Thông báo</h3><label class="form-field">Ngưỡng cảnh báo<select><option>Ngay lập tức</option><option>Gộp theo giờ</option><option>Tắt</option></select></label><label class="form-field">Kênh nhận<select><option>Ứng dụng và email</option><option>Ứng dụng</option><option>Email</option></select></label></section>
      </div>
    `,
    help: `
      ${subHeading("Trợ giúp", "Hướng dẫn sử dụng AquaSmart")}
      <div class="utility-grid">
        <section class="utility-card"><h3>Quản lý ao nuôi</h3><p>Thêm ao mới, cập nhật diện tích và loài nuôi, hoặc xóa ao khỏi danh sách quản lý.</p></section>
        <section class="utility-card"><h3>Giám sát môi trường</h3><p>Theo dõi nhiệt độ, pH và nồng độ oxy để xử lý kịp thời các thay đổi bất thường.</p></section>
        <section class="utility-card"><h3>Hỗ trợ kỹ thuật</h3><p>Liên hệ AquaSmart Support<br><strong>support@aquasmart.vn</strong></p></section>
      </div>
    `
  };

  if (overviewPage) overviewPage.hidden = page !== "overview";
  if (subPage) subPage.hidden = page === "overview";
  if (!subPage) return;
  subPage.innerHTML = pages[page] || pages.help;

  if (page === "ponds") {
    renderPonds(searchInput.value, document.getElementById("subPondRows"));
    renderPondMonitoring(document.getElementById("pondDeviceMonitorGrid"));
    const cameraDialog = document.getElementById("pondCameraDialog");
    cameraDialog?.querySelector(".equipment-dialog-close")?.addEventListener("click", () => cameraDialog.close());
    cameraDialog?.addEventListener("click", (event) => {
      if (event.target === cameraDialog) cameraDialog.close();
    });
  }
  if (page === "settings") {
    document.getElementById("accountSettingsForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        const result = await window.aquaAuth.updateCurrentUser(form.elements.name.value, form.elements.email.value);
        showToast(result.emailConfirmationRequired
          ? "Đã cập nhật tên. Hãy xác nhận email mới trong hộp thư."
          : "Đã cập nhật tài khoản");
      } catch (error) {
        showToast(error.message || "Không thể cập nhật tài khoản.", true);
      }
    });
  }
  if (page === "monitor") {
    renderPondInspectionHistory();
    document.getElementById("exportInspectionReport")?.addEventListener("click", exportPondInspectionsCsv);
    const inspectionForm = document.getElementById("pondInspectionForm");
    if (inspectionForm) {
      const pondSelect = inspectionForm.elements.pondId;
      const updateInspectionPreview = () => {
        const status = getPondStatus(
          Number(inspectionForm.elements.temperature.value),
          Number(inspectionForm.elements.ph.value),
          Number(inspectionForm.elements.do.value)
        );
        document.getElementById("inspectionStatusPreview").innerHTML = statusLabel(status);
      };
      const loadSelectedPond = () => {
        const pond = ponds.find((item) => String(item.id) === pondSelect.value);
        if (!pond) return;
        inspectionForm.elements.temperature.value = pond.temperature;
        inspectionForm.elements.ph.value = pond.ph;
        inspectionForm.elements.do.value = pond.do;
        updateInspectionPreview();
      };
      pondSelect.addEventListener("change", loadSelectedPond);
      ["temperature", "ph", "do"].forEach((field) => {
        inspectionForm.elements[field].addEventListener("input", updateInspectionPreview);
      });
      inspectionForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const pond = ponds.find((item) => String(item.id) === pondSelect.value);
        const measurements = {
          temperature: Number(inspectionForm.elements.temperature.value),
          ph: Number(inspectionForm.elements.ph.value),
          do: Number(inspectionForm.elements.do.value)
        };
        if (!pond || Object.values(measurements).some((value) => !Number.isFinite(value) || value <= 0) || measurements.ph > 14) {
          showToast("Kiểm tra lại ao và các chỉ số đã nhập.", true);
          return;
        }
        const originalPonds = ponds;
        const originalInspections = pondInspections;
        const nextPonds = ponds.map((item) => item.id === pond.id
          ? { ...item, ...measurements, status: getPondStatus(measurements.temperature, measurements.ph, measurements.do) }
          : item);
        const updatedPond = nextPonds.find((item) => item.id === pond.id);
        const nextInspections = [{
          id: Date.now(),
          pondId: pond.id,
          pondName: pond.name,
          checkedAt: new Date().toISOString(),
          ...measurements,
          status: updatedPond.status,
          note: String(inspectionForm.elements.note.value).trim()
        }, ...pondInspections];
        ponds = nextPonds;
        pondInspections = nextInspections;
        try {
          writeAppDataBatch([
            ["aquasmart-ponds", ponds],
            ["aquasmart-pond-inspections", pondInspections]
          ]);
        } catch {
          ponds = originalPonds;
          pondInspections = originalInspections;
          try {
            writeAppDataBatch([
              ["aquasmart-ponds", ponds],
              ["aquasmart-pond-inspections", pondInspections]
            ]);
          } catch {
            showToast("Không thể lưu dữ liệu kiểm tra trong trình duyệt.", true);
            return;
          }
          showToast("Không thể lưu dữ liệu kiểm tra trong trình duyệt.", true);
          return;
        }
        refreshPondViews();
        renderSubPage("monitor");
        showToast(`Đã lưu kiểm tra ${pond.name}`);
      });
    }
  }
  if (page === "reports") {
    renderReportBarCharts();
    const reportForm = document.getElementById("reportDataForm");
    const monthSelect = document.getElementById("reportMonthSelect");
    const fillReportForm = () => {
      const record = reportMonths.find((item) => item.month === monthSelect.value);
      reportForm.elements.yield.value = record.yield;
      reportForm.elements.growth.value = record.growth;
      reportForm.elements.cost.value = record.cost;
    };
    monthSelect.value = reportMonths[reportMonths.length - 1].month;
    fillReportForm();
    monthSelect.addEventListener("change", fillReportForm);
    reportForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = {
        yield: Number(reportForm.elements.yield.value),
        growth: Number(reportForm.elements.growth.value),
        cost: Number(reportForm.elements.cost.value)
      };
      if (Object.values(values).some((value) => !Number.isFinite(value) || value < 0) || values.growth > 100) {
        showToast("Kiểm tra lại các số liệu đã nhập.", true);
        return;
      }
      const index = reportMonths.findIndex((item) => item.month === monthSelect.value);
      const oldRecord = reportMonths[index];
      reportMonths[index] = { ...oldRecord, ...values };
      try {
        writeAppData("aquasmart-report-months", reportMonths);
      } catch {
        reportMonths[index] = oldRecord;
        showToast("Không thể lưu số liệu trong trình duyệt.", true);
        return;
      }
      renderReportBarCharts();
      showToast(`Đã lưu số liệu ${monthSelect.value}`);
    });
  }
  if (page === "log") {
    renderJournalEntries();
    renderJournalSummary();
    document.getElementById("journalEntryForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const entry = {
        id: Date.now(),
        pond: String(form.elements.pond.value),
        when: new Date(form.elements.when.value).toISOString(),
        activity: String(form.elements.activity.value).trim(),
        status: "Hoàn tất"
      };
      if (!entry.activity) {
        showToast("Nhập nội dung hoạt động.", true);
        return;
      }
      journalEntries.unshift(entry);
      try {
        writeAppData("aquasmart-journal", journalEntries);
      } catch {
        journalEntries.shift();
        showToast("Không thể lưu nhật ký trong trình duyệt.", true);
        return;
      }
      renderJournalEntries();
      renderJournalSummary();
      form.elements.activity.value = "";
      showToast("Đã thêm nhật ký nuôi");
    });
  }
  if (page === "market") {
    renderMarketItems(searchInput.value);
    document.getElementById("marketItemForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const name = String(data.get("name")).trim();
      const price = Number(data.get("price"));
      const imageFile = data.get("image");
      if (!name || !Number.isFinite(price) || price <= 0) {
        showToast("Nhập tên mặt hàng và giá lớn hơn 0.", true);
        return;
      }
      const addItem = (image = "") => {
        const item = { id: Date.now(), name, category: data.get("category"), price, image };
        marketItems.push(item);
        if (saveMarketItems()) {
          renderMarketItems(searchInput.value);
          form.reset();
          showToast(`Đã thêm ${name}`);
        } else {
          marketItems = marketItems.filter((product) => product.id !== item.id);
        }
      };
      if (imageFile instanceof File && imageFile.size) {
        if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(imageFile.type) || imageFile.size > 1024 * 1024) {
          showToast("Chọn ảnh PNG, JPEG, WebP hoặc GIF tối đa 1 MB.", true);
          return;
        }
        const reader = new FileReader();
        reader.addEventListener("load", () => addItem(String(reader.result)));
        reader.addEventListener("error", () => showToast("Không đọc được ảnh đã chọn.", true));
        reader.readAsDataURL(imageFile);
      } else {
        addItem();
      }
    });
  }
  if (page === "equipment") {
    subPage.querySelectorAll(".camera-fullscreen").forEach((button) => {
      button.addEventListener("click", () => showToast("Đang mở camera toàn màn hình"));
    });
    const equipmentDialog = document.getElementById("equipmentDialog");
    const equipmentDialogContent = document.getElementById("equipmentDialogContent");
    subPage.querySelectorAll(".equipment-open").forEach((button) => {
      button.addEventListener("click", () => {
        const device = equipmentDevices.find((item) => item.id === button.dataset.deviceId);
        if (!device || !equipmentDialog || !equipmentDialogContent) return;
        equipmentDialogContent.innerHTML = `
          <div class="equipment-dialog-body">
            <div class="equipment-detail-hero"><img src="${escapeAttribute(device.image)}" alt=""><div><h3>${escapeHtml(device.name)}</h3><p>${escapeHtml(device.type)}</p></div></div>
            <dl class="equipment-detail-list">
              <div><dt>Ao nuôi</dt><dd>${escapeHtml(device.pond)}</dd></div>
              <div><dt>Trạng thái mẫu</dt><dd>${escapeHtml(device.status)}</dd></div>
              <div><dt>Pin / nguồn</dt><dd>${escapeHtml(device.battery)}</dd></div>
              <div><dt>Cập nhật</dt><dd>${escapeHtml(device.updated)}</dd></div>
            </dl>
            <p class="equipment-description">${escapeHtml(device.description)}</p>
            <p class="equipment-demo-note">Đây là dữ liệu mô phỏng; ứng dụng chưa kết nối thiết bị phần cứng.</p>
            <button class="primary-button equipment-check-button" type="button">Chạy kiểm tra mô phỏng</button>
            <p class="equipment-check-result" aria-live="polite" hidden></p>
          </div>
        `;
        equipmentDialog.showModal();
        equipmentDialogContent.querySelector(".equipment-check-button").addEventListener("click", () => {
          const result = equipmentDialogContent.querySelector(".equipment-check-result");
          result.textContent = `Kiểm tra mô phỏng hoàn tất. Trạng thái mẫu: ${device.status}; ${device.battery}.`;
          result.hidden = false;
        });
      });
    });
    equipmentDialog?.querySelector(".equipment-dialog-close")?.addEventListener("click", () => equipmentDialog.close());
    equipmentDialog?.addEventListener("click", (event) => {
      if (event.target === equipmentDialog) equipmentDialog.close();
    });
  }
  subPage.querySelector(".sub-heading .primary-button")?.addEventListener("click", () => {
    if (page === "ponds") openModal();
    else if (page === "log") document.getElementById("journalEntryForm")?.scrollIntoView({ behavior: "smooth", block: "center" });
    else if (page === "equipment") showToast("Đã mở biểu mẫu thêm thiết bị");
    else if (page === "reports") exportReportCsv();
  });
}

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    const page = item.dataset.page;
    if (!page) return;
    if (page === "overview") {
      window.location.href = "index.html?v=20261123-3";
    } else {
      window.location.href = `${page}.html?v=20261123-3`;
    }
  });
});

const menuButton = document.getElementById("menuButton");
const addPondButton = document.getElementById("addPondButton");
const modalClose = document.getElementById("modalClose");
const cancelModal = document.getElementById("cancelModal");
menuButton?.addEventListener("click", () => sidebar?.classList.toggle("open"));
addPondButton?.addEventListener("click", () => openModal());
modalClose?.addEventListener("click", closeModal);
cancelModal?.addEventListener("click", closeModal);
modal?.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
});

pondForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!enforceAdminAction("edit ponds")) return;
  const form = new FormData(pondForm);
  const name = String(form.get("name")).trim();
  const area = Number(form.get("area"));
  const temperature = Number(form.get("temperature"));
  const ph = Number(form.get("ph"));
  const oxygen = Number(form.get("do"));

  if (!name || !Number.isFinite(area) || area <= 0 ||
      !Number.isFinite(temperature) || temperature <= 0 ||
      !Number.isFinite(ph) || ph <= 0 || ph > 14 ||
      !Number.isFinite(oxygen) || oxygen <= 0) {
    showToast("Kiểm tra tên ao, diện tích và các chỉ số môi trường.", true);
    return;
  }

  if (editingId) {
    const pond = ponds.find((item) => item.id === editingId);
    Object.assign(pond, { name, area, species: form.get("species"), note: form.get("note"), temperature, ph, do: oxygen });
    pond.status = getPondStatus(temperature, ph, oxygen);
    showToast(`Đã cập nhật ${name}`);
  } else {
    ponds.push({
      id: Date.now(),
      name,
      area,
      species: form.get("species"),
      note: form.get("note"),
      temperature,
      ph,
      do: oxygen,
      status: getPondStatus(temperature, ph, oxygen)
    });
    showToast(`Đã thêm ${name}`);
  }

  savePonds();
  refreshPondViews();
  closeModal();
});

searchInput.addEventListener("input", () => {
  if (document.body.dataset.page === "market") {
    renderMarketItems(searchInput.value);
    return;
  }
  const subPondRows = document.getElementById("subPondRows");
  renderPonds(searchInput.value, subPondRows || pondRows);
});

document.querySelectorAll(".alert-item").forEach((item) => {
  item.addEventListener("click", () => {
    item.classList.toggle("read");
    showToast(item.classList.contains("read") ? "Đã đánh dấu cảnh báo là đã xem" : "Đã bỏ đánh dấu đã xem");
  });
});

document.querySelector(".notification")?.addEventListener("click", () => {
  document.querySelector(".alert-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
});

function drawChart() {
  const canvas = document.getElementById("environmentChart");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);

  const width = rect.width;
  const height = rect.height;
  const padding = { top: 18, right: 8, bottom: 28, left: 38 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const labels = window.chartLabels || ["12/11", "13/11", "14/11", "15/11", "16/11", "17/11", "18/11"];
  const pondAverage = (field, fallback) => ponds.length
    ? ponds.reduce((sum, pond) => sum + Number(pond[field] || 0), 0) / ponds.length
    : fallback;
  const averageTemperature = pondAverage("temperature", 27.8);
  const averageOxygen = pondAverage("do", 6.4);
  const temperature = window.chartTemperature || [0.8, 0.4, 0.6, 0.2, 0.5, 0.1, 0].map((delta, i) => averageTemperature - delta + (i % 2 ? 0.1 : 0));
  const oxygen = window.chartOxygen || [0.3, 0.1, 0.4, 0.05, 0.2, 0.15, 0].map((delta, i) => averageOxygen - delta + (i % 2 ? 0.05 : 0));

  ctx.clearRect(0, 0, width, height);
  ctx.font = "9px Be Vietnam Pro, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (plotHeight / 4) * i;
    ctx.strokeStyle = "#edf1f3";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillStyle = "#9aa8b2";
    ctx.fillText(String(30 - i * 2), padding.left - 10, y);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  labels.forEach((label, i) => {
    const x = padding.left + (plotWidth / (labels.length - 1 || 1)) * i;
    ctx.fillStyle = "#9aa8b2";
    ctx.fillText(label, x, height - 16);
  });

  function drawLine(values, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    values.forEach((value, i) => {
      const x = padding.left + (plotWidth / (values.length - 1 || 1)) * i;
      const y = padding.top + ((30 - value) / 8) * plotHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    values.forEach((value, i) => {
      const x = padding.left + (plotWidth / (values.length - 1 || 1)) * i;
      const y = padding.top + ((30 - value) / 8) * plotHeight;
      ctx.beginPath();
      ctx.arc(x, y, 3.1, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  drawLine(temperature, "#4e86df");
  drawLine(oxygen.map((value) => 22 + value), "#1ab0a5");
}

document.querySelector(".period-button")?.addEventListener("click", () => {
  const options = ["7 ngày", "14 ngày", "30 ngày"];
  const button = document.querySelector(".period-button");
  const current = options.findIndex((option) => button.textContent.includes(option));
  const next = (current + 1) % options.length;
  const days = [7, 14, 30][next];
  window.chartLabels = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1) + i * Math.floor(days / 7));
    return `${date.getDate()}/${date.getMonth() + 1}`;
  });
  window.chartTemperature = Array.from({ length: 7 }, (_, i) => 27.2 + Math.sin(i * 0.8) * 0.7 + (next * 0.08));
  window.chartOxygen = Array.from({ length: 7 }, (_, i) => 6.1 + Math.cos(i * 0.7) * 0.35);
  button.innerHTML = `${options[next]} <svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg>`;
  drawChart();
  showToast(`Đã đổi sang ${options[next]}`);
});

const currentPage = document.body.dataset.page;
if (currentPage && currentPage !== "overview") {
  renderSubPage(currentPage);
} else {
  updateOverview();
  renderPonds();
  drawChart();
  window.addEventListener("resize", drawChart);
}
applyViewerMode();
})();
