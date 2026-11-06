import { Scene } from 'phaser';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    create ()
    {
        //  Bake every texture the game uses from Graphics, so no image assets are needed
        this.makeButton('button', 280, 84, 0xffc94d);
        this.makeButton('button-round', 84, 84, 0xffc94d);

        this.scene.start('HeartGame');
    }

    makeButton (key, width, height, color)
    {
        const g = this.add.graphics();

        g.fillStyle(0x000000, 0.25);
        g.fillRoundedRect(0, 6, width, height - 6, 20);
        g.fillStyle(color, 1);
        g.fillRoundedRect(0, 0, width, height - 6, 20);
        g.fillStyle(0xffffff, 0.3);
        g.fillRoundedRect(10, 6, width - 20, 14, 7);

        g.generateTexture(key, width, height);
        g.destroy();
    }
}
