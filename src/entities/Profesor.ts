// modules
import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryColumn
} from "typeorm";


import {
  Length,
  IsInt,
  IsNotEmpty,
  IsNumberString,
} from "class-validator";

// entities
import { School } from '../entities/School';
import { Faculty } from '../entities/Faculty';
import { Persona } from '../entities/Persona';

@Entity()
export class Profesor {
  @PrimaryColumn()
  @ManyToOne(type => Persona, { cascade: true })
  @JoinColumn({ name: 'ci' })
  @IsNumberString()
  @Length(7, 8)
  @IsNotEmpty()
  ci: string;

  @Column()
  @ManyToOne(type => Faculty, { cascade: true })
  @JoinColumn({ name: 'idFacultad' })
  @IsInt()
  @IsNotEmpty()
  idFacultad: number;

  @Column()
  @ManyToOne(type => School, { cascade: true })
  @JoinColumn({ name: 'idEscuela' })
  @IsInt()
  @IsNotEmpty()
  idEscuela: number;

  @Column()
  @IsNumberString()
  @Length(3, 3)
  codStatus: string;
}

















































