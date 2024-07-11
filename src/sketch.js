let theShader, prev, next;
let z = 0;
let ssao = true;
let level = 0;
let prelevel = 0;
const GAIN = 0.004;
let fft, mediaSource, audio_started;
// Non-UI elements
let streamElement;
// UI elements
let volumeSlider, playPauseButton, muteButton;
// Image assets
let playImage, pauseImage, volumeImage, muteImage;

const UI_SIZE = 42;

function preload() {
    theShader = loadShader('./src/shaders/blob/vert.glsl', './src/shaders/blob/frag.glsl');
}

function initUI() {
    volumeSlider = createSlider(0, 1, 1, 0);
    volumeSlider.addClass("slider");
    volumeSlider.input(function () {
        streamElement.volume = easeInSine(volumeSlider.value());
    });
    playPauseButton = createImg('./assets/play-button.svg');
    playPauseButton.mousePressed(togglePlay);
    playPauseButton.addClass("playButton");
    muteButton = createImg('./assets/volume-button.svg');
    muteButton.mousePressed(toggleMute);
    muteButton.addClass("playButton");
}

function positionUI() {
    volumeSlider.position(width / 2, 4.4 * height / 5);
    volumeSlider.center("horizontal");
    //const ui_size = Math.max(width / 32, MIN_UI_SIZE);
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
    frameRate(60);
    streamElement = document.getElementById("stream");
    // instantiate UI
    initUI();
    positionUI();
    //prev = createFramebuffer();
    next = createFramebuffer();
    fft = new p5.FFT(0.8, 32);
    audio_started = false;
}

function draw() {
    background(255);
    if (audio_started && fft) {
        fft.analyze();
        prelevel = GAIN * fft.getEnergy(16, 16384);
    }
    z += 0.06 * prelevel
    level += 0.1 * (prelevel - level);

    if (mouseIsPressed) {
        ssao = false;
    } else {
        ssao = true;
    }

    // shader() sets the active shader with our shader
    next.begin();
    clear();
    // setUniform() sends values to the shader
    theShader.setUniform("u_resolution", [width, height]);
    theShader.setUniform("u_time", millis() / 1000.0);
    theShader.setUniform("u_mouse", [mouseX, map(mouseY, 0, height, height, 0)]);
    theShader.setUniform("u_z", z);
    theShader.setUniform("u_level", 2 * level);
    theShader.setUniform("u_ssao", ssao);
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
        streamElement.muted = false;
        audio_started = true;
    }
}

function togglePlay() {
    if (streamElement.paused) {
        streamElement.play();
        playPauseButton.elt.src = './assets/pause-button.svg';
    } else {
        streamElement.pause();
        playPauseButton.elt.src = './assets/play-button.svg';
    }
}

function toggleMute() {
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