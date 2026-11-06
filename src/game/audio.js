// Synthesised sound effects, so the game needs no audio files.
// The AudioContext is created lazily on the first pop (browsers require a user gesture).

let ctx = null;
let noise = null;
let muted = false;

export function setMuted (value)
{
    muted = value;
}

function getContext ()
{
    if (!ctx)
    {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;

        if (!AudioCtx)
        {
            return null;
        }

        ctx = new AudioCtx();

        //  A short burst of white noise is the "crackle" part of every pop
        noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.1), ctx.sampleRate);
        const data = noise.getChannelData(0);

        for (let i = 0; i < data.length; i++)
        {
            data[i] = Math.random() * 2 - 1;
        }
    }

    if (ctx.state === 'suspended')
    {
        ctx.resume();
    }

    return ctx;
}

function tone (ac, freqStart, freqEnd, duration, volume, delay = 0)
{
    const t = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + duration + 0.01);
}

export function playPop (pitch = 1)
{
    const ac = muted ? null : getContext();

    if (!ac)
    {
        return;
    }

    const t = ac.currentTime;
    const src = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();

    src.buffer = noise;
    filter.type = 'bandpass';
    filter.frequency.value = 1400 * pitch;
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(t);
    src.stop(t + 0.08);

    tone(ac, 260 * pitch, 70, 0.07, 0.35);
}

export function playThud ()
{
    const ac = muted ? null : getContext();

    if (ac)
    {
        tone(ac, 140, 50, 0.08, 0.4);
    }
}

export function playChime ()
{
    const ac = muted ? null : getContext();

    if (ac)
    {
        tone(ac, 880, 870, 0.25, 0.2);
        tone(ac, 1320, 1310, 0.3, 0.15, 0.06);
    }
}
