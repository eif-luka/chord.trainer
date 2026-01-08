// Akkordtypen – alle sind immer aktiv
const CHORD_TYPES = [
  { id: "Dur",        label: "Dur",        intervals: [0, 4, 7] },
  { id: "Durmaj",     label: "Dur maj",    intervals: [0, 4, 7, 11] },
  { id: "Dur7",       label: "Dur7",       intervals: [0, 4, 7, 10] },
  { id: "Dur6",       label: "Dur6",       intervals: [0, 4, 7, 9] },
  { id: "Moll",       label: "Moll",       intervals: [0, 3, 7] },
  { id: "Moll7",      label: "Moll7",      intervals: [0, 3, 7, 10] },
  { id: "Moll6",      label: "Moll6",      intervals: [0, 3, 7, 9] },
  { id: "Vermindert", label: "Vermindert", intervals: [0, 3, 6] },
  { id: "Übermäßig",  label: "Übermäßig",  intervals: [0, 4, 8] }
];

// --- Piano / SoundFont -------------------------------------------------

let audioCtx = null;
let pianoPromise = null;

function ensurePiano() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (!pianoPromise) {
    // Echtes Klavier über Soundfont-Player (FluidR3_GM Piano)
    pianoPromise = Soundfont.instrument(audioCtx, "acoustic_grand_piano", {
      soundfont: "FluidR3_GM",
      format: "mp3"
    });
  }
  return pianoPromise;
}

// aktuell spielende Noten (für Stop)
const voiceNodes = {
  chord: [],
  soprano: [],
  alto: [],
  tenor: [],
  bass: []
};

const playingFlags = {
  chord: false,
  soprano: false,
  alto: false,
  tenor: false,
  bass: false
};

function stopVoice(role) {
  const nodes = voiceNodes[role];
  if (nodes && nodes.length) {
    nodes.forEach(n => n && n.stop && n.stop());
  }
  voiceNodes[role] = [];
  playingFlags[role] = false;
  updatePlayButtons();
}

function stopAllVoices() {
  ["chord", "soprano", "alto", "tenor", "bass"].forEach(stopVoice);
}

function playNotes(role, noteNames, durationSec = 3) {
  ensurePiano().then(piano => {
    stopVoice(role); // ggf. neu starten
    const when = audioCtx.currentTime;
    const nodes = noteNames.map(note =>
      piano.play(note, when, { gain: 0.9, duration: durationSec })
    );
    voiceNodes[role] = nodes;
    playingFlags[role] = true;
    updatePlayButtons();

    // nach Ende optisch wieder zurück
    setTimeout(() => {
      playingFlags[role] = false;
      updatePlayButtons();
    }, durationSec * 1000);
  });
}

// --- Akkord-Generierung -----------------------------------------------

function midiToNoteName(midi) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const pitch = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return names[pitch] + octave;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomChord() {
  const type = randomFrom(CHORD_TYPES);

  // Grundton im Bereich etwa A2–E3 (MIDI 45–52)
  const rootMidi = 45 + Math.floor(Math.random() * 8);

  let notesMidi = type.intervals.map(i => rootMidi + i);

  // 3-Klang -> 4-stimmig machen (Root oktavieren)
  if (notesMidi.length === 3) {
    notesMidi.push(rootMidi + 12);
  }

  // sortieren (Bass unten, Sopran oben)
  notesMidi.sort((a, b) => a - b);

  const bassMidi = notesMidi[0];
  const tenorMidi = notesMidi[1];
  const altoMidi = notesMidi[2];
  const sopranoMidi = notesMidi[notesMidi.length - 1];

  return {
    type, // {id, label, intervals}
    notesMidi,
    notes: notesMidi.map(midiToNoteName),
    voices: {
      bass: midiToNoteName(bassMidi),
      tenor: midiToNoteName(tenorMidi),
      alto: midiToNoteName(altoMidi),
      soprano: midiToNoteName(sopranoMidi)
    }
  };
}

// --- DOM / UI ---------------------------------------------------------

const playButtons = document.querySelectorAll(".btn-play");
const stopAllButton = document.getElementById("btn-stop-all");
const newChordButton = document.getElementById("btn-new-chord");
const answerButtons = document.querySelectorAll(".answer-btn");
const feedbackText = document.getElementById("feedback-text");
const feedbackDetail = document.getElementById("feedback-detail");
const hintText = document.getElementById("hint-text");

let currentChord = null; // Ergebnis von generateRandomChord()

function updatePlayButtons() {
  playButtons.forEach(btn => {
    const role = btn.dataset.role;
    if (playingFlags[role]) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

function clearFeedback() {
  feedbackText.textContent = "";
  feedbackText.className = "";
  feedbackDetail.textContent = "";
}

function setHint(msg) {
  if (hintText) {
    hintText.textContent = msg;
  }
}

function createNewChord() {
  currentChord = generateRandomChord();
  stopAllVoices();
  clearFeedback();
  setHint("Akkord bereit – klicke auf „Spielen“ oder höre dir die Einzelstimmen an.");
}

// --- Event-Handler ----------------------------------------------------

playButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (!currentChord) {
      setHint("Erst „Neuer Akkord“ klicken.");
      return;
    }
    const role = btn.dataset.role;
    switch (role) {
      case "chord":
        playNotes("chord", currentChord.notes);
        break;
      case "soprano":
        playNotes("soprano", [currentChord.voices.soprano]);
        break;
      case "alto":
        playNotes("alto", [currentChord.voices.alto]);
        break;
      case "tenor":
        playNotes("tenor", [currentChord.voices.tenor]);
        break;
      case "bass":
        playNotes("bass", [currentChord.voices.bass]);
        break;
    }
  });
});

stopAllButton.addEventListener("click", () => {
  stopAllVoices();
});

newChordButton.addEventListener("click", () => {
  createNewChord();
});

answerButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const guessId = btn.dataset.chord;
    if (!currentChord) {
      setHint("Erst „Neuer Akkord“ klicken.");
      return;
    }
    clearFeedback();

    const correctId = currentChord.type.id;
    const correctLabel = currentChord.type.label;

    if (guessId === correctId) {
      feedbackText.textContent = "Richtig!";
      feedbackText.className = "feedback-correct";
      feedbackDetail.textContent = `Das war: ${correctLabel}.`;
    } else {
      const guessedType = CHORD_TYPES.find(t => t.id === guessId);
      feedbackText.textContent = "Falsch.";
      feedbackText.className = "feedback-wrong";
      feedbackDetail.textContent =
        `Du hast „${guessedType.label}“ gewählt – richtig ist „${correctLabel}“.`;
    }
  });
});

// Initial-Hinweis
setHint("Klicke auf „Neuer Akkord“, um zu starten.");
