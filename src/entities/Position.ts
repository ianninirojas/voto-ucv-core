// modules

import {
  Entity,
  PrimaryGeneratedColumn,
  Column
} from "typeorm";

import {
  IsString,
  IsNotEmpty
} from "class-validator";

@Entity()
export class Position {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ unique: true })
  @IsString()
  @IsNotEmpty()
  name: string
}