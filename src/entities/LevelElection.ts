// modules
import {
  Entity,
  PrimaryGeneratedColumn,
  Column
} from "typeorm";

import { IsNotEmpty } from "class-validator";

@Entity()
export class LevelElection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  @IsNotEmpty()
  level: string;

}