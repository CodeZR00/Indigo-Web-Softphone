// ======================================================
// DYNAMIC CONFIG (client-provided)
// ======================================================
let TOKEN_URL = localStorage.getItem("twilio_token_url") || "";
let AGENT_IDENTITY = localStorage.getItem("twilio_identity") || "agent_1001";

// ======================================================
// STATE
// ======================================================
let device = null;
let activeCall = null;
let remoteAudioEl = null;
let pendingIncomingCall = null;
let currentState = "boot";

let isMuted = false;
let isOnHold = false;
let callSeconds = 0;
let timerInterval = null;
let tokenRefreshing = false; 

// ======================================================
// DOM
// ======================================================
const phoneInput = document.getElementById("phoneNumber");
const clearBtn = document.getElementById("clearBtn");
const callBtn = document.getElementById("callBtn");
const hangupBtn = document.getElementById("hangupBtn");
const callStatus = document.getElementById("callStatus");
const backspaceBtn = document.getElementById("backspaceBtn");
const dialpadEl = document.getElementById("dialpad");

const incallTools = document.getElementById("incallTools");
const muteBtn = document.getElementById("muteBtn");
const holdBtn = document.getElementById("holdBtn");
const callTimerEl = document.getElementById("callTimer");

const incomingPopup = document.getElementById("incomingPopup");
const acceptBtn = document.getElementById("acceptBtn");
const rejectBtn = document.getElementById("rejectBtn");

// ==============================
// SETTINGS DOM
// ==============================
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const tokenUrlInput = document.getElementById("tokenUrlInput");
const identityInput = document.getElementById("identityInput");

// ======================================================
// AUDIO (incoming only — Twilio handles ringback)
// ======================================================
let ringtone = null;

try {
  ringtone = new Audio("audio/ringtone.mp3");
  ringtone.loop = true;
} catch (e) {
  console.warn("Ringtone not available");
}

function setRemoteAudioMuted(muted) {
  try {
    if (remoteAudioEl) {
      remoteAudioEl.muted = muted;
    }
  } catch (e) {
    console.warn("Remote audio mute failed:", e);
  }
}

// ======================================================
// TIMER HELPERS
// ======================================================
function startTimer() {
  stopTimer();
  callSeconds = 0;

  timerInterval = setInterval(() => {
    callSeconds++;
    const m = String(Math.floor(callSeconds / 60)).padStart(2, "0");
    const s = String(callSeconds % 60).padStart(2, "0");
    callTimerEl.textContent = `${m}:${s}`;
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  callTimerEl.textContent = "00:00";
}

// ======================================================
// CALL CLEANUP (authoritative)
// ======================================================
function cleanupCallUI() {
  if (ringtone) {
    ringtone.pause();
    ringtone.currentTime = 0;
  }

  incomingPopup.style.display = "none";
  incallTools.style.display = "none";

  stopTimer();

  isMuted = false;
  isOnHold = false;
  setRemoteAudioMuted(false);
  muteBtn.classList.remove("active");
  holdBtn.classList.remove("active");
  remoteAudioEl = null;
  activeCall = null;
  pendingIncomingCall = null;

  setState("ready", "Ready");
}

// ======================================================
// STATE MACHINE
// ======================================================
function setState(state, message) {
  currentState = state;
  callStatus.textContent = message || state;
  callStatus.className = "status " + state;

  // keypad visual mode
  if (state === "incall") {
    dialpadEl.classList.add("incall-mode");
  } else {
    dialpadEl.classList.remove("incall-mode");
  }

  switch (state) {
    case "ready":
      callBtn.disabled = false;
      hangupBtn.disabled = true;
      break;

    case "calling":
    case "incall":
      callBtn.disabled = true;
      hangupBtn.disabled = false;
      break;

    case "error":
    case "boot":
    default:
      callBtn.disabled = true;
      hangupBtn.disabled = true;

    case "ringing":
      callBtn.disabled = true;
      hangupBtn.disabled = true;
    break;
    }
}

// ======================================================
// SMART DIAL PAD (NUMBER + DTMF)
// ======================================================
document.querySelectorAll(".dialpad-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const digit = btn.dataset.digit;

    // During live call → send DTMF
    if (activeCall && currentState === "incall") {
      try {
        activeCall.sendDigits(digit);
        console.log("DTMF sent:", digit);
      } catch (e) {
        console.error("DTMF failed:", e);
      }
      return;
    }

    // Otherwise → build number
    phoneInput.value += digit;
  });
});

// ======================================================
// INPUT HELPERS
// ======================================================
backspaceBtn.addEventListener("click", () => {
  phoneInput.value = phoneInput.value.slice(0, -1);
});

clearBtn.addEventListener("click", () => {
  phoneInput.value = "";
});

phoneInput.addEventListener("keydown", e => {
  if (e.key === "Enter") callBtn.click();
});

// ======================================================
// INIT TWILIO
// ======================================================
async function initTwilio() {
  try {
    setState("boot", "Initializing device…");
    setState("boot", "Getting token…");

    // Build URL safely
    let url = TOKEN_URL;

    if (!url) {
      setState("error", "Configure Twilio in Settings");
      return;
    }

    // auto-append identity if not present
    if (!url.includes("identity=")) {
      const sep = url.includes("?") ? "&" : "?";
      url = `${url}${sep}identity=${encodeURIComponent(AGENT_IDENTITY)}`;
    }

    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();

    if (!data.token) throw new Error("Token missing");

    if (device) {
      device.destroy();
      device = null;
    }

    device = new Twilio.Device(data.token, {
      logLevel: 1,
      codecPreferences: ["opus", "pcmu"]
    });

    // ========================
    // DEVICE EVENTS
    // ========================
    device.on("registered", () => {
      console.log("Device registered");
      setState("ready", "Ready");
    });

    device.on("error", err => {
      console.error("Device error:", err);
      setState("error", "Device error: " + err.message);
    });

    device.on("offline", () => {
      console.warn("Device offline");
      setState("error", "Connection lost");
    });

    device.on("unregistered", () => {
      console.warn("Device unregistered");
      setState("error", "Device disconnected");
    });

    // ========================
    // INCOMING CALL (popup)
    // ========================
    device.on("incoming", call => {
      console.log("Incoming call");

      pendingIncomingCall = call;

      if (ringtone) {
        ringtone.currentTime = 0;
        ringtone.play().catch(e => console.warn("Ringtone blocked:", e));
      }

      incomingPopup.style.display = "flex";
      setState("ringing", "Incoming call…");

      const endHandler = () => {
        console.log("Call ended");
        cleanupCallUI();
      };

      call.on("disconnect", endHandler);
      call.on("cancel", endHandler);
      call.on("reject", endHandler);
      call.on("error", endHandler);
    });

    // ========================
    // TOKEN REFRESH (HARDENED)
    // ========================
    device.on("tokenWillExpire", async () => {
      if (tokenRefreshing) return;
      tokenRefreshing = true;

      console.log("Refreshing token…");

      try {
        let refreshUrl = TOKEN_URL;

        if (!refreshUrl.includes("identity=")) {
          const sep = refreshUrl.includes("?") ? "&" : "?";
          refreshUrl = `${refreshUrl}${sep}identity=${encodeURIComponent(AGENT_IDENTITY)}`;
        }

        const r = await fetch(refreshUrl, { cache: "no-store" });
        const d = await r.json();

        device.updateToken(d.token);
        console.log("Token refreshed");
      } catch (e) {
        console.error("Token refresh failed", e);
      } finally {
        tokenRefreshing = false;
      }
    });

    await device.register();
  } catch (err) {
    console.error("Init failed:", err);
    setState("error", "Initialization failed");
  }
}
// ======================================================
// CALL
// ======================================================
async function placeCall(number) {
  if (!device) return;
  if (!number) return;

  try {
    setState("calling", "Calling…");

    // await the call
    const call = await device.connect({
      params: { To: number }
    });

    console.log("Outbound call object ready");

    // DOUBLE-CONNECT GUARD (CRITICAL FIX)
    let connectedHandled = false;

    const onConnected = () => {
      if (connectedHandled) return;
      connectedHandled = true;

      console.log("Outbound call connected");

      activeCall = call;

      call.on("audio", (audio) => {
        console.log("Remote audio attached");
        remoteAudioEl = audio;

        if (isOnHold) {
          remoteAudioEl.muted = true;
        }
      });

      incallTools.style.display = "block";

      isMuted = false;
      isOnHold = false;
      muteBtn.classList.remove("active");
      holdBtn.classList.remove("active");

      startTimer();
      setState("incall", "In call");
    };

    call.once("accept", onConnected);
    call.once("connect", onConnected);

    // unified end handler
    const endHandler = () => {
      console.log("Call ended");
      cleanupCallUI();
    };

    call.on("disconnect", endHandler);
    call.on("cancel", endHandler);
    call.on("reject", endHandler);
    call.on("error", endHandler);

  } catch (err) {
    console.error("Call failed:", err);
    setState("error", "Call failed");
  }
}

callBtn.addEventListener("click", async () => {
  const number = phoneInput.value.trim();

  if (!number) {
    setState("ready", "Enter a number");
    return;
  }

  placeCall(number);
});

// ======================================================
// HANGUP
// ======================================================
function hangUp() {
  try {
    if (activeCall) {
      activeCall.disconnect();
    } else if (pendingIncomingCall) {
      pendingIncomingCall.reject();
    } else if (device) {
      device.disconnectAll();
    }
  } catch (e) {
    console.error("Hangup error:", e);
  }

  cleanupCallUI();
}

hangupBtn.addEventListener("click", hangUp);

// ======================================================
// ACCEPT / REJECT
// ======================================================
acceptBtn.addEventListener("click", () => {
  if (!pendingIncomingCall) return;

  activeCall = pendingIncomingCall;
  pendingIncomingCall = null;

  if (ringtone) ringtone.pause();
  incomingPopup.style.display = "none";

  activeCall.accept();

  activeCall.on("audio", (audio) => {
    console.log("Remote audio attached (inbound)");
    remoteAudioEl = audio;

    if (isOnHold) {
      remoteAudioEl.muted = true;
    }
  });

  incallTools.style.display = "block";

  isMuted = false;
  isOnHold = false;
  muteBtn.classList.remove("active");
  holdBtn.classList.remove("active");

  startTimer();
  setState("incall", "In call");
});

rejectBtn.addEventListener("click", () => {
  if (!pendingIncomingCall) return;

  if (ringtone) ringtone.pause();
  pendingIncomingCall.reject();
  pendingIncomingCall = null;

  incomingPopup.style.display = "none";
  setState("ready", "Ready");
});

// ======================================================
// MUTE
// ======================================================
muteBtn.addEventListener("click", () => {
  if (!activeCall || currentState !== "incall") return;

  try {
    isMuted = !isMuted;
    activeCall.mute(isMuted);
    muteBtn.classList.toggle("active", isMuted);
  } catch (e) {
    console.error("Mute failed:", e);
  }
});

// ======================================================
// HOLD (soft hold)
// ======================================================
holdBtn.addEventListener("click", () => {
  if (!activeCall) {
    console.warn("Hold blocked: no active call");
    return;
  }

  try {
    isOnHold = !isOnHold;

    console.log("Soft hold:", isOnHold);

    // upstream mute
    activeCall.mute(isOnHold);

    // downstream mute
    if (remoteAudioEl) {
      remoteAudioEl.muted = isOnHold;
    }

    holdBtn.classList.toggle("active", isOnHold);

    setState(
      "incall",
      isOnHold ? "On Hold" : "In call"
    );

  } catch (e) {
    console.error("Hold failed:", e);
    isOnHold = !isOnHold; // rollback
  }
});

// ======================================================
// SETTINGS MODAL
// ======================================================

// open settings
settingsBtn.addEventListener("click", () => {
  tokenUrlInput.value = TOKEN_URL || "";
  identityInput.value = AGENT_IDENTITY || "";
  settingsModal.style.display = "flex";
});

// close settings
closeSettingsBtn.addEventListener("click", () => {
  settingsModal.style.display = "none";
});

// save settings
saveSettingsBtn.addEventListener("click", async () => {
  const newUrl = tokenUrlInput.value.trim();
  const newIdentity = identityInput.value.trim();

// allow clearing configuration
if (!newUrl) {
  localStorage.removeItem("twilio_token_url");
  localStorage.removeItem("twilio_identity");

  TOKEN_URL = "";
  AGENT_IDENTITY = "";

  settingsModal.style.display = "none";

  if (device) {
    try { device.destroy(); } catch (e) {}
    device = null;
  }

  setState("error", "Configure Twilio in Settings");
  return;
}

  localStorage.setItem("twilio_token_url", newUrl);
  localStorage.setItem("twilio_identity", newIdentity || "agent_1001");

  TOKEN_URL = newUrl;
  AGENT_IDENTITY = newIdentity || "agent_1001";

  settingsModal.style.display = "none";

  // Reinitialize device safely
  if (device) {
    try {
      device.destroy();
    } catch (e) {}
    device = null;
  }

  setState("boot", "Reinitializing…");
  initTwilio();
});

// ==============================
// CLICK-TO-CALL HANDLER
// ==============================
if (window.indigoAPI) {
  window.indigoAPI.onDialNumber((number) => {
    if (!number) return;

    phoneInput.value = number;

    // auto-dial if ready
    if (currentState === "ready" && device) {
      placeCall(number);
    } else {
      setState("ready", "Number loaded — press Call");
    }
  });
}

// ======================================================
// BOOT
// ======================================================
window.addEventListener("load", () => {
  if (!window.Twilio) {
    console.error("Twilio SDK failed to load");
    setState("error", "SDK failed to load");
    return;
  }

  if (!TOKEN_URL) {
    setState("error", "Configure Twilio in Settings");
    return;
  }

  initTwilio();
});