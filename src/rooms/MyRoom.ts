import { Room, Client } from "@colyseus/core";
import { nanoid } from 'nanoid';
import { MyRoomState, Player, InputPayload, Enemy } from "./schema/MyRoomState";

// TODO: fix this. Currrent solution is basically mocking a DB
export const RESULTS: Record<string, { username: string; attackCount: number }> = {};

// attack animation takes 0.625 seconds total (5 frames at 8fps)
const ATTACK_COOLDOWN = 625;
// attack damage frame is at .375 seconds (frame 3 / 5)
const ATTACK_DAMAGE_DELAY = 375;
// time it takes for one frame in the attack animation (8fps)
const ATTACK_FRAME_TIME = 125;
const ATTACK_DAMAGE_END = ATTACK_DAMAGE_DELAY + ATTACK_FRAME_TIME;

// TODO: refactor this stuff
const PLAYER_WIDTH = 47;
const ATTACK_WIDTH = 6;
const ATTACK_HEIGHT = 8;
// offset from the center of the player to the center of the fist,
// which is at the edge of the player's bounding box
const ATTACK_OFFSET_X = (PLAYER_WIDTH / 2) - (ATTACK_WIDTH / 2);
// magic number, this is how high the fist is above the center of the player
const ATTACK_OFFSET_Y = 12.5;

// handles how fast enemies spawn
const ENEMY_SPAWN_RATE = 2000;
const MAX_ENEMIES = 10;

export class MyRoom extends Room<MyRoomState> {
  maxClients = 4;
  state = new MyRoomState();
  elapsedTime = 0;
  fixedTimeStep = 1000 / 128;
  lastEnemySpawnTime = 0;

  onCreate (_: any) {
    this.onMessage('playerInput', (client, payload: InputPayload) => {
      const player = this.state.players.get(client.sessionId);

      player.inputQueue.push(payload);
    });

    this.setSimulationInterval((deltaTime) => {
      this.elapsedTime += deltaTime;

      while (this.elapsedTime >= this.fixedTimeStep) {
        this.elapsedTime -= this.fixedTimeStep;
        this.fixedTick(this.fixedTimeStep);
      }
    });
  }

  fixedTick(_: number) {
    const velocity = 2;

    this.state.players.forEach((player, sessionId) => {
      let input: undefined | InputPayload;
      // dequeue player inputs
      while (input = player.inputQueue.shift()) {
        if (input.left) player.isFacingRight = false;
        else if (input.right) player.isFacingRight = true;

        player.x += input.left ? -velocity : input.right ? velocity : 0;
        player.y += input.up ? -velocity : input.down ? velocity : 0;

        // Check if enough time has passed since last attack
        const currentTime = Date.now();
        const timeSinceLastAttack = currentTime - player.lastAttackTime;
        const canAttack = timeSinceLastAttack >= ATTACK_COOLDOWN;

        // find the damage frames in the attack animation
        if (timeSinceLastAttack >= ATTACK_DAMAGE_DELAY && timeSinceLastAttack < ATTACK_DAMAGE_END) {
          // calculate the damage frame
          player.attackDamageFrameX = player.isFacingRight ? player.x + ATTACK_OFFSET_X : player.x - ATTACK_OFFSET_X;
          player.attackDamageFrameY = player.y - ATTACK_OFFSET_Y;
        } else {
          player.attackDamageFrameX = undefined;
          player.attackDamageFrameY = undefined;
        }

        // if the player is mid-attack, don't process any more inputs
        if (!canAttack) {
          return;
        } else if (input.attack) {
          player.isAttacking = true;
          player.attackCount++;
          player.lastAttackTime = currentTime;
          RESULTS[sessionId].attackCount++;
        } else {
          player.isAttacking = false;
        }
      }
    });

    const canSpawn = Date.now() >= (this.lastEnemySpawnTime + ENEMY_SPAWN_RATE);

    if (this.state.enemies.length < MAX_ENEMIES && canSpawn) {
      this.lastEnemySpawnTime = Date.now();

      const enemy = new Enemy();
      enemy.id = nanoid();
      enemy.x = Math.random() * 1024;
      enemy.y = Math.random() * 768;

      this.state.enemies.push(enemy);
    }
  }

  onJoin(client: Client, options: any) {
    const username = options.username ?? `random-user-${Math.floor(Math.random() * 10000)}`;

    console.log(`${username} (${client.sessionId}) joined!`);

    const mapWidth = 1024;
    const mapHeight = 768;
    const player = new Player();

    player.username = username;
    player.x = (Math.random() * mapWidth);
    player.y = (Math.random() * mapHeight);

    // place player in the map of players by its sessionId
    // (client.sessionId is unique per connection!)
    this.state.players.set(client.sessionId, player);

    RESULTS[client.sessionId] = { username, attackCount: 0 };
  }

  onLeave(client: Client, _: boolean) {
    const player = this.state.players.get(client.sessionId);

    console.log(`${player?.username} (${client.sessionId}) left!`);

    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");

    Object.keys(RESULTS).forEach((sessionId) => {
      delete RESULTS[sessionId];
    });
  }
}
