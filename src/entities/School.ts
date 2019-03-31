// modules

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from "typeorm";

import {
  IsNumberString,
  IsInt,
  IsNotEmpty
} from "class-validator";

import { Faculty } from "../entities/Faculty";

@Entity()
export class School {
  @PrimaryGeneratedColumn()
  id: number

  @Column({unique:true})
  @IsNotEmpty()
  name: string

  @Column({unique:true})
  @IsNumberString()
  @IsNotEmpty()
  code: string

  @Column()
  @IsInt()
  @OneToOne(type => Faculty)
  @JoinColumn()
  @IsNotEmpty()
  facultyId: number;

}