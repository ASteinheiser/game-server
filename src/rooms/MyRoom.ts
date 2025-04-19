import { Room, Client } from "@colyseus/core";
import { MyRoomState, Player, InputPayload } from "./schema/MyRoomState";

// TODO: fix this. Currrent solution is basically mocking a DB
export const RESULTS: Array<{ username: string; attackCount: number }> = [];

export class MyRoom extends Room<MyRoomState> {
  maxClients = 4;
  state = new MyRoomState();
  elapsedTime = 0;
  fixedTimeStep = 1000 / 128;

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

    this.state.players.forEach((player) => {
      let input: undefined | InputPayload;
      // dequeue player inputs
      while (input = player.inputQueue.shift()) {
        if (input.left) {
          player.x -= velocity;
        } else if (input.right) {
          player.x += velocity;
        }
        if (input.up) {
          player.y -= velocity;
        } else if (input.down) {
          player.y += velocity;
        }

        player.isMoving = input.left || input.right || input.up || input.down;
        player.isAttacking = input.attack;

        if (input.attack) {
          player.attackCount++;

          const playerResult = RESULTS.find(result => result.username === player?.username);
          if (playerResult) playerResult.attackCount++;
        }
      }
    });
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

    RESULTS.push({ username, attackCount: 0 });
  }

  onLeave(client: Client, _: boolean) {
    const player = this.state.players.get(client.sessionId);

    console.log(`${player?.username} (${client.sessionId}) left!`);

    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");

    RESULTS.length = 0;
  }
}
