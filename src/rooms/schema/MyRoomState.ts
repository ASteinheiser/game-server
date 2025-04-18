import { MapSchema, Schema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("number") x: number;
  @type("number") y: number;
  inputQueue: Array<MovementPayload> = [];
}

export interface MovementPayload {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}
