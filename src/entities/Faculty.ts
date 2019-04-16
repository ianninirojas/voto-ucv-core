// modules
import {
  Entity,
  PrimaryGeneratedColumn,
  Column
} from "typeorm";

import { IsNumberString } from "class-validator";

@Entity()
export class Faculty {
  @PrimaryGeneratedColumn()
  id: number

  @Column({unique:true})
  name: string

  @Column({unique:true})
  @IsNumberString()
  code: string
}