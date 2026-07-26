const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const uploadInput = document.getElementById('video-upload');
const statusText = document.getElementById('status-text');

let minAngle = 180;
let maxAngle = 0;
let highestAnkleY = 1.0;
let lowestAnkleY = 0.0;
let isAiReady = false;

function calculateAngle(a, b, c) {
    let radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360.0 - angle;
    return angle;
}

// Inicializar MediaPipe Pose
const pose = new Pose({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
}});

pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// Confirmar que la IA ha cargado
pose.initialize().then(() => {
    isAiReady = true;
    statusText.innerText = "✅ IA lista. Sube tu vídeo cuando quieras.";
    statusText.style.color = "#00FF00";
}).catch(err => {
    statusText.innerText = "⚠️ Si estás abriendo el archivo en local, súbelo a Vercel para que cargue la IA.";
});

pose.onResults((results) => {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 3});
        drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2, radius: 3});

        const shoulder = results.poseLandmarks[12];
        const elbow = results.poseLandmarks[14];
        const wrist = results.poseLandmarks[16];
        const ankle = results.poseLandmarks[28];

        if (shoulder && elbow && wrist) {
            let angle = calculateAngle(shoulder, elbow, wrist);
            if (angle < minAngle) minAngle = angle;
            if (angle > maxAngle) maxAngle = angle;

            document.getElementById('min-angle-val').innerText = `${Math.round(minAngle)}°`;
            document.getElementById('max-angle-val').innerText = `${Math.round(maxAngle)}°`;
            
            if (minAngle < 70) document.getElementById('min-angle-msg').innerText = "Codo muy cerrado (<70°).";
            else if (minAngle <= 100) document.getElementById('min-angle-msg').innerText = "Buen ángulo de carga.";
            else document.getElementById('min-angle-msg').innerText = "Carga muy abierta.";

            if (maxAngle >= 155) document.getElementById('max-angle-msg').innerText = "Excelente extensión.";
            else document.getElementById('max-angle-msg').innerText = "Falta extensión final.";
        }

        if (ankle) {
            if (ankle.y > lowestAnkleY) lowestAnkleY = ankle.y;
            if (ankle.y < highestAnkleY) highestAnkleY = ankle.y;
            
            let diff = lowestAnkleY - highestAnkleY;
            if (diff > 0.05) {
                let estimatedCm = Math.round(diff * 150);
                document.getElementById('jump-val').innerText = `~${estimatedCm} cm`;
                document.getElementById('jump-msg').innerText = estimatedCm > 40 ? "Buena elevación" : "Elevación baja";
            }
        }
    }
    canvasCtx.restore();
});

uploadInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    minAngle = 180;
    maxAngle = 0;
    highestAnkleY = 1.0;
    lowestAnkleY = 0.0;

    statusText.innerText = "⏳ Procesando biomecánica del vídeo...";
    statusText.style.color = "#ff4b4b";

    const url = URL.createObjectURL(file);
    videoElement.src = url;
    videoElement.muted = true; // Fuerza el silencio para saltarse el bloqueo del navegador
    
    videoElement.onloadeddata = () => {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        videoElement.play();
        procesarLoop();
    };
});

async function procesarLoop() {
    if (!videoElement.paused && !videoElement.ended) {
        await pose.send({image: videoElement});
        requestAnimationFrame(procesarLoop);
    } else if (videoElement.ended) {
        statusText.innerText = "✅ ¡Análisis completado con éxito!";
        statusText.style.color = "#00FF00";
    }
}