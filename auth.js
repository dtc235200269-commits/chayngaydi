(() => {
  const REMEMBER_KEY = "aquasmart-remember-session";
  const DATA_TABLE = "aquasmart_user_data";
  const authPage = document.body.dataset.authPage === "true";
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");
  const loginSwitch = document.getElementById("loginSwitch");
  const registerSwitch = document.getElementById("registerSwitch");
  const title = document.getElementById("authTitle");
  const message = document.getElementById("authMessage");
  let supabaseClient;
  let currentUser = null;
  let pendingDataWrite = Promise.resolve();

  function showMessage(text, isError = true) {
    if (!message) return;
    message.textContent = text;
    message.classList.toggle("error", isError);
  }

  function getDataSyncErrorMessage(error) {
    if (error?.code === "PGRST205") {
      return `Bảng ${DATA_TABLE} chưa được tạo. Hãy chạy supabase/schema.sql trong Supabase SQL Editor.`;
    }
    return error?.message || "Lỗi kết nối Supabase.";
  }

  function showProtectedPageError(error) {
    const container = document.querySelector(".content") || document.body;
    const alert = document.createElement("section");
    alert.className = "utility-card backend-setup-error";
    alert.setAttribute("role", "alert");
    alert.textContent = `Không thể khởi động AquaSmart: ${error.message || "lỗi kết nối Supabase."}`;
    container.prepend(alert);
  }

  function authStorage() {
    return {
      getItem(key) {
        return sessionStorage.getItem(key) || localStorage.getItem(key);
      },
      setItem(key, value) {
        const remember = localStorage.getItem(REMEMBER_KEY) !== "false";
        const target = remember ? localStorage : sessionStorage;
        const other = remember ? sessionStorage : localStorage;
        target.setItem(key, value);
        other.removeItem(key);
      },
      removeItem(key) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }
    };
  }

  function normalizeEmail(email) {
    return email.trim().toLocaleLowerCase("en-US");
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function mapUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email || "",
      name: String(user.user_metadata?.name || user.email?.split("@")[0] || "Người dùng"),
      role: user.app_metadata?.role === "admin" ? "admin" : "viewer"
    };
  }

  function syncProfiles(user) {
    document.querySelectorAll(".profile").forEach((profile) => {
      const avatar = profile.querySelector(".avatar");
      const name = profile.querySelector(".profile-copy strong");
      const email = profile.querySelector(".profile-copy span");
      const welcomeName = document.getElementById("welcomeName");
      if (avatar) avatar.textContent = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("vi");
      if (name) name.textContent = user.name;
      if (email) email.textContent = user.email;
      if (welcomeName) welcomeName.textContent = user.name.trim().split(/\s+/).slice(-1)[0];
      if (!profile.querySelector(".auth-logout")) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "auth-logout";
        button.textContent = "Thoát";
        button.setAttribute("aria-label", "Đăng xuất");
        button.addEventListener("click", async () => {
          try {
            const { error } = await supabaseClient.auth.signOut({ scope: "local" });
            if (error) throw error;
            window.location.replace(new URL("auth.html?v=20261123-8", window.location.href).href);
          } catch (error) {
            const toast = document.getElementById("toast");
            if (toast) {
              toast.textContent = `Không thể đăng xuất: ${error.message}`;
              toast.className = "toast show error";
            }
          }
        });
        profile.append(button);
      }
    });
  }

  function getCurrentUser() {
    return currentUser;
  }

  function isAdmin() {
    return currentUser?.role === "admin";
  }

  async function saveAppDataBatch(entries) {
    if (!isAdmin()) throw new Error("Tài khoản chỉ có quyền xem. Chỉ tài khoản Admin mới được chỉnh dữ liệu.");
    if (!currentUser) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    if (!Array.isArray(entries) || entries.some((entry) => !Array.isArray(entry) || entry.length !== 2)) {
      throw new Error("Dữ liệu cần đồng bộ không hợp lệ.");
    }

    const rows = entries.map(([dataKey, dataValue]) => ({
      user_id: currentUser.id,
      data_key: dataKey,
      data_value: dataValue,
      updated_at: new Date().toISOString()
    }));
    const write = pendingDataWrite.catch(() => {}).then(async () => {
      const { error } = await supabaseClient
        .from(DATA_TABLE)
        .upsert(rows, { onConflict: "user_id,data_key" });
      if (error) throw new Error(getDataSyncErrorMessage(error));
    });
    pendingDataWrite = write;
    await write;
  }

  function saveAppData(dataKey, dataValue) {
    return saveAppDataBatch([[dataKey, dataValue]]);
  }

  async function syncAppData() {
    if (!currentUser) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    const { data, error } = await supabaseClient
      .from(DATA_TABLE)
      .select("data_key,data_value");
    if (error) throw new Error(`Không tải được dữ liệu từ Supabase: ${getDataSyncErrorMessage(error)}`);

    try {
      for (const row of data || []) {
        if (typeof row.data_key !== "string") {
          throw new Error("Supabase trả về khóa dữ liệu không hợp lệ.");
        }
        localStorage.setItem(`${row.data_key}:${currentUser.id}`, JSON.stringify(row.data_value));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        throw new Error("Không đủ dung lượng trình duyệt để lưu bộ nhớ đệm dữ liệu.");
      }
      throw error;
    }
  }

  async function updateCurrentUser(name, email) {
    if (!currentUser) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    const normalizedEmail = normalizeEmail(email);
    const normalizedName = name.trim();
    if (!normalizedName || !isValidEmail(normalizedEmail)) {
      throw new Error("Vui lòng nhập họ tên và email hợp lệ.");
    }

    const emailConfirmationRequired = normalizedEmail !== currentUser.email;
    const updates = { data: { name: normalizedName } };
    if (emailConfirmationRequired) updates.email = normalizedEmail;
    const { data, error } = await supabaseClient.auth.updateUser(updates);
    if (error) throw new Error(error.message);
    currentUser = mapUser(data.user);
    syncProfiles(currentUser);
    return { user: currentUser, emailConfirmationRequired };
  }

  async function loadConfiguration() {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = new URL("supabase-config.js", window.location.href).href;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error("Không tải được tệp supabase-config.js.")), { once: true });
      document.head.append(script);
    });

    const config = window.AQUASMART_SUPABASE_CONFIG;
    if (!config || typeof config.url !== "string" || typeof config.anonKey !== "string" ||
        !config.url.trim() || !config.anonKey.trim()) {
      throw new Error("Hãy điền Supabase URL và publishable/anon key trong supabase-config.js.");
    }

    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    supabaseClient = createClient(config.url.trim(), config.anonKey.trim(), {
      auth: {
        storage: authStorage(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
  }

  function setRememberPreference() {
    const remember = document.getElementById("rememberMe")?.checked !== false;
    localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
  }

  function selectForm(isRegister) {
    loginForm.hidden = isRegister;
    registerForm.hidden = !isRegister;
    loginSwitch.hidden = isRegister;
    registerSwitch.hidden = !isRegister;
    title.textContent = isRegister ? "Tạo tài khoản" : "Đăng nhập";
    message.textContent = "";
    message.classList.remove("error");
  }

  async function handleLogin(event) {
    event.preventDefault();
    const email = normalizeEmail(loginForm.elements.email.value);
    const password = loginForm.elements.password.value;
    if (!isValidEmail(email) || !password) {
      showMessage("Vui lòng nhập email hợp lệ và mật khẩu.");
      return;
    }
    try {
      if (!await window.aquaAuthReady || !supabaseClient) return;
      setRememberPreference();
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.code === "invalid_credentials" ? "Email hoặc mật khẩu không chính xác." : `Không thể đăng nhập: ${error.message}`);
      window.location.replace(new URL("index.html?v=20261123-3", window.location.href).href);
    } catch (error) {
      showMessage(error.message || "Không thể đăng nhập.");
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    const name = registerForm.elements.name.value.trim();
    const email = normalizeEmail(registerForm.elements.email.value);
    const password = registerForm.elements.password.value;
    const confirmPassword = registerForm.elements.confirmPassword.value;
    if (!name || !isValidEmail(email) || !password) {
      showMessage("Vui lòng điền tên, email hợp lệ và mật khẩu.");
      return;
    }
    if (password.length < 8) {
      showMessage("Mật khẩu cần có ít nhất 8 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      showMessage("Mật khẩu nhập lại không khớp.");
      return;
    }
    const submitButton = registerForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Đang tạo tài khoản...";
    try {
      if (!await window.aquaAuthReady || !supabaseClient) return;
      setRememberPreference();
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { name, role: "viewer" },
          emailRedirectTo: new URL("auth.html", window.location.href).href
        }
      });
      if (error) {
        if (error.code === "user_already_exists" || error.status === 422) {
          throw new Error("Email này đã được đăng ký. Hãy đăng nhập.");
        }
        throw error;
      }
      if (!data.session) {
        const { error: loginError } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (loginError) {
          showMessage("Tạo tài khoản thành công. Hãy đăng nhập bằng email và mật khẩu vừa tạo.", false);
          selectForm(false);
          loginForm.elements.email.value = email;
          return;
        }
      }
      showMessage("Tạo tài khoản thành công. Đang mở AquaSmart...", false);
      window.location.replace(new URL("index.html?v=20261123-4", window.location.href).href);
    } catch (error) {
      showMessage(error.message || "Không thể tạo tài khoản.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Tạo tài khoản";
    }
  }

  if (authPage) {
    loginTab.addEventListener("click", () => selectForm(false));
    registerTab.addEventListener("click", () => selectForm(true));
    loginForm.addEventListener("submit", handleLogin);
    registerForm.addEventListener("submit", handleRegister);
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = button.parentElement.querySelector("input");
        const visible = input.type === "password";
        input.type = visible ? "text" : "password";
        button.classList.toggle("is-visible", visible);
        button.setAttribute("aria-label", visible ? "Ẩn mật khẩu" : "Hiện mật khẩu");
      });
    });
  }

  async function bootstrap() {
    try {
      await loadConfiguration();
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      const session = data.session;

      if (authPage) {
        if (session) {
          window.location.replace(new URL("index.html?v=20261123-3", window.location.href).href);
          return false;
        }
        return true;
      }

      if (!session) {
        window.location.replace(new URL("auth.html?v=20261123-8", window.location.href).href);
        return false;
      }

      currentUser = mapUser(session.user);
      window.aquaAuth = { getCurrentUser, isAdmin, updateCurrentUser, saveAppData, saveAppDataBatch, syncAppData };
      await syncAppData();
      syncProfiles(currentUser);
      supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
        currentUser = mapUser(nextSession?.user);
        if (currentUser) syncProfiles(currentUser);
      });
      return true;
    } catch (error) {
      if (authPage) showMessage(error.message || "Không thể khởi động xác thực Supabase.");
      else showProtectedPageError(error);
      return false;
    }
  }

  window.aquaAuthReady = bootstrap();
})();
(() => {
  const REMEMBER_KEY = "aquasmart-remember-session";
  const DATA_TABLE = "aquasmart_user_data";
  const authPage = document.body.dataset.authPage === "true";
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");
  const loginSwitch = document.getElementById("loginSwitch");
  const registerSwitch = document.getElementById("registerSwitch");
  const title = document.getElementById("authTitle");
  const message = document.getElementById("authMessage");
  let supabaseClient;
  let currentUser = null;
  let pendingDataWrite = Promise.resolve();

  function showMessage(text, isError = true) {
    if (!message) return;
    message.textContent = text;
    message.classList.toggle("error", isError);
  }

  function getDataSyncErrorMessage(error) {
    if (error?.code === "PGRST205") {
      return `Bảng ${DATA_TABLE} chưa được tạo. Hãy chạy supabase/schema.sql trong Supabase SQL Editor.`;
    }
    return error?.message || "Lỗi kết nối Supabase.";
  }

  function showProtectedPageError(error) {
    const container = document.querySelector(".content") || document.body;
    const alert = document.createElement("section");
    alert.className = "utility-card backend-setup-error";
    alert.setAttribute("role", "alert");
    alert.textContent = `Không thể khởi động AquaSmart: ${error.message || "lỗi kết nối Supabase."}`;
    container.prepend(alert);
  }

  function authStorage() {
    return {
      getItem(key) {
        return sessionStorage.getItem(key) || localStorage.getItem(key);
      },
      setItem(key, value) {
        const remember = localStorage.getItem(REMEMBER_KEY) !== "false";
        const target = remember ? localStorage : sessionStorage;
        const other = remember ? sessionStorage : localStorage;
        target.setItem(key, value);
        other.removeItem(key);
      },
      removeItem(key) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }
    };
  }

  function normalizeEmail(email) {
    return email.trim().toLocaleLowerCase("en-US");
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function mapUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email || "",
      name: String(user.user_metadata?.name || user.email?.split("@")[0] || "Người dùng")
    };
  }

  function syncProfiles(user) {
    document.querySelectorAll(".profile").forEach((profile) => {
      const avatar = profile.querySelector(".avatar");
      const name = profile.querySelector(".profile-copy strong");
      const email = profile.querySelector(".profile-copy span");
      const welcomeName = document.getElementById("welcomeName");
      if (avatar) avatar.textContent = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("vi");
      if (name) name.textContent = user.name;
      if (email) email.textContent = user.email;
      if (welcomeName) welcomeName.textContent = user.name.trim().split(/\s+/).slice(-1)[0];
      if (!profile.querySelector(".auth-logout")) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "auth-logout";
        button.textContent = "Thoát";
        button.setAttribute("aria-label", "Đăng xuất");
        button.addEventListener("click", async () => {
          try {
            const { error } = await supabaseClient.auth.signOut({ scope: "local" });
            if (error) throw error;
            window.location.replace(new URL("auth.html?v=20261123-8", window.location.href).href);
          } catch (error) {
            const toast = document.getElementById("toast");
            if (toast) {
              toast.textContent = `Không thể đăng xuất: ${error.message}`;
              toast.className = "toast show error";
            }
          }
        });
        profile.append(button);
      }
    });
  }

  function getCurrentUser() {
    return currentUser;
  }

  async function saveAppDataBatch(entries) {
    if (!currentUser) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    if (!Array.isArray(entries) || entries.some((entry) => !Array.isArray(entry) || entry.length !== 2)) {
      throw new Error("Dữ liệu cần đồng bộ không hợp lệ.");
    }

    const rows = entries.map(([dataKey, dataValue]) => ({
      user_id: currentUser.id,
      data_key: dataKey,
      data_value: dataValue,
      updated_at: new Date().toISOString()
    }));
    const write = pendingDataWrite.catch(() => {}).then(async () => {
      const { error } = await supabaseClient
        .from(DATA_TABLE)
        .upsert(rows, { onConflict: "user_id,data_key" });
      if (error) throw new Error(getDataSyncErrorMessage(error));
    });
    pendingDataWrite = write;
    await write;
  }

  function saveAppData(dataKey, dataValue) {
    return saveAppDataBatch([[dataKey, dataValue]]);
  }

  async function syncAppData() {
    if (!currentUser) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    const { data, error } = await supabaseClient
      .from(DATA_TABLE)
      .select("data_key,data_value");
    if (error) throw new Error(`Không tải được dữ liệu từ Supabase: ${getDataSyncErrorMessage(error)}`);

    try {
      for (const row of data || []) {
        if (typeof row.data_key !== "string") {
          throw new Error("Supabase trả về khóa dữ liệu không hợp lệ.");
        }
        localStorage.setItem(`${row.data_key}:${currentUser.id}`, JSON.stringify(row.data_value));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        throw new Error("Không đủ dung lượng trình duyệt để lưu bộ nhớ đệm dữ liệu.");
      }
      throw error;
    }
  }

  async function updateCurrentUser(name, email) {
    if (!currentUser) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    const normalizedEmail = normalizeEmail(email);
    const normalizedName = name.trim();
    if (!normalizedName || !isValidEmail(normalizedEmail)) {
      throw new Error("Vui lòng nhập họ tên và email hợp lệ.");
    }

    const emailConfirmationRequired = normalizedEmail !== currentUser.email;
    const updates = { data: { name: normalizedName } };
    if (emailConfirmationRequired) updates.email = normalizedEmail;
    const { data, error } = await supabaseClient.auth.updateUser(updates);
    if (error) throw new Error(error.message);
    currentUser = mapUser(data.user);
    syncProfiles(currentUser);
    return { user: currentUser, emailConfirmationRequired };
  }

  async function loadConfiguration() {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = new URL("supabase-config.js", window.location.href).href;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error("Không tải được tệp supabase-config.js.")), { once: true });
      document.head.append(script);
    });

    const config = window.AQUASMART_SUPABASE_CONFIG;
    if (!config || typeof config.url !== "string" || typeof config.anonKey !== "string" ||
        !config.url.trim() || !config.anonKey.trim()) {
      throw new Error("Hãy điền Supabase URL và publishable/anon key trong supabase-config.js.");
    }

    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    supabaseClient = createClient(config.url.trim(), config.anonKey.trim(), {
      auth: {
        storage: authStorage(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
  }

  function setRememberPreference() {
    const remember = document.getElementById("rememberMe")?.checked !== false;
    localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
  }

  function selectForm(isRegister) {
    loginForm.hidden = isRegister;
    registerForm.hidden = !isRegister;
    loginSwitch.hidden = isRegister;
    registerSwitch.hidden = !isRegister;
    title.textContent = isRegister ? "Tạo tài khoản" : "Đăng nhập";
    message.textContent = "";
    message.classList.remove("error");
  }

  async function handleLogin(event) {
    event.preventDefault();
    const email = normalizeEmail(loginForm.elements.email.value);
    const password = loginForm.elements.password.value;
    if (!isValidEmail(email) || !password) {
      showMessage("Vui lòng nhập email hợp lệ và mật khẩu.");
      return;
    }
    try {
      if (!await window.aquaAuthReady || !supabaseClient) return;
      setRememberPreference();
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.code === "invalid_credentials" ? "Email hoặc mật khẩu không chính xác." : `Không thể đăng nhập: ${error.message}`);
      window.location.replace(new URL("index.html?v=20261123-3", window.location.href).href);
    } catch (error) {
      showMessage(error.message || "Không thể đăng nhập.");
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    const name = registerForm.elements.name.value.trim();
    const email = normalizeEmail(registerForm.elements.email.value);
    const password = registerForm.elements.password.value;
    const confirmPassword = registerForm.elements.confirmPassword.value;
    if (!name || !isValidEmail(email) || !password) {
      showMessage("Vui lòng điền tên, email hợp lệ và mật khẩu.");
      return;
    }
    if (password.length < 8) {
      showMessage("Mật khẩu cần có ít nhất 8 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      showMessage("Mật khẩu nhập lại không khớp.");
      return;
    }
    const submitButton = registerForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Đang tạo tài khoản...";
    try {
      if (!await window.aquaAuthReady || !supabaseClient) return;
      setRememberPreference();
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: new URL("auth.html", window.location.href).href
        }
      });
      if (error) {
        if (error.code === "user_already_exists" || error.status === 422) {
          throw new Error("Email này đã được đăng ký. Hãy đăng nhập.");
        }
        throw error;
      }
      if (!data.session) {
        const { error: loginError } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (loginError) {
          showMessage("Tạo tài khoản thành công. Hãy đăng nhập bằng email và mật khẩu vừa tạo.", false);
          selectForm(false);
          loginForm.elements.email.value = email;
          return;
        }
      }
      showMessage("Tạo tài khoản thành công. Đang mở AquaSmart...", false);
      window.location.replace(new URL("index.html?v=20261123-4", window.location.href).href);
    } catch (error) {
      showMessage(error.message || "Không thể tạo tài khoản.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Tạo tài khoản";
    }
  }

  if (authPage) {
    loginTab.addEventListener("click", () => selectForm(false));
    registerTab.addEventListener("click", () => selectForm(true));
    loginForm.addEventListener("submit", handleLogin);
    registerForm.addEventListener("submit", handleRegister);
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = button.parentElement.querySelector("input");
        const visible = input.type === "password";
        input.type = visible ? "text" : "password";
        button.classList.toggle("is-visible", visible);
        button.setAttribute("aria-label", visible ? "Ẩn mật khẩu" : "Hiện mật khẩu");
      });
    });
  }

  async function bootstrap() {
    try {
      await loadConfiguration();
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      const session = data.session;

      if (authPage) {
        if (session) {
          window.location.replace(new URL("index.html?v=20261123-3", window.location.href).href);
          return false;
        }
        return true;
      }

      if (!session) {
        window.location.replace(new URL("auth.html?v=20261123-8", window.location.href).href);
        return false;
      }

      currentUser = mapUser(session.user);
      window.aquaAuth = { getCurrentUser, updateCurrentUser, saveAppData, saveAppDataBatch, syncAppData };
      await syncAppData();
      syncProfiles(currentUser);
      supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
        currentUser = mapUser(nextSession?.user);
        if (currentUser) syncProfiles(currentUser);
      });
      return true;
    } catch (error) {
      if (authPage) showMessage(error.message || "Không thể khởi động xác thực Supabase.");
      else showProtectedPageError(error);
      return false;
    }
  }

  window.aquaAuthReady = bootstrap();
})();
