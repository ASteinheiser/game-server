import { Room, Client } from "@colyseus/core";
import { MyRoomState, Player, InputPayload } from "./schema/MyRoomState";

// TODO: fix this. Currrent solution is basically mocking a DB
export const RESULTS: Record<string, { username: string; attackCount: number }> = {};

// TODO: always send attack input, then serverside track the cooldown

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

    this.state.players.forEach((player, sessionId) => {
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

        player.isAttacking = input.attack;

        if (input.attack) {
          player.attackCount++;

          RESULTS[sessionId].attackCount++;
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
