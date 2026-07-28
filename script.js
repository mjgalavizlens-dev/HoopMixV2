// ==========================================
// 1. CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCpekh119AjcA3osl804i0S7p0sM-J7bxc",
    authDomain: "hoop-mix.firebaseapp.com",
    projectId: "hoop-mix",
    storageBucket: "hoop-mix.firebasestorage.app",
    messagingSenderId: "188196851591",
    appId: "1:188196851591:web:b21f294e06b81746420d22",
    measurementId: "G-ZW25Z14CYC"
};

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = typeof firebase !== 'undefined' ? firebase.auth() : null;
const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;
let currentUser = null;

// ==========================================
// 2. GESTIÓN DE SESIÓN DE USUARIO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (loginBtn) loginBtn.addEventListener('click', loginWithGoogle);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    if (auth) {
        auth.onAuthStateChanged((user) => {
            currentUser = user;
            updateUIAuthState(user);
            if (user) {
                loadUserHistory();
            }
        });
    }
});

function loginWithGoogle() {
    if (!auth) return;
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((error) => {
        console.error("Error al iniciar sesión:", error.message);
    });
}

function logout() {
    if (!auth) return;
    auth.signOut().then(() => {
        currentUser = null;
        updateUIAuthState(null);
    });
}

function updateUIAuthState(user) {
    const loginBtn = document.getElementById('login-btn');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');
    const btnShowHistory = document.getElementById('btn-show-history');

    if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (userInfo) userInfo.style.display = 'flex';
        if (userName) userName.innerText = user.displayName || user.email;
        if (btnShowHistory) btnShowHistory.style.display = 'inline-block'; // Muestra el botón estético
    } else {
        if (loginBtn) loginBtn.style.display = 'block';
        if (userInfo) userInfo.style.display = 'none';
        if (btnShowHistory) btnShowHistory.style.display = 'none';
    }
}

// ==========================================
// 3. HISTORIAL Y RECOMENDACIONES DE MEJORA
// ==========================================
async function saveAnalysisToHistory(mode, value) {
    if (!currentUser || !db) return;

    try {
        const historyRef = db.collection('history');
        const lastQuery = await historyRef
            .where('userId', '==', currentUser.uid)
            .where('mode', '==', mode)
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

        let improvementPercent = null;
        let improvementMsg = "🌟 ¡Tu primer registro base ha sido guardado!";

        if (!lastQuery.empty) {
            const lastRecord = lastQuery.docs[0].data();
            const previousValue = parseFloat(lastRecord.value);
            const currentValue = parseFloat(value);

            if (previousValue > 0) {
                const diff = currentValue - previousValue;
                improvementPercent = ((diff / previousValue) * 100).toFixed(1);

                if (improvementPercent > 0) {
                    improvementMsg = `🚀 **+${improvementPercent}% de mejora** respecto a tu último salto (${previousValue} cm). ¡Sigue así!`;
                } else if (improvementPercent < 0) {
                    improvementMsg = `📉 **${improvementPercent}%** respecto a tu registro anterior (${previousValue} cm). No te desanimes, es normal fluctuar.`;
                } else {
                    improvementMsg = `🎯 Mismo resultado que antes (${previousValue} cm). Has encontrado consistencia.`;
                }
            }
        }

        // GENERADOR DE RECOMENDACIONES REALISTAS DE SALTO
        const jumpTips = [
            "💡 <strong>Física aplicada:</strong> Acelera tu penúltimo paso. Cuanto más rápido entres al salto, más fuerza horizontal convertirás en elevación vertical.",
            "💡 <strong>Biomecánica:</strong> Asegura la 'Triple Extensión'. Tienes que extender por completo el tobillo, la rodilla y la cadera en el momento de despegar.",
            "💡 <strong>Aprovecha el cuerpo:</strong> Usa un braceo mucho más violento hacia arriba. Los brazos pueden sumarte hasta un 15% extra de altura si los coordinas bien.",
            "💡 <strong>El centro de gravedad:</strong> Baja más la cadera justo antes de saltar. Si no te agachas lo suficiente, tus músculos no tendrán espacio para generar potencia.",
            "💡 <strong>Fuerza reactiva:</strong> Intenta que el tiempo de contacto de tus pies con el suelo sea el mínimo posible. Absorbe y explota."
        ];
        
        // Elige un consejo al azar si es modo salto
        const tipText = mode === 'jump' 
            ? jumpTips[Math.floor(Math.random() * jumpTips.length)] 
            : "💡 <strong>Consejo:</strong> Mantén el codo alineado con el hombro para que la fuerza vaya recta hacia el aro.";

        await historyRef.add({
            userId: currentUser.uid,
            mode: mode,
            value: value,
            improvementPercent: improvementPercent,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            dateString: new Date().toLocaleDateString('es-ES')
        });

        // Mostrar en la tarjeta del entrenador
        const coachCard = document.getElementById('coach-card');
        const coachAdvice = document.getElementById('coach-advice');
        const coachTitle = document.getElementById('coach-title');

        if (coachCard && coachAdvice) {
            coachCard.style.display = 'block';
            coachTitle.innerText = mode === 'jump' ? 'Análisis Biomecánico del Salto' : 'Análisis Mecánica de Tiro';
            coachAdvice.innerHTML = `
                <span style="font-size: 18px; color: white;">Has alcanzado: <strong style="color: #00F0FF;">${value} ${mode==='jump'?'cm':'°'}</strong></span>
                <br><br>
                <span style="color: #ccc;">${improvementMsg}</span>
                <br><br>
                <div style="background: rgba(0, 240, 255, 0.1); padding: 10px; border-left: 4px solid #00F0FF; border-radius: 4px;">
                    ${tipText}
                </div>
            `;
        }

        loadUserHistory();

    } catch (error) {
        console.error("Error guardando:", error);
    }
}

async function loadUserHistory() {
    if (!currentUser || !db) return;

    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    try {
        const snapshot = await db.collection('history')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        historyList.innerHTML = '';

        if (snapshot.empty) {
            historyList.innerHTML = '<li style="color: #888;">No hay saltos guardados aún. Analiza un vídeo primero.</li>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const li = document.createElement('li');
            li.style.padding = '12px 10px';
            li.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';

            let trendTag = '';
            if (data.improvementPercent !== null && data.improvementPercent !== undefined) {
                if (data.improvementPercent > 0) trendTag = `<span style="color: #00FF88; font-weight:bold;">(+${data.improvementPercent}%)</span>`;
                else if (data.improvementPercent < 0) trendTag = `<span style="color: #FF4A00; font-weight:bold;">(${data.improvementPercent}%)</span>`;
            }

            const unit = data.mode === 'jump' ? 'cm' : '°';
            const icon = data.mode === 'jump' ? '🚀' : '🏀';

            li.innerHTML = `
                <span>${icon} <strong style="font-size:18px; color:#00F0FF;">${data.value} ${unit}</strong> ${trendTag}</span>
                <span style="color: #888; font-size: 13px;">${data.dateString || ''}</span>
            `;
            historyList.appendChild(li);
        });

    } catch (error) {
        console.error("Error cargando el historial:", error);
    }
}

// ==========================================
// 4. PROCESAMIENTO BIOMECÁNICO (MEDIAPIPE)
// ==========================================
let minElbowAngle = 180;
let maxElbowAngle = 0;
let maxJumpHeightCm = 0;
let baseHipY = null;

const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement ? canvasElement.getContext('2d') : null;

function calculateAngle(A, B, C) {
    const radians = Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

const pose = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });

pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

pose.onResults((results) => {
    if (!canvasElement || !canvasCtx) return;

    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 480;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00F0FF', lineWidth: 3 });
        drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#FF4A00', lineWidth: 2, radius: 4 });

        const shoulder = results.poseLandmarks[12];
        const elbow = results.poseLandmarks[14];
        const wrist = results.poseLandmarks[16];
        const hip = results.poseLandmarks[24];
        const ankle = results.poseLandmarks[28];

        if (shoulder && elbow && wrist) {
            const currentAngle = calculateAngle(shoulder, elbow, wrist);
            if (currentAngle < minElbowAngle) minElbowAngle = currentAngle;
            if (currentAngle > maxElbowAngle) maxElbowAngle = currentAngle;

            const minAngleElem = document.getElementById('min-angle-val');
            const maxAngleElem = document.getElementById('max-angle-val');
            if (minAngleElem) minAngleElem.innerText = `${Math.round(minElbowAngle)}°`;
            if (maxAngleElem) maxAngleElem.innerText = `${Math.round(maxElbowAngle)}°`;
        }

        if (hip && ankle) {
            if (baseHipY === null || hip.y > baseHipY) baseHipY = hip.y;

            const personHeightPx = Math.abs(ankle.y - shoulder.y);
            const deltaY = baseHipY - hip.y;

            if (personHeightPx > 0 && deltaY > 0) {
                const estimatedJumpCm = (deltaY / personHeightPx) * 175; // Estimación basada en proporción humana realista
                if (estimatedJumpCm > maxJumpHeightCm) {
                    maxJumpHeightCm = estimatedJumpCm;
                }
            }

            const jumpValElem = document.getElementById('jump-val');
            if (jumpValElem) jumpValElem.innerText = Math.round(maxJumpHeightCm);
        }
    }
    canvasCtx.restore();
});

// ==========================================
// 5. MANEJO DE SUBIDA DE VÍDEO Y PROGRESO
// ==========================================
const videoInput = document.getElementById('video-upload');

if (videoInput) {
    videoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        minElbowAngle = 180;
        maxElbowAngle = 0;
        maxJumpHeightCm = 0;
        baseHipY = null;

        const progressContainer = document.getElementById('progress-container');
        const progressBar = document.getElementById('progress-bar');
        const progressPercent = document.getElementById('progress-percent');
        const statusText = document.getElementById('status-text');

        if (progressContainer) progressContainer.style.display = 'block';
        if (statusText) statusText.innerText = 'Analizando vídeo fotograma a fotograma...';

        const url = URL.createObjectURL(file);
        videoElement.src = url;
        videoElement.load();

        videoElement.onloadedmetadata = () => {
            videoElement.currentTime = 0;
            processVideoFrames(progressBar, progressPercent, statusText);
        };
    });
}

async function processVideoFrames(progressBar, progressPercent, statusText) {
    const duration = videoElement.duration;
    let currentTime = 0;
    const step = 0.08; 

    while (currentTime < duration) {
        videoElement.currentTime = currentTime;
        await new Promise(resolve => videoElement.onseeked = resolve);
        await pose.send({ image: videoElement });

        currentTime += step;
        const percent = Math.min(Math.round((currentTime / duration) * 100), 100);

        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressPercent) progressPercent.innerText = `${percent}%`;
    }

    if (statusText) statusText.innerText = 'Análisis completado.';

    const finalValue = currentMode === 'jump' ? Math.round(maxJumpHeightCm) : Math.round(maxElbowAngle);
    saveAnalysisToHistory(currentMode, finalValue);
}
