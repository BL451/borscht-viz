let theShader, prev, next;
let z = 0;
let level = 0;
let prelevel = 0;
const GAIN = 0.004;
let Z_GAIN = 0.07;
let LEVEL_GAIN = 0.1;
let rate_mod = 1;
let fft, mediaSource, audio_started;
// Non-UI elements
let streamElement;
// UI elements
let volumeSlider, playPauseButton, muteButton;
// Image assets
let playImage, pauseImage, volumeImage, muteImage;
let UI_SIZE, fps;

const isMob = /Android|webOS|iPhone|iPad|IEMobile|Opera Mini/i.test(navigator.userAgent);
// As of this writing, there appears to be a much-reported bug in Safari that prevents audio capture from a stream
// All calls succeed without error, yet the output of the analyzer is always zeroes (only in Safari)
// As a result, we'll include a special case for Safari to make the visualizer move based on a Perlin noise value while the stream is playing and unmuted
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

if (isMob) {
    UI_SIZE = 84;
    fps = 30;
} else {
    UI_SIZE = 42;
    fps = 60;
}

function preload() {
    theShader = loadShader('./src/shaders/blob/vert.glsl', './src/shaders/blob/frag.glsl');
}

function initUI() {
    if (!isMob) {
        volumeSlider = createSlider(0, 1, 1, 0);
        volumeSlider.addClass("slider");
        volumeSlider.input(function () {
            streamElement.volume = easeInSine(volumeSlider.value());
        });
    }
    playPauseButton = createImg('./assets/play-button.svg');
    playPauseButton.mousePressed(togglePlay);
    playPauseButton.addClass("playButton");
    muteButton = createImg('./assets/volume-button.svg');
    muteButton.mousePressed(toggleMute);
    muteButton.addClass("playButton");
}

function positionUI() {
    if (!isMob) {
        volumeSlider.position(width / 2, 4.4 * height / 5);
        volumeSlider.center("horizontal");
    }
    playPauseButton.size(UI_SIZE, UI_SIZE);
    playPauseButton.position(width / 2, 4.1 * height / 5);
    playPauseButton.center("horizontal");
    muteButton.size(UI_SIZE, UI_SIZE);
    muteButton.position(width / 2, 4.6 * height / 5);
    muteButton.center("horizontal");
}

function setup() {
    // disables scaling for retina screens which can create inconsistent scaling between displays
    pixelDensity(1);
    createCanvas(windowWidth, windowHeight, WEBGL);
    imageMode(CENTER);
    frameRate(fps);
    streamElement = document.getElementById("stream");
    // instantiate UI
    initUI();
    positionUI();
    //prev = createFramebuffer();
    next = createFramebuffer();
    fft = new p5.FFT(0.6, 32);
    audio_started = false;
    background(255);
}

function draw() {
    if (frameRate() != 0) {
        rate_mod = Math.min(60 / frameRate(), 2);
    }

    if (isSafari && !streamElement.paused && !stream.muted) {
        prelevel = 0.1 + 0.7 * noise(frameCount / 1000);
    } else if (audio_started && fft) {
        fft.analyze();
        prelevel = GAIN * fft.getEnergy(16, 16384);
        text(prelevel, 0, 0);
    } else {
        prelevel = 0;
    }
    z += rate_mod * Z_GAIN * prelevel
    level += rate_mod * LEVEL_GAIN * (prelevel - level);

    // shader() sets the active shader with our shader
    next.begin();
    clear();
    // setUniform() sends values to the shader
    theShader.setUniform("u_resolution", [width, height]);
    theShader.setUniform("u_time", millis() / 1000.0);
    theShader.setUniform("u_z", z);
    theShader.setUniform("u_level", 2 * level);
    shader(theShader);

    // rect gives us some geometry on the screen
    rect(0, 0, width, height);
    next.end();
    image(next, 0, 0);
}

function initAudio() {
    if (!audio_started) {
        userStartAudio();
        let context = getAudioContext();
        // wire all media elements up to the p5.sound AudioContext
        for (let elem of selectAll('audio')) {
            mediaSource = context.createMediaElementSource(elem.elt);
            mediaSource.connect(p5.soundOut);
        }
        audio_started = true;
    }
}

function togglePlay() {
    initAudio();
    if (streamElement.paused) {
        streamElement.play();
        playPauseButton.elt.src = './assets/pause-button.svg';
    } else {
        streamElement.pause();
        playPauseButton.elt.src = './assets/play-button.svg';
    }
}

function toggleMute() {
    initAudio();
    if (streamElement.muted) {
        streamElement.muted = false;
        muteButton.elt.src = './assets/volume-button.svg';
    } else {
        streamElement.muted = true;
        muteButton.elt.src = './assets/mute-button.svg';
    }
}

function mousePressed() {
    initAudio();
}

function touchStarted() {
    initAudio();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    positionUI();
}