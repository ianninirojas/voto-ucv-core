// modules

import {
  Entity,
  PrimaryColumn,
} from "typeorm";

@Entity()
export class ElectoralEvent {
  @PrimaryColumn()
  hash: string;

}