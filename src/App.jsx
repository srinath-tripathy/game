import { useRef, useState } from 'react';

import { PhaserGame } from './PhaserGame';
import { setMuted } from './game/audio';

function App ()
{
    //  References to the PhaserGame component (game and scene are exposed)
    const phaserRef = useRef();
    const [muted, setMutedState] = useState(false);

    const toggleSound = () => {

        setMuted(!muted);
        setMutedState(!muted);

    }

    return (
        <div id="app">
            <PhaserGame ref={phaserRef} />
            <div className="controls">
                <button className="button" onClick={toggleSound}>{muted ? 'Sound: Off' : 'Sound: On'}</button>
            </div>
        </div>
    )
}

export default App
