import { MapSchema, Schema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") username: string;
  @type("number") x: number;
  @type("number") y: number;
  @type("boolean") isAttacking: boolean = false;
  @type("number") attackCount: number = 0;
  inputQueue: Array<InputPayload> = [];
}

export interface InputPayload {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  attack: boolean;
}

export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}
