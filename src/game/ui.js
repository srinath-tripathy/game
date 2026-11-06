export const TEXT_STYLE = {
    fontFamily: 'Arial Black', color: '#ffffff',
    stroke: '#16233f', strokeThickness: 8,
    align: 'center'
};

export function addButton (scene, x, y, texture, label, onClick)
{
    const button = scene.add.image(x, y, texture).setInteractive({ useHandCursor: true });
    const text = scene.add.text(x, y - 3, label, {
        ...TEXT_STYLE, fontSize: texture === 'button' ? 34 : 26, color: '#16233f', strokeThickness: 0
    }).setOrigin(0.5);

    button.on('pointerover', () => button.setScale(1.05));
    button.on('pointerout', () => button.setScale(1));
    button.on('pointerup', onClick);

    return { button, text };
}
