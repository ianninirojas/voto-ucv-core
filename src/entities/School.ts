// modules

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  ManyToOne,
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

  @Column({ unique: true })
  @IsNotEmpty()
  name: string

  @Column({ unique: true })
  @IsNumberString()
  @IsNotEmpty()
  code: string

  @Column()
  @ManyToOne(type => Faculty, { cascade: true })
  @JoinColumn({ name: 'facultyId' })
  @IsInt()
  @IsNotEmpty()
  facultyId: number;

}