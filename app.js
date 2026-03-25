const API_BASE_URL =
  "https://asambleaasistencia-avblh158v-alvarocotesjc-9801s-projects.vercel.app";

const searchSection = document.getElementById("searchSection");
const searchInput = document.getElementById("searchInput");
const resultsList = document.getElementById("resultsList");
const selectedCard = document.getElementById("selectedCard");
const selectedInitials = document.getElementById("selectedInitials");
const selectedName = document.getElementById("selectedName");
const selectedDoc = document.getElementById("selectedDoc");
const changeDelegadoBtn = document.getElementById("changeDelegadoBtn");
const canvas = document.getElementById("signatureCanvas");
const clearBtn = document.getElementById("clearBtn");
const signatureForm = document.getElementById("signatureForm");
const exportActaBtn = document.getElementById("exportActaBtn");
const totalDelegados = document.getElementById("totalDelegados");
const totalFirmados = document.getElementById("totalFirmados");
const totalFaltan = document.getElementById("totalFaltan");

const ctx = canvas.getContext("2d");
let drawing = false;
let lastX = 0;
let lastY = 0;
let selectedDelegado = null;
let debounceTimer = null;
let lastQuery = "";

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.scale(dpr, dpr);
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#111827";
}

function getPos(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function startDraw(event) {
  drawing = true;
  const pos = getPos(event);
  lastX = pos.x;
  lastY = pos.y;
}

function draw(event) {
  if (!drawing) return;
  const pos = getPos(event);
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  lastX = pos.x;
  lastY = pos.y;
}

function stopDraw() {
  drawing = false;
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function isCanvasBlank() {
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] !== 0) return false;
  }
  return true;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateForFileName(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}${m}${d}-${hh}${mm}`;
}

async function cargarResumenAsistencia() {
  const response = await fetch(`${API_BASE_URL}/delegados/resumen`);
  if (!response.ok) {
    throw new Error("No fue posible cargar el resumen de asistencia.");
  }
  const data = await response.json();
  totalDelegados.textContent = String(data.total ?? 0);
  totalFirmados.textContent = String(data.firmados ?? 0);
  totalFaltan.textContent = String(data.faltan ?? 0);
}

function renderResults(items) {
  resultsList.innerHTML = "";
  resultsList.hidden = false;

  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "No se encontraron delegados.";
    li.style.cursor = "default";
    resultsList.appendChild(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${escapeHtml(
      item.nombreCompleto,
    )}</strong> - ${escapeHtml(item.numeroDocumento)}`;
    li.addEventListener("click", () => {
      applySelectedDelegado(item);
      for (const node of resultsList.querySelectorAll("li"))
        node.classList.remove("active");
      li.classList.add("active");
      resultsList.hidden = true;
    });
    resultsList.appendChild(li);
  }
}

function hideResults() {
  resultsList.hidden = true;
}

function buildInitials(fullName) {
  const parts = String(fullName)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((x) => x[0]?.toUpperCase() || "").join("") || "--";
}

function clearSelectedDelegado() {
  selectedDelegado = null;
  selectedName.textContent = "Ninguno";
  selectedDoc.textContent = "Documento: --";
  selectedInitials.textContent = "--";
  selectedCard.hidden = true;
  searchSection.hidden = false;
}

function applySelectedDelegado(item) {
  selectedDelegado = item;
  selectedName.textContent = item.nombreCompleto;
  selectedDoc.textContent = `Documento: ${item.numeroDocumento}`;
  selectedInitials.textContent = buildInitials(item.nombreCompleto);
  selectedCard.hidden = false;
  searchSection.hidden = true;
  hideResults();
  lastQuery = item.numeroDocumento ?? item.nombreCompleto ?? "";
}

function looksLikeDocument(query) {
  return /^\d+$/.test(query.trim());
}

async function searchDelegados() {
  const query = searchInput.value.trim();
  if (!query) {
    hideResults();
    resultsList.innerHTML = "";
    clearSelectedDelegado();
    return;
  }

  const params = new URLSearchParams();
  if (looksLikeDocument(query)) {
    params.set("numeroDocumento", query);
  } else {
    params.set("nombreCompleto", query);
  }

  const response = await fetch(
    `${API_BASE_URL}/delegados?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error("No fue posible buscar delegados.");
  }

  const data = await response.json();
  renderResults(Array.isArray(data) ? data : []);
}

canvas.addEventListener("pointerdown", startDraw);
canvas.addEventListener("pointermove", draw);
canvas.addEventListener("pointerup", stopDraw);
canvas.addEventListener("pointerleave", stopDraw);
clearBtn.addEventListener("click", clearCanvas);
exportActaBtn.addEventListener("click", async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/delegados/acta/pdf`);
    if (!response.ok) {
      throw new Error("No fue posible exportar el acta.");
    }

    const pdfBytes = await response.arrayBuffer();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `acta-asistencia-${formatDateForFileName(new Date())}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert(error.message || "Error exportando acta.");
  }
});
changeDelegadoBtn.addEventListener("click", () => {
  clearSelectedDelegado();
  searchInput.value = "";
  resultsList.innerHTML = "";
  searchInput.focus();
});
searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim();

  if (selectedDelegado && query !== lastQuery) {
    clearSelectedDelegado();
  }

  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(async () => {
    try {
      await searchDelegados();
      lastQuery = searchInput.value.trim();
    } catch (error) {
      hideResults();
      alert(error.message || "Error consultando el backend.");
    }
  }, 250);
});

searchInput.addEventListener("focus", () => {
  if (resultsList.children.length > 0) {
    resultsList.hidden = false;
  }
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (target === searchInput || resultsList.contains(target)) return;
  hideResults();
});

signatureForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedDelegado) {
    alert("Primero selecciona un delegado de la busqueda.");
    return;
  }

  if (isCanvasBlank()) {
    alert("Por favor dibuja una firma.");
    return;
  }

  const imageData = canvas.toDataURL("image/png");

  try {
    const response = await fetch(
      `${API_BASE_URL}/delegados/${selectedDelegado.id}/firma`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmaBase64: imageData }),
      },
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "No fue posible guardar la firma.");
    }

    await response.json();
    clearCanvas();
    await cargarResumenAsistencia();
    alert("Firma guardada correctamente en backend.");
  } catch (error) {
    alert(error.message || "Error guardando firma.");
  }
});

resizeCanvas();
window.addEventListener("resize", () => {
  resizeCanvas();
  clearCanvas();
});

cargarResumenAsistencia().catch((error) => {
  alert(error.message || "Error consultando resumen.");
});
