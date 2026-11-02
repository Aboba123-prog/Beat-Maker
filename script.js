(function () {
    "use strict";

    var tracks = [
        { id: "kick", name: "KICK", volume: 0.9 },
        { id: "snare", name: "SNARE", volume: 0.78 },
        { id: "hihat", name: "HI-HAT", volume: 0.62 },
        { id: "openhat", name: "OPEN HAT", volume: 0.55 },
        { id: "tom", name: "TOM", volume: 0.7 },
        { id: "clap", name: "CLAP", volume: 0.65 },
        { id: "rim", name: "RIM", volume: 0.6 },
        { id: "shaker", name: "SHAKER", volume: 0.48 }
    ];

    var stepsPerBar = 16;
    var bars = 1;
    var totalSteps = 16;
    var sequence = {};
    var muted = {};
    var trackVolumes = {};
    var bpm = 120;
    var swing = 0;
    var masterVolume = 0.7;
    var isPlaying = false;
    var currentStep = 0;
    var nextNoteTime = 0;
    var schedulerTimer = null;
    var audioContext = null;
    var masterGain = null;
    var speechVoices = [];
    var speechAvailable = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);

    var el = {
        bpm: document.getElementById("bpm"),
        bpmValue: document.getElementById("bpmValue"),
        swing: document.getElementById("swing"),
        swingValue: document.getElementById("swingValue"),
        volume: document.getElementById("volume"),
        volumeValue: document.getElementById("volumeValue"),
        play: document.getElementById("playBtn"),
        stop: document.getElementById("stopBtn"),
        clear: document.getElementById("clearBtn"),
        save: document.getElementById("saveBtn"),
        load: document.getElementById("loadBtn"),
        download: document.getElementById("downloadBtn"),
        file: document.getElementById("fileInput"),
        stepCount: document.getElementById("stepCount"),
        stepNumbers: document.getElementById("stepNumbers"),
        pads: document.getElementById("pads"),
        mixer: document.getElementById("mixer"),
        bars: document.getElementById("bars"),
        duplicate: document.getElementById("duplicateBtn"),
        patternState: document.getElementById("patternState"),
        status: document.getElementById("statusText"),
        meter: document.getElementById("levelMeter"),
        vocalText: document.getElementById("vocalText"),
        vocalVoice: document.getElementById("vocalVoice"),
        vocalRate: document.getElementById("vocalRate"),
        vocalRateValue: document.getElementById("vocalRateValue"),
        vocalPitch: document.getElementById("vocalPitch"),
        vocalPitchValue: document.getElementById("vocalPitchValue"),
        vocalWithBeat: document.getElementById("vocalWithBeat"),
        vocalPreview: document.getElementById("vocalPreviewBtn"),
        vocalStop: document.getElementById("vocalStopBtn"),
        vocalStatus: document.getElementById("vocalStatus"),
        vocalNote: document.getElementById("vocalNote")
    };

    function makeSteps(length) {
        var result = [];
        var i;
        for (i = 0; i < length; i++) result.push(false);
        return result;
    }

    function initData() {
        var i;
        for (i = 0; i < tracks.length; i++) {
            sequence[tracks[i].id] = makeSteps(totalSteps);
            muted[tracks[i].id] = false;
            trackVolumes[tracks[i].id] = tracks[i].volume;
        }
    }

    function setStatus(message) {
        if (el.status) el.status.textContent = message;
    }

    function setPatternStatus(message) {
        if (el.patternState) el.patternState.textContent = message;
    }

    function setMeter(step) {
        if (!el.meter) return;
        var barsList = el.meter.getElementsByTagName("i");
        var hitCount = 0;
        var i;
        for (i = 0; i < tracks.length; i++) {
            if (sequence[tracks[i].id][step] && !muted[tracks[i].id]) hitCount++;
        }
        var activeCount = Math.min(barsList.length, hitCount * 2 + (hitCount ? 2 : 0));
        for (i = 0; i < barsList.length; i++) {
            barsList[i].className = i < activeCount ? "active" : "";
        }
    }

    function createGrid() {
        var i;
        var j;
        var number;
        var row;
        var label;
        var grid;
        var muteButton;
        el.stepNumbers.innerHTML = "";
        el.pads.innerHTML = "";
        el.stepNumbers.style.setProperty("--steps", totalSteps);
        el.stepCount.textContent = String(totalSteps);

        for (i = 0; i < totalSteps; i++) {
            number = document.createElement("span");
            number.className = "step-num";
            number.textContent = String(i + 1);
            el.stepNumbers.appendChild(number);
        }

        for (i = 0; i < tracks.length; i++) {
            row = document.createElement("div");
            row.className = "pad-row";

            label = document.createElement("span");
            label.className = "pad-label";
            label.textContent = tracks[i].name;
            row.appendChild(label);

            grid = document.createElement("div");
            grid.className = "pad-group";
            grid.setAttribute("data-track", tracks[i].id);
            grid.style.setProperty("--steps", totalSteps);

            for (j = 0; j < totalSteps; j++) {
                var pad = document.createElement("button");
                pad.type = "button";
                pad.className = "pad";
                pad.setAttribute("data-track", tracks[i].id);
                pad.setAttribute("data-step", j);
                pad.setAttribute("aria-label", tracks[i].name + " step " + (j + 1));
                if (sequence[tracks[i].id][j]) pad.className += " active";
                pad.addEventListener("click", togglePad, false);
                grid.appendChild(pad);
            }
            row.appendChild(grid);

            muteButton = document.createElement("button");
            muteButton.type = "button";
            muteButton.className = muted[tracks[i].id] ? "track-mute muted" : "track-mute";
            muteButton.textContent = "M";
            muteButton.setAttribute("data-track", tracks[i].id);
            muteButton.setAttribute("aria-label", "Mute " + tracks[i].name);
            muteButton.addEventListener("click", toggleMute, false);
            row.appendChild(muteButton);
            el.pads.appendChild(row);
        }
        createMixer();
    }

    function createMixer() {
        var i;
        var channel;
        var name;
        var slider;
        el.mixer.innerHTML = "";
        for (i = 0; i < tracks.length; i++) {
            channel = document.createElement("label");
            channel.className = "mixer-channel";
            name = document.createElement("span");
            name.textContent = tracks[i].name;
            slider = document.createElement("input");
            slider.type = "range";
            slider.min = "0";
            slider.max = "100";
            slider.value = String(Math.round(trackVolumes[tracks[i].id] * 100));
            slider.setAttribute("data-track", tracks[i].id);
            slider.setAttribute("aria-label", tracks[i].name + " volume");
            slider.addEventListener("input", changeTrackVolume, false);
            channel.appendChild(name);
            channel.appendChild(slider);
            el.mixer.appendChild(channel);
        }
    }

    function togglePad(event) {
        var pad = event.currentTarget;
        var track = pad.getAttribute("data-track");
        var step = parseInt(pad.getAttribute("data-step"), 10);
        sequence[track][step] = !sequence[track][step];
        pad.className = sequence[track][step] ? "pad active" : "pad";
        setPatternStatus("EDITING");
        setStatus("Pattern updated");
        previewDrum(track);
    }

    function toggleMute(event) {
        var button = event.currentTarget;
        var track = button.getAttribute("data-track");
        muted[track] = !muted[track];
        button.className = muted[track] ? "track-mute muted" : "track-mute";
        setStatus(muted[track] ? track.toUpperCase() + " muted" : track.toUpperCase() + " enabled");
    }

    function changeTrackVolume(event) {
        var input = event.currentTarget;
        trackVolumes[input.getAttribute("data-track")] = parseInt(input.value, 10) / 100;
    }

    function changeLength() {
        var newBars = parseInt(el.bars.value, 10);
        var newTotal = newBars * stepsPerBar;
        var i;
        var j;
        for (i = 0; i < tracks.length; i++) {
            var oldData = sequence[tracks[i].id];
            var nextData = makeSteps(newTotal);
            for (j = 0; j < Math.min(oldData.length, newTotal); j++) nextData[j] = oldData[j];
            sequence[tracks[i].id] = nextData;
        }
        bars = newBars;
        totalSteps = newTotal;
        currentStep = 0;
        createGrid();
        setPatternStatus("" + bars + (bars === 1 ? " BAR" : " BARS"));
        setStatus("Pattern length: " + totalSteps + " steps");
    }

    function duplicateBar() {
        if (bars < 2) {
            setStatus("Choose 2 or 4 bars first");
            return;
        }
        var i;
        var j;
        for (i = 0; i < tracks.length; i++) {
            for (j = stepsPerBar; j < totalSteps; j++) {
                sequence[tracks[i].id][j] = sequence[tracks[i].id][j % stepsPerBar];
            }
        }
        createGrid();
        setPatternStatus("DUPLICATED");
        setStatus("First bar copied across pattern");
    }

    function clearPattern() {
        var i;
        var j;
        for (i = 0; i < tracks.length; i++) {
            for (j = 0; j < totalSteps; j++) sequence[tracks[i].id][j] = false;
            muted[tracks[i].id] = false;
        }
        createGrid();
        setPatternStatus("CLEARED");
        setStatus("Pattern cleared");
        setMeter(-1);
    }

    function ensureAudio() {
        var AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) {
            setStatus("Web Audio is not supported in this browser");
            return false;
        }
        if (!audioContext) {
            audioContext = new AudioCtor();
            masterGain = audioContext.createGain();
            masterGain.gain.value = masterVolume;
            masterGain.connect(audioContext.destination);
        }
        if (audioContext.state === "suspended" && audioContext.resume) audioContext.resume();
        return true;
    }

    function stepDuration() {
        return 60 / bpm / 4;
    }

    function makeNoiseBuffer(ctx, duration) {
        var length = Math.max(1, Math.floor(ctx.sampleRate * duration));
        var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        var data = buffer.getChannelData(0);
        var i;
        for (i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
        return buffer;
    }

    function playNoise(ctx, destination, start, duration, volume, filterType, frequency) {
        var source = ctx.createBufferSource();
        var gain = ctx.createGain();
        var end = start + duration;
        source.buffer = makeNoiseBuffer(ctx, duration);
        if (filterType && ctx.createBiquadFilter) {
            var filter = ctx.createBiquadFilter();
            filter.type = filterType;
            filter.frequency.setValueAtTime(frequency, start);
            source.connect(filter);
            filter.connect(gain);
        } else {
            source.connect(gain);
        }
        gain.gain.setValueAtTime(Math.max(0.0001, volume), start);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        gain.connect(destination);
        source.start(start);
        source.stop(end);
    }

    function playTone(ctx, destination, start, frequency, endFrequency, duration, volume, wave) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        var end = start + duration;
        osc.type = wave || "sine";
        osc.frequency.setValueAtTime(frequency, start);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), end);
        gain.gain.setValueAtTime(Math.max(0.0001, volume), start);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(start);
        osc.stop(end);
    }

    function playInstrument(id, ctx, destination, start, volume, master) {
        var level = Math.max(0, Math.min(1, volume)) * master;
        if (level <= 0) return;
        if (id === "kick") {
            playTone(ctx, destination, start, 145, 42, 0.42, level, "sine");
        } else if (id === "snare") {
            playNoise(ctx, destination, start, 0.19, level * 0.55, "bandpass", 1800);
            playTone(ctx, destination, start, 185, 90, 0.11, level * 0.16, "triangle");
        } else if (id === "hihat") {
            playNoise(ctx, destination, start, 0.075, level * 0.38, "highpass", 7200);
        } else if (id === "openhat") {
            playNoise(ctx, destination, start, 0.3, level * 0.32, "highpass", 5700);
        } else if (id === "tom") {
            playTone(ctx, destination, start, 210, 78, 0.23, level * 0.55, "sine");
        } else if (id === "clap") {
            playNoise(ctx, destination, start, 0.16, level * 0.48, "bandpass", 1250);
        } else if (id === "rim") {
            playTone(ctx, destination, start, 950, 260, 0.055, level * 0.35, "square");
        } else if (id === "shaker") {
            playNoise(ctx, destination, start, 0.11, level * 0.25, "highpass", 4800);
        }
    }

    function previewDrum(track) {
        if (!ensureAudio() || muted[track]) return;
        playInstrument(track, audioContext, masterGain, audioContext.currentTime + 0.015, trackVolumes[track], 1);
    }

    function scheduleStep(step, time) {
        var swingOffset = step % 2 === 1 ? stepDuration() * swing * 0.48 : 0;
        var at = time + swingOffset;
        var i;
        var track;
        for (i = 0; i < tracks.length; i++) {
            track = tracks[i].id;
            if (sequence[track][step] && !muted[track]) {
                playInstrument(track, audioContext, masterGain, at, trackVolumes[track], 1);
            }
        }
        var delay = Math.max(0, (at - audioContext.currentTime) * 1000);
        window.setTimeout(function () {
            var pads = el.pads.querySelectorAll('.pad[data-step="' + step + '"]');
            var k;
            for (k = 0; k < pads.length; k++) pads[k].className = pads[k].className.replace(/\splaying/g, "") + " playing";
            window.setTimeout(function () {
                for (k = 0; k < pads.length; k++) pads[k].className = pads[k].className.replace(/\splaying/g, "");
            }, 105);
            setMeter(step);
        }, delay);
    }

    function scheduler() {
        if (!isPlaying || !audioContext) return;
        while (nextNoteTime < audioContext.currentTime + 0.12) {
            scheduleStep(currentStep, nextNoteTime);
            nextNoteTime += stepDuration();
            currentStep = (currentStep + 1) % totalSteps;
        }
        schedulerTimer = window.setTimeout(scheduler, 25);
    }

    function play() {
        if (isPlaying || !ensureAudio()) return;
        isPlaying = true;
        currentStep = 0;
        nextNoteTime = audioContext.currentTime + 0.04;
        el.play.disabled = true;
        setPatternStatus("PLAYING");
        setStatus("Playing pattern");
        scheduler();
        if (el.vocalWithBeat.checked) speakVocal();
    }

    function stop() {
        isPlaying = false;
        if (schedulerTimer) window.clearTimeout(schedulerTimer);
        schedulerTimer = null;
        currentStep = 0;
        el.play.disabled = false;
        if (el.pads) {
            var activePads = el.pads.querySelectorAll(".pad.playing");
            var i;
            for (i = 0; i < activePads.length; i++) activePads[i].className = activePads[i].className.replace(/\splaying/g, "");
        }
        stopVocal();
        setPatternStatus("STOPPED");
        setStatus("Playback stopped");
        setMeter(-1);
    }

    function updateMaster() {
        masterVolume = parseInt(el.volume.value, 10) / 100;
        el.volumeValue.textContent = el.volume.value + "%";
        if (masterGain && audioContext) masterGain.gain.setTargetAtTime(masterVolume, audioContext.currentTime, 0.015);
    }

    function saveProject() {
        var data = {
            version: 7,
            bpm: bpm,
            swing: swing,
            masterVolume: masterVolume,
            bars: bars,
            sequence: sequence,
            muted: muted,
            trackVolumes: trackVolumes,
            vocalText: el.vocalText.value,
            vocalRate: el.vocalRate.value,
            vocalPitch: el.vocalPitch.value,
            vocalVoice: el.vocalVoice.value
        };
        downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "beat-maker-studio-v7.json");
        setStatus("Project saved as JSON");
    }

    function loadProjectFile(file) {
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
            try {
                var data = JSON.parse(reader.result);
                if (!data || !data.sequence) throw new Error("Invalid project");
                bpm = Math.max(40, Math.min(200, parseInt(data.bpm, 10) || 120));
                swing = Math.max(0, Math.min(1, Number(data.swing) || 0));
                masterVolume = Math.max(0, Math.min(1, Number(data.masterVolume) || 0));
                bars = Math.max(1, Math.min(4, parseInt(data.bars, 10) || 1));
                totalSteps = bars * stepsPerBar;
                var i;
                var j;
                for (i = 0; i < tracks.length; i++) {
                    var id = tracks[i].id;
                    var source = data.sequence[id] || [];
                    sequence[id] = makeSteps(totalSteps);
                    for (j = 0; j < Math.min(source.length, totalSteps); j++) sequence[id][j] = !!source[j];
                    muted[id] = !!(data.muted && data.muted[id]);
                    trackVolumes[id] = data.trackVolumes && typeof data.trackVolumes[id] === "number" ? Math.max(0, Math.min(1, data.trackVolumes[id])) : tracks[i].volume;
                }
                el.bpm.value = String(bpm);
                el.bpmValue.textContent = String(bpm);
                el.swing.value = String(Math.round(swing * 100));
                el.swingValue.textContent = el.swing.value + "%";
                el.volume.value = String(Math.round(masterVolume * 100));
                el.volumeValue.textContent = el.volume.value + "%";
                el.bars.value = String(bars);
                el.vocalText.value = data.vocalText || "";
                el.vocalRate.value = data.vocalRate || "0.95";
                el.vocalPitch.value = data.vocalPitch || "1.05";
                el.vocalVoice.value = data.vocalVoice || "";
                el.vocalRateValue.textContent = el.vocalRate.value;
                el.vocalPitchValue.textContent = el.vocalPitch.value;
                try { localStorage.setItem("beatmaker-v7-vocal", el.vocalText.value); } catch (ignore) { }
                if (masterGain && audioContext) masterGain.gain.value = masterVolume;
                createGrid();
                setPatternStatus("LOADED");
                setStatus("Project loaded");
            } catch (error) {
                setStatus("Could not load this project");
                window.alert("Не удалось открыть проект. Проверь JSON-файл.");
            }
        };
        reader.onerror = function () {
            setStatus("File read error");
        };
        reader.readAsText(file);
    }

    function audioBufferToWav(buffer) {
        var channels = buffer.numberOfChannels;
        var length = buffer.length;
        var sampleRate = buffer.sampleRate;
        var bytesPerSample = 2;
        var blockAlign = channels * bytesPerSample;
        var dataSize = length * blockAlign;
        var arrayBuffer = new ArrayBuffer(44 + dataSize);
        var view = new DataView(arrayBuffer);
        var channelData = [];
        var i;
        var channel;
        var sample;
        var offset = 44;
        function writeString(position, value) {
            var n;
            for (n = 0; n < value.length; n++) view.setUint8(position + n, value.charCodeAt(n));
        }
        writeString(0, "RIFF");
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, "WAVE");
        writeString(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, channels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true);
        writeString(36, "data");
        view.setUint32(40, dataSize, true);
        for (channel = 0; channel < channels; channel++) channelData.push(buffer.getChannelData(channel));
        for (i = 0; i < length; i++) {
            for (channel = 0; channel < channels; channel++) {
                sample = Math.max(-1, Math.min(1, channelData[channel][i]));
                view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
                offset += 2;
            }
        }
        return new Blob([arrayBuffer], { type: "audio/wav" });
    }

    function downloadBlob(blob, filename) {
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }

    function exportWav() {
        var OfflineCtor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!OfflineCtor) {
            setStatus("WAV export is not supported in this browser");
            window.alert("Этот браузер не поддерживает OfflineAudioContext для экспорта WAV.");
            return;
        }
        var wasPlaying = isPlaying;
        if (wasPlaying) stop();
        var loops = 2;
        var duration = stepDuration() * totalSteps * loops + 1;
        var sampleRate = 44100;
        var frames = Math.ceil(duration * sampleRate);
        var offline;
        var completed = false;
        var originalText = el.download.textContent;
        el.download.disabled = true;
        el.download.textContent = "RENDERING...";
        try {
            offline = new OfflineCtor(2, frames, sampleRate);
            var master = offline.createGain();
            master.gain.value = masterVolume;
            master.connect(offline.destination);
            var loop;
            var step;
            var i;
            var track;
            for (loop = 0; loop < loops; loop++) {
                for (step = 0; step < totalSteps; step++) {
                    var time = (loop * totalSteps + step) * stepDuration();
                    if (step % 2 === 1) time += stepDuration() * swing * 0.48;
                    for (i = 0; i < tracks.length; i++) {
                        track = tracks[i].id;
                        if (sequence[track][step] && !muted[track]) {
                            playInstrument(track, offline, master, time, trackVolumes[track], 1);
                        }
                    }
                }
            }
            function finish(buffer) {
                if (completed) return;
                completed = true;
                try {
                    downloadBlob(audioBufferToWav(buffer), "beat-maker-studio-v7.wav");
                    setStatus("WAV exported · Instrumental only");
                } catch (error) {
                    setStatus("WAV conversion failed");
                    window.alert("Не удалось преобразовать аудио в WAV.");
                }
                el.download.disabled = false;
                el.download.textContent = originalText;
            }
            function fail() {
                if (completed) return;
                completed = true;
                el.download.disabled = false;
                el.download.textContent = originalText;
                setStatus("WAV export failed");
                window.alert("Не удалось создать WAV в этом браузере.");
            }
            offline.oncomplete = function (event) { finish(event.renderedBuffer); };
            offline.onerror = fail;
            var rendering = offline.startRendering();
            if (rendering && typeof rendering.then === "function") rendering.then(finish, fail);
        } catch (error) {
            el.download.disabled = false;
            el.download.textContent = originalText;
            setStatus("WAV export failed");
            window.alert("Ошибка экспорта WAV: " + error.message);
        }
    }

    function setVocalStatus(message) {
        if (el.vocalStatus) el.vocalStatus.textContent = message;
    }

    function stopVocal() {
        if (speechAvailable) window.speechSynthesis.cancel();
        setVocalStatus("STOPPED");
    }

    function chooseVoice() {
        if (!speechVoices.length) return null;
        if (el.vocalVoice.value !== "") {
            var index = parseInt(el.vocalVoice.value, 10);
            if (speechVoices[index]) return speechVoices[index];
        }
        var language = (navigator.language || "ru-RU").toLowerCase();
        var i;
        for (i = 0; i < speechVoices.length; i++) {
            if ((speechVoices[i].lang || "").toLowerCase() === language) return speechVoices[i];
        }
        for (i = 0; i < speechVoices.length; i++) {
            if ((speechVoices[i].lang || "").toLowerCase().indexOf(language.split("-")[0]) === 0) return speechVoices[i];
        }
        for (i = 0; i < speechVoices.length; i++) {
            if ((speechVoices[i].lang || "").toLowerCase().indexOf("ru") === 0) return speechVoices[i];
        }
        return speechVoices[0];
    }

    function loadVoices() {
        if (!speechAvailable) return;
        speechVoices = window.speechSynthesis.getVoices() || [];
        var oldValue = el.vocalVoice.value;
        el.vocalVoice.innerHTML = "";
        var automatic = document.createElement("option");
        automatic.value = "";
        automatic.textContent = "AUTO";
        el.vocalVoice.appendChild(automatic);
        var i;
        for (i = 0; i < speechVoices.length; i++) {
            var option = document.createElement("option");
            option.value = String(i);
            option.textContent = speechVoices[i].name + " · " + speechVoices[i].lang;
            el.vocalVoice.appendChild(option);
        }
        el.vocalVoice.value = oldValue;
    }

    function speakVocal() {
        if (!speechAvailable) {
            setVocalStatus("NOT SUPPORTED");
            el.vocalNote.textContent = "В этом браузере нет встроенного синтеза речи. Попробуй более новый браузер.";
            return;
        }
        var text = el.vocalText.value.replace(/^\s+|\s+$/g, "");
        if (!text) {
            setVocalStatus("ADD TEXT");
            el.vocalText.focus();
            return;
        }
        window.speechSynthesis.cancel();
        var utterance = new window.SpeechSynthesisUtterance(text);
        var voice = chooseVoice();
        if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
        } else {
            utterance.lang = navigator.language || "ru-RU";
        }
        utterance.rate = parseFloat(el.vocalRate.value);
        utterance.pitch = parseFloat(el.vocalPitch.value);
        utterance.volume = 1;
        utterance.onstart = function () { setVocalStatus("SPEAKING"); };
        utterance.onend = function () { setVocalStatus("READY"); };
        utterance.onerror = function () { setVocalStatus("VOICE ERROR"); };
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
    }

    function bindControls() {
        el.bpm.addEventListener("input", function () {
            bpm = parseInt(el.bpm.value, 10);
            el.bpmValue.textContent = String(bpm);
        }, false);
        el.swing.addEventListener("input", function () {
            swing = parseInt(el.swing.value, 10) / 100;
            el.swingValue.textContent = el.swing.value + "%";
        }, false);
        el.volume.addEventListener("input", updateMaster, false);
        el.play.addEventListener("click", play, false);
        el.stop.addEventListener("click", stop, false);
        el.clear.addEventListener("click", clearPattern, false);
        el.save.addEventListener("click", saveProject, false);
        el.load.addEventListener("click", function () { el.file.click(); }, false);
        el.file.addEventListener("change", function () {
            if (el.file.files && el.file.files[0]) loadProjectFile(el.file.files[0]);
            el.file.value = "";
        }, false);
        el.download.addEventListener("click", exportWav, false);
        el.bars.addEventListener("change", function () {
            if (isPlaying) stop();
            changeLength();
        }, false);
        el.duplicate.addEventListener("click", duplicateBar, false);
        el.vocalPreview.addEventListener("click", speakVocal, false);
        el.vocalStop.addEventListener("click", stopVocal, false);
        el.vocalRate.addEventListener("input", function () { el.vocalRateValue.textContent = el.vocalRate.value; }, false);
        el.vocalPitch.addEventListener("input", function () { el.vocalPitchValue.textContent = el.vocalPitch.value; }, false);
        el.vocalText.addEventListener("input", function () {
            try { localStorage.setItem("beatmaker-v7-vocal", el.vocalText.value); } catch (ignore) { }
        }, false);
        window.addEventListener("beforeunload", function () {
            if (isPlaying) stop();
            if (speechAvailable) window.speechSynthesis.cancel();
        }, false);
    }

    function initialize() {
        initData();
        createGrid();
        bindControls();
        if (speechAvailable) {
            loadVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) window.speechSynthesis.onvoiceschanged = loadVoices;
            el.vocalNote.textContent = "Доступные голоса зависят от устройства. Озвучка не записывается в WAV.";
            try { el.vocalText.value = localStorage.getItem("beatmaker-v7-vocal") || ""; } catch (ignore) { }
        } else {
            setVocalStatus("NOT SUPPORTED");
            el.vocalNote.textContent = "Встроенный голосовой синтез недоступен в этом браузере.";
        }
        setPatternStatus("READY");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, false);
    } else {
        initialize();
    }
}());
