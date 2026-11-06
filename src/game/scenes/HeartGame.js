import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { playChime, playPop, playThud, unlockAudio } from '../audio';
import { getChallenge, shareResult } from '../share';
import { addButton, TEXT_STYLE } from '../ui';

//  Catch My Heart - a game for couples
//  Move the basket with the arrow keys (or mouse / finger).
//  Before each round the player picks how long it lasts (30 seconds unless they change it),
//  then tries to catch as many hearts as they can. Catching a bad character takes hearts away.

const DEFAULT_TIME = 30;
const MIN_TIME = 10;
const MAX_TIME = 120;
const TIME_STEP = 10;

//  How many hearts each item is worth (negative = it takes hearts away)
const ITEMS = {
    'heart': 1,
    'gold-heart': 3,
    'broken-heart': -2,
    'cloud': -1,
    'devil': -3
};

//  Every time something drops, we pick one name from this bag at random.
//  Names that appear more often drop more often.
const DROP_BAG = [
    'heart', 'heart', 'heart', 'heart', 'heart', 'heart',
    'gold-heart',
    'broken-heart', 'broken-heart',
    'cloud', 'cloud',
    'devil'
];

export class HeartGame extends Scene
{
    constructor ()
    {
        super('HeartGame');
    }

    create ()
    {
        //  1. Starting values - these reset every time the scene starts
        this.hearts = 0;
        this.isPlaying = false;     //  false while choosing the time, and after time's up
        this.items = [];            //  everything that is currently falling
        this.floatPool = {};        //  reusable "+1" / "-2" labels, see floatText()

        //  If the page was opened from a partner's link, this holds their name, score and round time
        this.challenge = getChallenge();

        //  Round length: a partner's challenge uses their time so scores are fair,
        //  otherwise start from the last time picked (30 seconds the first time)
        this.roundTime = this.challenge ? this.challenge.time : (this.registry.get('roundTime') || DEFAULT_TIME);
        this.timeLeft = this.roundTime;

        //  2. Background: pink sky and grass
        this.cameras.main.setBackgroundColor(0xffd6e7);
        this.add.rectangle(512, 748, 1024, 40, 0x7bc67b);

        this.makeTextures();

        //  3. The player's basket
        this.basket = this.add.image(512, 690, 'love-basket');

        //  4. Controls: arrow keys, or move the mouse / drag a finger
        this.cursors = this.input.keyboard.createCursorKeys();

        this.input.on('pointermove', (pointer) => {
            this.basket.x = pointer.x;
        });

        //  5. Hearts, timer and target display
        this.heartsText = this.add.text(30, 20, '', { ...TEXT_STYLE, fontSize: 36 });
        this.timeText = this.add.text(994, 20, '', { ...TEXT_STYLE, fontSize: 36 }).setOrigin(1, 0);

        if (this.challenge)
        {
            this.add.text(512, 28, `Beat ${this.challenge.name}: ${this.challenge.hearts}`, {
                ...TEXT_STYLE, fontSize: 28, color: '#ff6f91'
            }).setOrigin(0.5, 0);
        }

        this.updateText();

        //  6. Ask how long to play before starting
        this.showTimePicker();

        EventBus.emit('current-scene-ready', this);
    }

    //  The setup screen: pick the round length with - / + (or the arrow keys), then press START
    showTimePicker ()
    {
        const locked = Boolean(this.challenge);
        const picker = [];

        picker.push(this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.45));

        picker.push(this.add.text(512, 150, 'CATCH MY HEART', { ...TEXT_STYLE, fontSize: 64, color: '#ff9eb5' }));

        const question = locked
            ? `${this.challenge.name} caught ${this.challenge.hearts} hearts in ${this.roundTime} seconds.\nYou get the same time. Can you beat it?`
            : 'How long do you want to play?';

        picker.push(this.add.text(512, 255, question, { ...TEXT_STYLE, fontSize: 30 }));

        const timeLabel = this.add.text(512, 375, '', { ...TEXT_STYLE, fontSize: 56, color: '#ffc94d' });
        const showTime = () => timeLabel.setText(`${this.roundTime} sec`);
        picker.push(timeLabel);
        showTime();

        const changeTime = (step) => {
            this.roundTime = Math.max(MIN_TIME, Math.min(MAX_TIME, this.roundTime + step));
            this.timeLeft = this.roundTime;
            showTime();
            this.updateText();
            playPop();
        };

        const buttons = [];
        let started = false;

        if (!locked)
        {
            buttons.push(
                addButton(this, 312, 375, 'button-round', '-', () => changeTime(-TIME_STEP)),
                addButton(this, 712, 375, 'button-round', '+', () => changeTime(TIME_STEP))
            );

            this.input.keyboard.on('keydown-LEFT', () => !started && changeTime(-TIME_STEP));
            this.input.keyboard.on('keydown-RIGHT', () => !started && changeTime(TIME_STEP));
        }

        const start = () => {
            //  START, ENTER and SPACE can all fire this, but a round only starts once
            if (started)
            {
                return;
            }

            started = true;
            //  Start the sound engine now, while the player is tapping, not mid-game
            unlockAudio();

            picker.forEach((object) => object.destroy());
            buttons.forEach(({ button, text }) => {
                button.destroy();
                text.destroy();
            });

            this.startRound();
        };

        buttons.push(addButton(this, 512, 520, 'button', 'START', start));

        picker.push(this.add.text(512, 620, locked ? 'Press ENTER or tap START' : 'Arrow keys change the time, ENTER starts', {
            ...TEXT_STYLE, fontSize: 22, strokeThickness: 5
        }));

        this.input.keyboard.once('keydown-ENTER', start);
        this.input.keyboard.once('keydown-SPACE', start);

        picker.forEach((object) => object.setOrigin(0.5).setDepth(10));
        buttons.forEach(({ button, text }) => {
            button.setDepth(11);
            text.setDepth(12);
        });
    }

    startRound ()
    {
        //  Remember the choice so PLAY AGAIN starts from the same time
        if (!this.challenge)
        {
            this.registry.set('roundTime', this.roundTime);
        }

        this.timeLeft = this.roundTime;
        this.isPlaying = true;
        this.updateText();

        //  Drop something new every 0.6 seconds
        this.dropTimer = this.time.addEvent({
            delay: 600,
            loop: true,
            callback: () => this.dropItem()
        });
    }

    //  update() runs every frame (about 60 times a second).
    //  delta is how many milliseconds have passed since the last frame.
    update (time, delta)
    {
        if (!this.isPlaying)
        {
            return;
        }

        const seconds = delta / 1000;

        //  Count the timer down
        this.timeLeft -= seconds;

        if (this.timeLeft <= 0)
        {
            this.gameOver();
            return;
        }

        this.updateText();

        //  Move the basket with the arrow keys
        if (this.cursors.left.isDown)
        {
            this.basket.x -= 500 * seconds;
        }

        if (this.cursors.right.isDown)
        {
            this.basket.x += 500 * seconds;
        }

        //  Keep the basket on the screen
        this.basket.x = Math.max(60, Math.min(964, this.basket.x));

        //  Things fall faster as time runs out: 200 px/s at the start, 440 px/s at the end
        const fallSpeed = 200 + (1 - this.timeLeft / this.roundTime) * 240;

        //  We loop over a copy ([...this.items]) because items get removed inside the loop
        for (const item of [...this.items])
        {
            item.y += fallSpeed * seconds;

            if (this.isCaught(item))
            {
                this.catchItem(item);
            }
            else if (item.y > 768)
            {
                this.removeItem(item);      //  missed - no penalty
            }
        }
    }

    dropItem ()
    {
        const x = 40 + Math.random() * 944;
        const name = DROP_BAG[Math.floor(Math.random() * DROP_BAG.length)];

        const item = this.add.image(x, -30, name);
        item.points = ITEMS[name];          //  remember what this item is worth

        this.items.push(item);
    }

    //  An item is caught when it is close to the top of the basket
    isCaught (item)
    {
        const closeSideways = Math.abs(item.x - this.basket.x) < 60;
        const closeVertically = item.y > this.basket.y - 40 && item.y < this.basket.y + 10;

        return closeSideways && closeVertically;
    }

    catchItem (item)
    {
        this.removeItem(item);

        //  Hearts can't go below zero
        this.hearts = Math.max(0, this.hearts + item.points);

        if (item.points > 0)
        {
            this.floatText(item.x, item.y, `+${item.points}`, '#ff6f91');
            this.tweens.add({ targets: this.basket, scaleY: 0.8, duration: 80, yoyo: true });

            if (item.points > 1)
            {
                playChime();
            }
            else
            {
                playPop();
            }
        }
        else
        {
            this.floatText(item.x, item.y, `${item.points}`, '#6a4c93');
            this.cameras.main.shake(200, 0.01);
            playThud();
        }

        this.updateText();
    }

    removeItem (item)
    {
        this.items = this.items.filter((other) => other !== item);
        item.destroy();
    }

    updateText ()
    {
        this.heartsText.setText(`Hearts: ${this.hearts}`);
        this.timeText.setText(`Time: ${Math.ceil(this.timeLeft)}`);
    }

    //  Making a new text is slow on phones (Phaser measures and draws it from scratch),
    //  so each "+1" / "-2" label is made once and then reused
    floatText (x, y, message, color)
    {
        const pool = this.floatPool[message] || (this.floatPool[message] = []);
        let text = pool.find((other) => !other.visible);

        if (!text)
        {
            text = this.add.text(0, 0, message, { ...TEXT_STYLE, fontSize: 32, color, strokeThickness: 6 }).setOrigin(0.5);
            pool.push(text);
        }

        text.setPosition(x, y - 30).setAlpha(1).setVisible(true);

        this.tweens.add({
            targets: text, y: y - 100, alpha: 0, duration: 700,
            onComplete: () => text.setVisible(false)
        });
    }

    gameOver ()
    {
        this.isPlaying = false;
        this.timeLeft = 0;
        this.updateText();
        this.dropTimer.remove();

        //  Clear away anything still falling
        this.items.forEach((item) => item.destroy());
        this.items = [];

        //  Darken the screen behind the results
        this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.45).setDepth(10);

        const results = [
            this.add.text(512, 170, "TIME'S UP!", { ...TEXT_STYLE, fontSize: 64 }),
            this.add.text(512, 260, `You caught ${this.hearts} hearts in ${this.roundTime} sec`, { ...TEXT_STYLE, fontSize: 44, color: '#ff9eb5' })
        ];

        //  Compare with the partner's score, if we came from their link
        if (this.challenge)
        {
            results.push(this.add.text(512, 330, this.compareText(), { ...TEXT_STYLE, fontSize: 32, color: '#ffc94d' }));
        }

        results.forEach((text) => text.setOrigin(0.5).setDepth(11));

        const status = this.add.text(512, 735, '', { ...TEXT_STYLE, fontSize: 24 }).setOrigin(0.5).setDepth(11);

        const buttons = [
            addButton(this, 512, 480, 'button', 'SHARE', () => this.share(status)),
            addButton(this, 512, 590, 'button', 'PLAY AGAIN', () => this.scene.restart())
        ];

        buttons.forEach(({ button, text }) => {
            button.setDepth(11);
            text.setDepth(12);
        });
    }

    compareText ()
    {
        const { name, hearts } = this.challenge;

        if (this.hearts > hearts)
        {
            return `You beat ${name} (${hearts})!`;
        }

        if (this.hearts < hearts)
        {
            return `${name} wins with ${hearts}. Try again!`;
        }

        return `A tie with ${name}. Perfect match!`;
    }

    async share (status)
    {
        //  Ask for a name once, then remember it in the game's registry
        let name = this.registry.get('playerName');

        if (!name)
        {
            name = (window.prompt('Your name, so your partner knows who sent it:') || '').trim().slice(0, 20);

            if (!name)
            {
                return;
            }

            this.registry.set('playerName', name);
        }

        status.setText(await shareResult(name, this.hearts, this.roundTime));
    }

    //  Draw every picture with shapes, then save them as images
    makeTextures ()
    {
        //  Textures stay around after a restart, so only make them once
        if (this.textures.exists('love-basket'))
        {
            return;
        }

        const g = this.add.graphics();

        //  Basket: pink box with a lighter rim and a white heart on the front
        g.fillStyle(0xff6f91);
        g.fillRoundedRect(0, 10, 120, 40, 10);
        g.fillStyle(0xffa3b8);
        g.fillRoundedRect(0, 0, 120, 16, 8);
        g.fillStyle(0xffffff);
        g.fillCircle(55, 30, 6);
        g.fillCircle(65, 30, 6);
        g.fillTriangle(49, 32, 71, 32, 60, 44);
        g.generateTexture('love-basket', 120, 50);
        g.clear();

        //  Heart
        this.drawHeart(g, 0xff3b6b);
        g.generateTexture('heart', 48, 48);
        g.clear();

        //  Golden heart, with a white shine
        this.drawHeart(g, 0xffc107);
        g.fillStyle(0xffffff, 0.7);
        g.fillCircle(12, 11, 4);
        g.generateTexture('gold-heart', 48, 48);
        g.clear();

        //  Broken heart: a purple heart with a crack drawn in the sky color
        this.drawHeart(g, 0x6a4c93);
        g.lineStyle(4, 0xffd6e7);
        g.lineBetween(24, 4, 18, 16);
        g.lineBetween(18, 16, 28, 26);
        g.lineBetween(28, 26, 22, 42);
        g.generateTexture('broken-heart', 48, 48);
        g.clear();

        //  Storm cloud: grey bumps with blue rain
        g.fillStyle(0x707b8c);
        g.fillCircle(14, 22, 10);
        g.fillCircle(26, 16, 13);
        g.fillCircle(36, 22, 10);
        g.fillRect(14, 22, 22, 10);
        g.lineStyle(3, 0x4a90e2);
        g.lineBetween(16, 36, 13, 45);
        g.lineBetween(26, 36, 23, 45);
        g.lineBetween(36, 36, 33, 45);
        g.generateTexture('cloud', 48, 48);
        g.clear();

        //  Little devil: red face, horns, white eyes, a grin
        g.fillStyle(0x7a1f1f);
        g.fillTriangle(8, 16, 13, 1, 20, 12);
        g.fillTriangle(28, 12, 35, 1, 40, 16);
        g.fillStyle(0xd63031);
        g.fillCircle(24, 28, 17);
        g.fillStyle(0xffffff);
        g.fillCircle(18, 24, 4);
        g.fillCircle(30, 24, 4);
        g.lineStyle(3, 0x7a1f1f);
        g.lineBetween(15, 34, 24, 38);
        g.lineBetween(24, 38, 33, 34);
        g.generateTexture('devil', 48, 48);

        g.destroy();
    }

    //  A heart is two circles on top of a triangle
    drawHeart (g, color)
    {
        g.fillStyle(color);
        g.fillCircle(14, 15, 12);
        g.fillCircle(34, 15, 12);
        g.fillTriangle(3, 20, 45, 20, 24, 42);
    }
}
