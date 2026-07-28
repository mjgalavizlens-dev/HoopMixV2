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
            loadUserHistory();
        });
    }
});

function loginWithGoogle() {
    if (!auth) return;
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((error) => {
        console.error("Error al iniciar sesión:", error);
        alert("Error al iniciar sesión: " + error.message);
    });
}

function logout() {
    if (!auth) return;
    auth.signOut().then(() => {
        currentUser = null;
        updateUIAuthState(null);
        loadUserHistory();
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
        if (btnShowHistory) btnShowHistory.style.display = 'inline-block';
    } else {
        if (loginBtn) loginBtn.style.display = 'block';
        if (userInfo) userInfo.style.display = 'none';
        if (btnShowHistory) btnShowHistory.style.display = 'none';
    }
}

// ==========================================
// 3. MOSTRAR CONSEJOS Y GUARDAR EN HISTORIAL
// ==========================================
async function processAnalysisResults(mode, value) {
    let improvementMsg = "";
    let improvementPercent = null;

    if (currentUser && db) {
        try {
            const snapshot = await db.collection('history')
                .where('userId', '==', currentUser.uid)
                .get();

            if (!snapshot.empty) {
                let records = snapshot.docs.map(d => d.data());
                const modeRecords = records.filter(r => r.mode === mode);
                modeRecords.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

                if (modeRecords.length > 0) {
                    const previousValue = parseFloat(modeRecords[0].value);
                    const currentValue = parseFloat(value);

                    if (previousValue > 0) {
                        const diff = currentValue - previousValue;
                        improvementPercent = parseFloat(((diff / previousValue) * 100).toFixed(1));

                        if (improvementPercent > 0) {
                            improvementMsg = `🚀 <strong>+${improvementPercent}% de mejora</strong> respecto a tu último registro (${previousValue} ${mode === 'jump' ? 'cm' : '°'}). ¡Sigue así!`;
                        } else if (improvementPercent < 0) {
                            improvementMsg = `📉 <strong>${improvementPercent}%</strong> respecto a tu registro anterior (${previousValue} ${mode === 'jump' ? 'cm' : '°'}). No pasa nada, es normal fluctuar.`;
                        } else {
                            improvementMsg = `🎯 Mismo resultado que tu registro anterior (${previousValue} ${mode === 'jump' ? 'cm' : '°'}). Has encontrado consistencia.`;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("No se pudo consultar el registro anterior:", e);
        }
    }

    if (!improvementMsg) {
        improvementMsg = currentUser 
            ? "🌟 ¡Primer registro guardado en la nube para esta categoría!" 
            : "ℹ️ Inicia sesión para guardar tus marcas y calcular tu progreso real.";
    }

    // CONSEJOS MEJORADOS: MÁS NATURALES, REALISTAS Y FÁCILES DE ENTENDER
    const jumpTips = [
        "💡 <strong>Dale ritmo al penúltimo paso:</strong> Entra a saltar con velocidad. Ese impulso final hacia adelante es física pura: se transforma en altura. Tienes margen para volar un poco más.",
        "💡 <strong>Estírate por completo:</strong> Al despegar, asegúrate de estirar bien el tobillo, la rodilla y la cadera, como si quisieras tocar el techo con la cabeza. Es un detalle postural que suma centímetros de verdad.",
        "💡 <strong>Usa los brazos con fuerza:</strong> Lanza los brazos hacia arriba de forma agresiva justo al saltar. Te van a dar un empujón extra bastante notable si lo coordinas bien.",
        "💡 <strong>Baja un poco más:</strong> Flexiona un pelín más las rodillas antes de saltar para cargar las piernas como si fueran un muelle. Si no bajas lo suficiente, te quitas potencia tú mismo.",
        "💡 <strong>Pisa y explota:</strong> Intenta no quedarte 'pegado' al suelo. Cuanto menos tiempo toquen tus pies el piso antes del despegue, más fuerza elástica sacarás. ¡Puedes lograrlo!"
    ];

    const shotTips = [
        "💡 <strong>Codo debajo del balón:</strong> Fíjate en mantener el codo alineado bajo la pelota. Si el codo está recto, la fuerza va directa al aro y fallarás menos a los lados.",
        "💡 <strong>Acompaña el tiro hasta el final:</strong> Estira bien el brazo al soltar el balón y deja la muñeca caída (el famoso 'cuello de cisne'). Eso le da el arco necesario para que entre limpio."
    ];

    const randomTip = mode === 'jump' 
        ? jumpTips[Math.floor(Math.random() * jumpTips.length)]
        : shotTips[Math.floor(Math.random() * shotTips.length)];

    const coachCard = document.getElementById('coach-card');
    const coachAdvice = document.getElementById('coach-advice');
    const coachTitle = document.getElementById('coach-title');

    if (coachCard && coachAdvice) {
        coachCard.style.display = 'block';
        coachTitle.innerText = mode === 'jump' ? 'Análisis Biomecánico del Salto' : 'Análisis Mecánica de Tiro';
        coachAdvice.innerHTML = `
            <div style="font-size: 20px; color: white; margin-bottom: 10px;">
                Resultado: <strong style="color: #00F0FF;">${value} ${mode === 'jump' ? 'cm' : '°'}</strong>
            </div>
            <div style="color: #ddd; margin-bottom: 15px;">${improvementMsg}</div>
            <div style="background: rgba(0, 240, 255, 0.1); padding: 12px; border-left: 4px solid #00F0FF; border-radius: 4px; color: #fff; font-size: 15px;">
                ${randomTip}
            </div>
        `;
    }

    if (currentUser && db) {
        try {
            await db.collection('history').add({
                userId: currentUser.uid,
                mode: mode,
                value: value,
                improvementPercent: improvementPercent,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                dateString: new Date().toLocaleDateString('es-ES')
            });
            loadUserHistory();
        } catch (err) {
            console.error("Error guardando registro en Firestore:", err);
        }
    }
}

async function loadUserHistory() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    if (!currentUser || !db) {
        historyList.innerHTML = '<li style="color: #aaa; padding: 10px 0;">Inicia sesión con Google para ver tu historial.</li>';
        return;
    }

    try {
        const snapshot = await db.collection('history')
            .where('userId', '==', currentUser.uid)
            .get();

        if (snapshot.empty) {
            historyList.innerHTML = '<li style="color: #888; padding: 10px 0;">No hay análisis guardados. Sube un vídeo para empezar.</li>';
            return;
        }

        let records = snapshot.docs.map(d => d.data());
        records.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        historyList.innerHTML = '';
        records.slice(0, 10).forEach(data => {
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
        console.error("Error al cargar historial:", error);
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
                const estimatedJumpCm = (deltaY / personHeightPx) * 175;
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
// 5. SUBIDA DE VÍDEO Y PROCESAMIENTO
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
    
    processAnalysisResults(currentMode, finalValue);
}
