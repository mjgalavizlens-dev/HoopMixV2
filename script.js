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
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        // Dibujar Esqueleto Biomecánico
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00F0FF', lineWidth: 3 });
        drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#FF4A00', lineWidth: 2, radius: 4 });

        const landmarks = results.poseLandmarks;
        const shoulder = landmarks[12];
        const elbow = landmarks[14];
        const wrist = landmarks[16];
        const hip = landmarks[24];

        if (shoulder && elbow && wrist) {
            const currentAngle = calculateAngle(shoulder, elbow, wrist);
            if (currentAngle < minElbowAngle) minElbowAngle = Math.round(currentAngle);
            if (currentAngle > maxElbowAngle) maxElbowAngle = Math.round(currentAngle);
            
            minAngleVal.innerText = `${minElbowAngle}°`;
            maxAngleVal.innerText = `${maxElbowAngle}°`;
        }

        if (hip) {
            const yPos = hip.y * canvasElement.height;
            if (yPos < minYHip) minYHip = yPos;
            if (yPos > maxYHip) maxYHip = yPos;
            
            const verticalDelta = Math.round(maxYHip - minYHip);
            jumpVal.innerText = verticalDelta;
        }
    }
    canvasCtx.restore();
}

// PROCESAMIENTO DE VÍDEO CON BARRA DE PROGRESO REAL
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

    const url = URL.createObjectURL(file);
    videoElement.src = url;

    videoElement.onloadedmetadata = () => {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        statusText.innerText = "Analizando fotogramas...";
        processVideo();
    };
});

async function processVideo() {
    videoElement.currentTime = 0;
    const duration = videoElement.duration;

    function step() {
        if (videoElement.currentTime < duration) {
            pose.send({ image: videoElement });

            // Actualizar Línea de Carga
            const progress = Math.round((videoElement.currentTime / duration) * 100);
            progressBar.style.width = `${progress}%`;
            progressPercent.innerText = `${progress}%`;

            videoElement.currentTime += 0.08; // Avanzar fotogramas
            requestAnimationFrame(step);
        } else {
            // Finalizado
            progressBar.style.width = "100%";
            progressPercent.innerText = "100%";
            statusText.innerText = "Análisis completado";
            generateCoachAdvice();
        }
    }
    step();
}

// GENERADOR DE CONSEJOS DE ENTRENADOR DE ÉLITE
function generateCoachAdvice() {
    coachCard.style.display = "block";
    
    if (typeof currentMode === 'undefined' || currentMode === 'shot') {
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
            feedback += " Además, <strong>no estás terminando la extensión:</strong> Cortas el seguimiento con la muñeca antes de tiempo. Mantén el brazo extendido y la 'mano en el aro' hasta que el balón toque la red.";
        } else {
            feedback += " <strong>Excelente seguimiento (Follow-through):</strong> Tu brazo se extiende completamente asegurando una parábola suave.";
        }

        coachAdvice.innerHTML = feedback;

    } else {
        // CONSEJOS DE SALTO VERTICAL
        const delta = Math.round(maxYHip - minYHip);
        let feedback = "";

        if (delta < 50) {
            feedback = "<strong>Pérdida de Transmisión de Fuerza:</strong> La carga es demasiado rígida. Flexiona caderas y rodillas de manera más dinámica antes del despegue para convertir la energía elástica del suelo en elevación pura.";
        } else if (delta < 120) {
            feedback = "<strong>Buen Muelle Base:</strong> Flexión adecuada. Para ganar centímetros extra, enfócate en acelerar la velocidad del último paso (plant-step) y coordinar el balanceo de brazos hacia arriba justo antes del despegue.";
        } else {
            feedback = "<strong>Potencia Explosiva Brutal:</strong> Gran transferencia de triple extensión (tobillo, rodilla y cadera). Mantén la fluidez de entrada para no perder velocidad horizontal en los pasos previos.";
        }

        coachAdvice.innerHTML = feedback;
    }
}
