// VARIABLES DOM
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

// METRICAS ACUMULADAS
let minElbowAngle = 180;
let maxElbowAngle = 0;
let minYHip = 10000;
let maxYHip = 0;
let referenceTorsoPx = 0; // Referencia para calibrar píxeles a CM
let finalJumpCm = 0;

// MEDIDA ÁNGULO BIOMECÁNICO
function calculateAngle(A, B, C) {
    let radians = Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

// CONFIGURACIÓN DE MEDIAPIPE POSE
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
            // El tamaño del torso en píxeles. Tomamos el más grande para asegurar que el jugador está erguido y visible.
            const currentTorsoPx = Math.abs(hip.y - shoulder.y) * canvasElement.height;
            if (currentTorsoPx > referenceTorsoPx) referenceTorsoPx = currentTorsoPx;

            // Rastreamos el punto más alto (minYHip) y el punto más bajo (maxYHip)
            const yPos = hip.y * canvasElement.height;
            if (yPos < minYHip) minYHip = yPos;
            if (yPos > maxYHip) maxYHip = yPos;
            
            const verticalDeltaPx = maxYHip - minYHip;

            // Asumimos un torso adulto promedio de ~50 cm para crear la escala
            if (referenceTorsoPx > 0) {
                const cmPerPx = 50 / referenceTorsoPx;
                finalJumpCm = Math.round(verticalDeltaPx * cmPerPx);
                
                // Si el salto es minúsculo, asumimos que no ha saltado
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

// CARGA DEL VÍDEO Y RESETEO DE UI
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

// PROCESAMIENTO ASÍNCRONO DE VÍDEO (SOLUCIÓN PANTALLA NEGRA)
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

// GENERADOR DE CONSEJOS DE ENTRENADOR DE ÉLITE
function generateCoachAdvice() {
    coachCard.style.display = "block";
    
    const mode = typeof currentMode !== 'undefined' ? currentMode : 'shot';
    
    if (mode === 'shot') {
        // CONSEJOS DE TIRO
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
        // CONSEJOS DE SALTO VERTICAL EXCLUSIVOS
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
}
