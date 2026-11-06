import { Boot } from './scenes/Boot';
import { HeartGame } from './scenes/HeartGame';
import * as Phaser from 'phaser';
import { Preloader } from './scenes/Preloader';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#16233f',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    //  Sound effects are synthesised in audio.js, so Phaser's sound system isn't needed
    audio: {
        noAudio: true
    },
    scene: [
        Boot,
        Preloader,
        HeartGame
    ]
};

const StartGame = (parent) => {

    return new Phaser.Game({ ...config, parent });

}

export default StartGame;
