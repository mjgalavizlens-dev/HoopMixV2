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

// Inicializar Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = typeof firebase !== 'undefined' ? firebase.auth() : null;
const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;
let currentUser = null;

// ==========================================
// 2. VARIABLES DOM
// ==========================================
const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const fileInput = document.getElementById('video-upload');
const statusText = document.getElementById('status-text');

const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const progressPercent = document.getElementById('progress-percent');

const minAngleVal = document.getElementById('min-angle-val');
const maxAngleVal = document.getElementById('max-angle-val');
const jumpVal = document.getElementById('jump-val');

const coachCard = document.getElementById('coach-card');
const coachAdvice = document.getElementById('coach-advice');

// Elementos del DOM para Login e Historial
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const userName = document.getElementById('user-name');
const historyList = document.getElementById('history-list');
const historySection = document.getElementById('history-section');

// ==========================================
// 3. MÉTRICAS ACUMULADAS
// ==========================================
let minElbowAngle = 180;
let maxElbowAngle = 0;
let minYHip = 10000;
let maxYHip = 0;
let referenceTorsoPx = 0; // Referencia para calibrar píxeles a CM
let finalJumpCm = 0;

// ==========================================
// 4. AUTENTICACIÓN CON GOOGLE Y FIRESTORE
// ==========================================
if (auth) {
    // Escuchar estado de sesión del usuario
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        if (user) {
            if (userName) userName.innerText = user.displayName || user.email;
            if (loginBtn) loginBtn.style.display = 'none';
            if (userInfo) userInfo.style.display = 'flex';
            if (historySection) historySection.style.display = 'block';
            loadJumpHistory(user.uid);
        } else {
            if (loginBtn) loginBtn.style.display = 'block';
            if (userInfo) userInfo.style.display = 'none';
            if (historySection) historySection.style.display = 'none';
        }
    });
}

// Iniciar Sesión con Google
function loginWithGoogle() {
    if (!auth) return;
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((error) => {
        console.error("Error al iniciar sesión con Google:", error);
    });
}

// Cerrar Sesión
function logout() {
    if (!auth) return;
    auth.signOut().then(() => {
        if (historyList) historyList.innerHTML = '';
    });
}

// Event Listeners para Auth
if (loginBtn) loginBtn.addEventListener('click', loginWithGoogle);
if (logoutBtn) logoutBtn.addEventListener('click', logout);

// Guardar resultado del análisis en la base de datos
async function saveJumpResultToFirebase() {
    if (!currentUser || !db) return;

    const mode = typeof currentMode !== 'undefined' ? currentMode : 'jump';
    const record = {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Usuario',
        jumpCm: finalJumpCm,
        minAngle: minElbowAngle,
        maxAngle: maxElbowAngle,
        mode: mode,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('history').add(record);
        console.log("Resultado guardado en Firestore con éxito.");
        loadJumpHistory(currentUser.uid); // Recargar lista
    } catch (error) {
        console.error("Error guardando datos en Firestore:", error);
    }
}

// Cargar Historial de Saltos
async function loadJumpHistory(userId) {
    if (!db || !historyList) return;

    try {
        const snapshot = await db.collection('history')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();

        historyList.innerHTML = '';

        if (snapshot.empty) {
            historyList.innerHTML = '<li style="color:#aaa;">No tienes registros guardados aún.</li>';
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const date = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleDateString() : 'Reciente';
            const li = document.createElement('li');
            li.style.margin = "8px 0";
            li.style.padding = "8px";
            li.style.background = "#1a1a2e";
            li.style.borderRadius = "6px";
            li.style.borderLeft = "4px solid #00F0FF";
            
            if (data.mode === 'shot') {
                li.innerHTML = `<strong>${date}:</strong> Tiro | Ángulos: ${data.minAngle}° / ${data.maxAngle}° | Salto: ${data.jumpCm} cm`;
            } else {
                li.innerHTML = `<strong>${date}:</strong> Salto Vertical: <span style="color:#00F0FF; font-weight:bold;">${data.jumpCm} cm</span>`;
            }
            historyList.appendChild(li);
        });
    } catch (error) {
        console.error("Error al cargar historial:", error);
    }
}

// ==========================================
// 5. MEDIDA ÁNGULO BIOMECÁNICO & MEDIAPIPE POSE
// ==========================================
function calculateAngle(A, B, C) {
    let radians = Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

pose.onResults(onResults);

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Dibujar el fotograma del vídeo en el canvas
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        // Dibujar Esqueleto Biomecánico
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00F0FF', lineWidth: 3 });
        drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#FF4A00', lineWidth: 2, radius: 4 });

        const landmarks = results.poseLandmarks;
        const shoulder = landmarks[12]; // Hombro derecho
        const elbow = landmarks[14];
        const wrist = landmarks[16];
        const hip = landmarks[24]; // Cadera derecha

        // 1. Cálculos de Tiro (Ángulos)
        if (shoulder && elbow && wrist) {
            const currentAngle = calculateAngle(shoulder, elbow, wrist);
            if (currentAngle < minElbowAngle) minElbowAngle = Math.round(currentAngle);
            if (currentAngle > maxElbowAngle) maxElbowAngle = Math.round(currentAngle);
            
            minAngleVal.innerText = `${minElbowAngle}°`;
            maxAngleVal.innerText = `${maxElbowAngle}°`;
        }

        // 2. Calibración Antropométrica (Píxeles a Centímetros)
        if (shoulder && hip) {
            const currentTorsoPx = Math.abs(hip.y - shoulder.y) * canvasElement.height;
            if (currentTorsoPx > referenceTorsoPx) referenceTorsoPx = currentTorsoPx;

            const yPos = hip.y * canvasElement.height;
            if (yPos < minYHip) minYHip = yPos;
            if (yPos > maxYHip) maxYHip = yPos;
            
            const verticalDeltaPx = maxYHip - minYHip;

            if (referenceTorsoPx > 0) {
                const cmPerPx = 50 / referenceTorsoPx;
                finalJumpCm = Math.round(verticalDeltaPx * cmPerPx);
                
                if (finalJumpCm < 8 && typeof currentMode !== 'undefined' && currentMode === 'shot') {
                    jumpVal.innerText = "0"; // Tiro a pie firme
                } else {
                    jumpVal.innerText = finalJumpCm;
                }
            }
        }
    }
    canvasCtx.restore();
}

// ==========================================
// 6. CARGA DEL VÍDEO Y RESETEO DE UI
// ==========================================
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        statusText.innerText = "Cargando archivo...";
        progressContainer.style.display = "block";
        progressBar.style.width = "0%";
        progressPercent.innerText = "0%";
        coachCard.style.display = "none";

        // Reseteo de Métricas
        minElbowAngle = 180;
        maxElbowAngle = 0;
        minYHip = 10000;
        maxYHip = 0;
        referenceTorsoPx = 0;
        finalJumpCm = 0;
        
        minAngleVal.innerText = `--°`;
        maxAngleVal.innerText = `--°`;
        jumpVal.innerText = `--`;

        const url = URL.createObjectURL(file);
        videoElement.src = url;

        videoElement.onloadedmetadata = () => {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            statusText.innerText = "Analizando fotogramas...";
            processVideo();
        };
    });
}

// PROCESAMIENTO ASÍNCRONO DE VÍDEO
async function processVideo() {
    const duration = videoElement.duration;
    let currentTime = 0.001; 
    const frameStep = 0.05; 

    videoElement.onseeked = async () => {
        try {
            await pose.send({ image: videoElement });
            
            const progress = Math.min(100, Math.round((currentTime / duration) * 100));
            progressBar.style.width = `${progress}%`;
            progressPercent.innerText = `${progress}%`;

            if (currentTime + frameStep <= duration) {
                currentTime += frameStep;
                videoElement.currentTime = currentTime; 
            } else if (currentTime < duration) {
                currentTime = duration;
                videoElement.currentTime = currentTime;
            } else {
                progressBar.style.width = "100%";
                progressPercent.innerText = "100%";
                statusText.innerText = "Análisis completado";
                generateCoachAdvice();
            }
        } catch (error) {
            console.error("Error analizando el fotograma:", error);
            statusText.innerText = "Error en el análisis. Intenta de nuevo.";
        }
    };

    videoElement.currentTime = currentTime;
}

// ==========================================
// 7. GENERADOR DE CONSEJOS Y GUARDADO AUTOMÁTICO
// ==========================================
function generateCoachAdvice() {
    coachCard.style.display = "block";
    
    const mode = typeof currentMode !== 'undefined' ? currentMode : 'shot';
    
    if (mode === 'shot') {
        let feedback = "";
        
        if (minElbowAngle < 75) {
            feedback = "<strong>Punto de Carga Muy Cerrado:</strong> Estás colapsando demasiado el codo en la preparación. Esto genera tensión innecesaria y frena la fluidez de liberación. Abre ligeramente la preparación para mantener una catapulta limpia.";
        } else if (minElbowAngle > 105) {
            feedback = "<strong>Tiro Empujado:</strong> Tu punto de carga supera los 100°. Estás empujando el balón desde el pecho hacia adelante en vez de acompañar la trayectoria vertical. Eleva el balón justo por encima de tu ceja dominante antes de soltar.";
        } else {
            feedback = "<strong>Mecánica de Carga Excelente:</strong> Tu ángulo de preparación está en la zona dulce de tiro rápido. Mantienes una palanca equilibrada entre fuerza y velocidad.";
        }

        if (maxElbowAngle < 155) {
            feedback += "<br><br>Además, <strong>no estás terminando la extensión:</strong> Cortas el seguimiento con la muñeca antes de tiempo. Mantén el brazo extendido y la 'mano en el aro' hasta que el balón toque la red.";
        } else {
            feedback += "<br><br><strong>Excelente seguimiento (Follow-through):</strong> Tu brazo se extiende completamente asegurando una parábola suave.";
        }
        
        if (finalJumpCm < 8) {
            feedback += "<br><br><strong>Biomecánica Base:</strong> El análisis detecta un tiro a pie firme (tiro libre). Tu potencia depende 100% de la cadena cinética de tus piernas hasta tus brazos.";
        } else {
            feedback += `<br><br><strong>Tiro en Suspensión:</strong> Has ejecutado el tiro con un salto de aprox. ${finalJumpCm} cm. Asegúrate de soltar el balón en el punto más alto para evitar tapones.`;
        }

        coachAdvice.innerHTML = feedback;

    } else {
        let feedback = "";

        if (finalJumpCm < 20) {
            feedback = "<strong>Pérdida de Transmisión de Fuerza:</strong> La carga es demasiado rígida. Flexiona caderas y rodillas de manera más dinámica antes del despegue para convertir la energía elástica del suelo en elevación pura.";
        } else if (finalJumpCm < 45) {
            feedback = "<strong>Buen Muelle Base:</strong> Tu salto es sólido, pero para ganar centímetros extra enfócate en acelerar la velocidad del último paso (plant-step) y coordinar un balanceo de brazos agresivo hacia arriba justo antes del despegue.";
        } else {
            feedback = `<strong>Potencia Explosiva Brutal (${finalJumpCm} cm):</strong> Gran transferencia de triple extensión (tobillo, rodilla y cadera). Tienes un salto por encima de la media. Mantén tu fluidez de entrada para no perder velocidad horizontal.`;
        }

        coachAdvice.innerHTML = feedback;
    }

    // GUARDAR EN FIREBASE AUTOMÁTICAMENTE SI HAY UN USUARIO LOGUEADO
    if (currentUser) {
        saveJumpResultToFirebase();
    }
}
