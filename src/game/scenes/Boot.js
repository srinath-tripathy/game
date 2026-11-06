import { Scene } from 'phaser';

export class Boot extends Scene
{
    constructor ()
    {
        super('Boot');
    }

    create ()
    {
        //  All art is generated in code, so there is nothing to load up front
        this.scene.start('Preloader');
    }
}
