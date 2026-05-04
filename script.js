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
    const downloadBtn = document.getElementById('downloadBtn');
    const bpmInput = document.getElementById('bpm');
    const bpmValue = document.getElementById('bpmValue');
    const swingInput = document.getElementById('swing');
    const swingValue = document.getElementById('swingValue');
    const volumeInput = document.getElementById('volume');
    const volumeValue = document.getElementById('volumeValue');

    if (playBtn) playBtn.addEventListener('click', play);
    if (stopBtn) stopBtn.addEventListener('click', stop);
    if (clearBtn) clearBtn.addEventListener('click', clearSequence);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadSequence);
    
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

// Функция скачивания последовательности как WAV файл
async function downloadSequence() {
    const downloadBtn = document.getElementById('downloadBtn');
    const originalText = downloadBtn.textContent;
    downloadBtn.textContent = '⏳ WAIT...';
    downloadBtn.disabled = true;
    
    try {
        // Количество повторений последовательности (2 цикла)
        const numLoops = 2;
        const totalSeconds = secondsPerBeat() * stepsPerBar * numLoops;
        const sampleRate = 44100;
        const totalSamples = Math.ceil(totalSeconds * sampleRate);
        
        // Создаем offline контекст для рендеринга
        const offlineContext = new OfflineAudioContext(2, totalSamples, sampleRate);
        
        // Проигрываем всю последовательность в offline контекст
        for (let loop = 0; loop < numLoops; loop++) {
            for (let step = 0; step < stepsPerBar; step++) {
                const stepTime = (loop * stepsPerBar + step) * secondsPerBeat();
                
                let swingTime = 0;
                if (step % 2 === 1) {
                    swingTime = secondsPerBeat() * swing * 0.5;
                }
                
                const scheduleTime = stepTime + swingTime;
                
                sounds.forEach(sound => {
                    if (sequence[sound][step] && !mutedTracks[sound]) {
                        playSoundOffline(sound, scheduleTime, offlineContext);
                    }
                });
            }
        }
        
        // Рендерим аудио
        const audioBuffer = await offlineContext.startRendering();
        
        // Конвертируем в WAV и скачиваем
        const wavBlob = audioBufferToWav(audioBuffer);
        const url = URL.createObjectURL(wavBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `beatmaker-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).substr(2, 9)}.wav`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        downloadBtn.textContent = '✓ DONE!';
        setTimeout(() => {
            downloadBtn.textContent = originalText;
            downloadBtn.disabled = false;
        }, 2000);
        
    } catch (error) {
        console.error('Error downloading sequence:', error);
        alert('Ошибка при скачивании бита: ' + error.message);
        downloadBtn.textContent = originalText;
        downloadBtn.disabled = false;
    }
}

// Функция воспроизведения звуков в offline контекст
function playSoundOffline(sound, time, offlineContext) {
    const gain = offlineContext.createGain();
    gain.gain.value = masterVolume;
    gain.connect(offlineContext.destination);
    
    switch(sound) {
        case 'kick':
            playKickOffline(time, gain, offlineContext);
            break;
        case 'snare':
            playSnareOffline(time, gain, offlineContext);
            break;
        case 'hihat':
            playHiHatOffline(time, gain, offlineContext);
            break;
        case 'tomhi':
            playTomHiOffline(time, gain, offlineContext);
            break;
        case 'tommid':
            playTomMidOffline(time, gain, offlineContext);
            break;
        case 'tomlow':
            playTomLowOffline(time, gain, offlineContext);
            break;
        case 'perc1':
            playPerc1Offline(time, gain, offlineContext);
            break;
        case 'perc2':
            playPerc2Offline(time, gain, offlineContext);
            break;
    }
}

// Offline версии звуков
function playKickOffline(time, gain, ctx) {
    const osc = ctx.createOscillator();
    osc.connect(gain);
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
    gain.gain.setValueAtTime(1 * masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, time + 0.5);
    osc.start(time);
    osc.stop(time + 0.5);
}

function playSnareOffline(time, gain, ctx) {
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = buffer;
    noise.connect(gain);
    gain.gain.setValueAtTime(0.3 * masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, time + 0.2);
    noise.start(time);
    noise.stop(time + 0.2);
}

function playHiHatOffline(time, gain, ctx) {
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    noise.connect(filter);
    filter.connect(gain);
    gain.gain.setValueAtTime(0.15 * masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, time + 0.1);
    noise.start(time);
    noise.stop(time + 0.1);
}

function playTomHiOffline(time, gain, ctx) {
    const osc = ctx.createOscillator();
    osc.connect(gain);
    osc.frequency.setValueAtTime(250, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.12);
    gain.gain.setValueAtTime(0.4 * masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, time + 0.12);
    osc.start(time);
    osc.stop(time + 0.12);
}

function playTomMidOffline(time, gain, ctx) {
    const osc = ctx.createOscillator();
    osc.connect(gain);
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.15);
    gain.gain.setValueAtTime(0.4 * masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, time + 0.15);
    osc.start(time);
    osc.stop(time + 0.15);
}

function playTomLowOffline(time, gain, ctx) {
    const osc = ctx.createOscillator();
    osc.connect(gain);
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(60, time + 0.18);
    gain.gain.setValueAtTime(0.4 * masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, time + 0.18);
    osc.start(time);
    osc.stop(time + 0.18);
}

function playPerc1Offline(time, gain, ctx) {
    const osc = ctx.createOscillator();
    osc.connect(gain);
    osc.frequency.setValueAtTime(400, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.1);
    gain.gain.setValueAtTime(0.3 * masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, time + 0.1);
    osc.start(time);
    osc.stop(time + 0.1);
}

function playPerc2Offline(time, gain, ctx) {
    const osc = ctx.createOscillator();
    osc.connect(gain);
    osc.frequency.setValueAtTime(550, time);
    osc.frequency.exponentialRampToValueAtTime(150, time + 0.08);
    gain.gain.setValueAtTime(0.25 * masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, time + 0.08);
    osc.start(time);
    osc.stop(time + 0.08);
}

// Конвертирование AudioBuffer в WAV
function audioBufferToWav(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    
    const channels = [];
    for (let i = 0; i < numberOfChannels; i++) {
        channels.push(audioBuffer.getChannelData(i));
    }
    
    let offset = 0;
    let bufferLength = 44 + audioBuffer.length * numberOfChannels * bytesPerSample;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);
    
    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };
    
    const floatTo16BitPCM = (output, offset, input) => {
        for (let i = 0; i < input.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, audioBuffer.length * numberOfChannels * 2, true);
    
    let index = 44;
    const volume = 1;
    if (numberOfChannels === 2) {
        for (let i = 0; i < audioBuffer.length; i++) {
            floatTo16BitPCM(view, index, channels[0].subarray(i, i + 1));
            index += 2;
            floatTo16BitPCM(view, index, channels[1].subarray(i, i + 1));
            index += 2;
        }
    } else {
        for (let i = 0; i < audioBuffer.length; i++) {
            floatTo16BitPCM(view, index, channels[0].subarray(i, i + 1));
            index += 2;
        }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
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
    
    gain.gain.setValueAtTime(masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, time + 0.5);
    
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
    
    gain.gain.setValueAtTime(0.3 * masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, time + 0.2);
    
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
    
    gain.gain.setValueAtTime(0.15 * masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, time + 0.1);
    
    noise.start(time);
    noise.stop(time + 0.1);
}

// Tom Hi Sound
function playTomHi(time, gain) {
    const osc = audioContext.createOscillator();
    
    osc.connect(gain);
    
    osc.frequency.setValueAtTime(250, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.12);
    
    gain.gain.setValueAtTime(0.4 * masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, time + 0.12);
    
    osc.start(time);
    osc.stop(time + 0.12);
}

// Tom Mid Sound
function playTomMid(time, gain) {
    const osc = audioContext.createOscillator();
    
    osc.connect(gain);
    
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.15);
    
    gain.gain.setValueAtTime(0.4 * masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, time + 0.15);
    
    osc.start(time);
    osc.stop(time + 0.15);
}

// Tom Low Sound
function playTomLow(time, gain) {
    const osc = audioContext.createOscillator();
    
    osc.connect(gain);
    
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(60, time + 0.18);
    
    gain.gain.setValueAtTime(0.4 * masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, time + 0.18);
    
    osc.start(time);
    osc.stop(time + 0.18);
}

// Perc1 Sound - перкуссия 1
function playPerc1(time, gain) {
    const osc = audioContext.createOscillator();
    
    osc.connect(gain);
    
    osc.frequency.setValueAtTime(400, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.1);
    
    gain.gain.setValueAtTime(0.3 * masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, time + 0.1);
    
    osc.start(time);
    osc.stop(time + 0.1);
}

// Perc2 Sound - перкуссия 2
function playPerc2(time, gain) {
    const osc = audioContext.createOscillator();
    
    osc.connect(gain);
    
    osc.frequency.setValueAtTime(550, time);
    osc.frequency.exponentialRampToValueAtTime(150, time + 0.08);
    
    gain.gain.setValueAtTime(0.25 * masterVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, time + 0.08);
    
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

const fileInput = document.getElementById('fileInput');
const loadBtn = document.querySelector('.btn-load');

loadBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(event) {
        const data = JSON.parse(event.target.result);

        // восстановление
        Object.assign(sequence, data.sequence);
        Object.assign(mutedTracks, data.mutedTracks);
        bpm = data.bpm;
        swing = data.swing;

        // обновление UI
        document.querySelectorAll('.pad').forEach(pad => {
            const sound = pad.dataset.sound;
            const step = parseInt(pad.dataset.step);

            pad.classList.toggle('active', sequence[sound][step]);
        });
    };

    reader.readAsText(file);
});

function saveProject() {
    const data = {
        sequence,
        mutedTracks,
        bpm,
        swing
    };

    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'beat-project.json';
    a.click();

    URL.revokeObjectURL(url);
}
