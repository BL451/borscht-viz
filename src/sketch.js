let theShader, prev, next;
let z = 0;
let ssao = true;
let level = 0;
let prelevel = 0;
const GAIN = 0.004;
var fft, mediaSource, audio_started;

function preload() {
    theShader = loadShader('./src/shaders/blob/vert.glsl', './src/shaders/blob/frag.glsl');
}

function setup() {
    // disables scaling for retina screens which can create inconsistent scaling between displays
    pixelDensity(1);
    let cnv = createCanvas(windowWidth, windowHeight, WEBGL);
    prev = createFramebuffer();
    next = createFramebuffer();
    fft = new p5.FFT(0.8, 32);
    audio_started = false;
    frameRate(60);
    initAudio();
}

function draw() {
    if (audio_started && fft) {
        fft.analyze();
        prelevel = GAIN * fft.getEnergy(16, 16384);
    }
    z += 0.05 * prelevel
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
    image(next, -width / 2, -height / 2);
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

function mousePressed() {
    initAudio();
}

function touchStarted() {
    initAudio();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}