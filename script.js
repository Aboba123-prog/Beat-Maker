// Audio Context и переменные
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let isPlaying = false;
let currentStep = 0;
let bpm = 120;
let swing = 0;
let masterVolume = 0.7;
let nextNoteTime = 0;
let scheduleAheadTime = 0.1;
let lookAhead = 25;
let noteLength = 0.05;
let schedulingTimer = null;

// Данные для сохранения активных пэдов
const sequence = {};
const sounds = ['kick', 'snare', 'hihat', 'tomhi', 'tommid', 'tomlow', 'perc1', 'perc2'];
const stepsPerBar = 16;
const mutedTracks = {};

// Инициализация последовательности
sounds.forEach(sound => {
    sequence[sound] = new Array(stepsPerBar).fill(false);
    mutedTracks[sound] = false;
});

// Создание пэдов при загрузке
document.addEventListener('DOMContentLoaded', () => {
    createPads();
    setupControls();
});

// Создание пэдов в интерфейсе
function createPads() {
    sounds.forEach(sound => {
        const padGroup = document.querySelector(`[data-sound="${sound}"]`);
        if (!padGroup) return; // Пропускаем если группы нет
        for (let i = 0; i < stepsPerBar; i++) {
            const pad = document.createElement('div');
            pad.className = 'pad';
            pad.dataset.sound = sound;
            pad.dataset.step = i;
            pad.addEventListener('click', togglePad);
            padGroup.appendChild(pad);
        }
    });
}

// Переключение активности пэда
function togglePad(e) {
    const pad = e.target;
    
    // Проверяем, что это именно пэд
    if (!pad.classList.contains('pad')) return;
    
    const sound = pad.dataset.sound;
    const step = parseInt(pad.dataset.step);
    
    if (!sound || isNaN(step)) return;
    
    sequence[sound][step] = !sequence[sound][step];
    pad.classList.toggle('active');
    
    // Звук клика при нажатии
    playClickSound();
}

// Настройка кнопок управления
function setupControls() {
    const playBtn = document.getElementById('playBtn');
    const stopBtn = document.getElementById('stopBtn');
    const clearBtn = document.getElementById('clearBtn');
    const bpmInput = document.getElementById('bpm');
    const bpmValue = document.getElementById('bpmValue');
    const swingInput = document.getElementById('swing');
    const swingValue = document.getElementById('swingValue');
    const volumeInput = document.getElementById('volume');
    const volumeValue = document.getElementById('volumeValue');

    if (playBtn) playBtn.addEventListener('click', play);
    if (stopBtn) stopBtn.addEventListener('click', stop);
    if (clearBtn) clearBtn.addEventListener('click', clearSequence);
    
    if (bpmInput) bpmInput.addEventListener('input', (e) => {
        bpm = parseInt(e.target.value);
        if (bpmValue) bpmValue.textContent = bpm;
    });

    if (swingInput) swingInput.addEventListener('input', (e) => {
        swing = parseInt(e.target.value) / 100;
        if (swingValue) swingValue.textContent = e.target.value + '%';
    });

    if (volumeInput) volumeInput.addEventListener('input', (e) => {
        masterVolume = parseInt(e.target.value) / 100;
        if (volumeValue) volumeValue.textContent = e.target.value + '%';
    });

    // Добавляем mute кнопки
    const muteBtns = document.querySelectorAll('.mute-btn');
    muteBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sound = btn.dataset.sound;
            if (sound) {
                mutedTracks[sound] = !mutedTracks[sound];
                btn.classList.toggle('muted');
            }
        });
    });
}

// Функция воспроизведения
function play() {
    if (isPlaying) return;
    
    isPlaying = true;
    currentStep = 0;
    nextNoteTime = audioContext.currentTime;
    
    document.getElementById('playBtn').style.opacity = '0.5';
    document.getElementById('playBtn').disabled = true;
    
    scheduler();
}

// Функция остановки
function stop() {
    isPlaying = false;
    currentStep = 0;
    
    // Очистить все активные пэды из анимации
    document.querySelectorAll('.pad.playing').forEach(pad => {
        pad.classList.remove('playing');
    });
    
    document.getElementById('playBtn').style.opacity = '1';
    document.getElementById('playBtn').disabled = false;
}

// Функция очистки последовательности
function clearSequence() {
    sounds.forEach(sound => {
        sequence[sound] = new Array(stepsPerBar).fill(false);
        mutedTracks[sound] = false;
    });
    
    document.querySelectorAll('.pad').forEach(pad => {
        pad.classList.remove('active', 'playing');
    });
    
    document.querySelectorAll('.mute-btn').forEach(btn => {
        btn.classList.remove('muted');
    });
}

// Планировщик нот
function scheduler() {
    while (nextNoteTime < audioContext.currentTime + scheduleAheadTime) {
        scheduleNote(currentStep, nextNoteTime);
        advanceNote();
        nextNoteTime += secondsPerBeat();
    }
    
    if (isPlaying) {
        schedulingTimer = setTimeout(scheduler, lookAhead);
    }
}

// Переход к следующему шагу
function advanceNote() {
    currentStep = (currentStep + 1) % stepsPerBar;
}

// Расчет времени такта с учетом swing
function secondsPerBeat() {
    return (60.0 / bpm) / 4;
}

// Запланировать воспроизведение ноты
function scheduleNote(step, time) {
    let swingTime = 0;
    // Добавляем swing на нечетные шаги
    if (step % 2 === 1) {
        swingTime = secondsPerBeat() * swing * 0.5;
    }
    
    const scheduleTime = time + swingTime;
    
    sounds.forEach(sound => {
        if (sequence[sound][step] && !mutedTracks[sound]) {
            playSound(sound, scheduleTime);
            
            // Визуальная обратная связь
            setTimeout(() => {
                const pad = document.querySelector(`.pad[data-sound="${sound}"][data-step="${step}"]`);
                if (pad) {
                    pad.classList.add('playing');
                    setTimeout(() => pad.classList.remove('playing'), 100);
                }
            }, (scheduleTime - audioContext.currentTime) * 1000);
        }
    });
}

// Генерация и воспроизведение звуков
function playSound(sound, time) {
    const gain = audioContext.createGain();
    gain.gain.value = masterVolume;
    gain.connect(audioContext.destination);
    
    switch(sound) {
        case 'kick':
            playKick(time, gain);
            break;
        case 'snare':
            playSnare(time, gain);
            break;
        case 'hihat':
            playHiHat(time, gain);
            break;
        case 'tomhi':
            playTomHi(time, gain);
            break;
        case 'tommid':
            playTomMid(time, gain);
            break;
        case 'tomlow':
            playTomLow(time, gain);
            break;
        case 'perc1':
            playPerc1(time, gain);
            break;
        case 'perc2':
            playPerc2(time, gain);
            break;
    }
}

// Kick Sound - басовый барабан
function playKick(time, gain) {
    const osc = audioContext.createOscillator();
    
    osc.connect(gain);
    
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
    
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
    
    osc.start(time);
    osc.stop(time + 0.5);
}

// Snare Sound - барабан
function playSnare(time, gain) {
    const noise = audioContext.createBufferSource();
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.2, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    noise.buffer = buffer;
    noise.connect(gain);
    
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    
    noise.start(time);
    noise.stop(time + 0.2);
}

// Hi-Hat Sound - закрытый хай-хэт
function playHiHat(time, gain) {
    const noise = audioContext.createBufferSource();
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    noise.buffer = buffer;
    
    // Фильтр для верхних частот
    const filter = audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    
    noise.connect(filter);
    filter.connect(gain);
    
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    
    noise.start(time);
    noise.stop(time + 0.1);
}

// Tom Hi Sound
function playTomHi(time, gain) {
    const osc = audioContext.createOscillator();
    
    osc.connect(gain);
    
    osc.frequency.setValueAtTime(250, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.12);
    
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
    
    osc.start(time);
    osc.stop(time + 0.12);
}

// Tom Mid Sound
function playTomMid(time, gain) {
    const osc = audioContext.createOscillator();
    
    osc.connect(gain);
    
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.15);
    
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
    
    osc.start(time);
    osc.stop(time + 0.15);
}

// Tom Low Sound
function playTomLow(time, gain) {
    const osc = audioContext.createOscillator();
    
    osc.connect(gain);
    
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(60, time + 0.18);
    
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.18);
    
    osc.start(time);
    osc.stop(time + 0.18);
}

// Perc1 Sound - перкуссия 1
function playPerc1(time, gain) {
    const osc = audioContext.createOscillator();
    
    osc.connect(gain);
    
    osc.frequency.setValueAtTime(400, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.1);
    
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    
    osc.start(time);
    osc.stop(time + 0.1);
}

// Perc2 Sound - перкуссия 2
function playPerc2(time, gain) {
    const osc = audioContext.createOscillator();
    
    osc.connect(gain);
    
    osc.frequency.setValueAtTime(550, time);
    osc.frequency.exponentialRampToValueAtTime(150, time + 0.08);
    
    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);
    
    osc.start(time);
    osc.stop(time + 0.08);
}

// Клик звук при нажатии пэда (iOS-like)
function playClickSound() {
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    
    osc.start(now);
    osc.stop(now + 0.05);
}

// Очистка при выгрузке страницы
window.addEventListener('beforeunload', () => {
    if (isPlaying) {
        stop();
    }
});
