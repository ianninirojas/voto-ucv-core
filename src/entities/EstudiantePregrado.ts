// modules
import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  PrimaryColumn
} from "typeorm";

import {
  Length,
  IsInt,
  IsDate,
  IsNumberString
} from "class-validator";

// entities
import { School } from '../entities/School';
import { Faculty } from '../entities/Faculty';
import { Persona } from '../entities/Persona';

@Entity()
export class EstudiantePregrado {
  @PrimaryColumn()
  @IsNumberString()
  @Length(7, 8)
  @OneToOne(type => Persona)
  @JoinColumn()
  ci: string;

  @Column()
  @IsInt()
  @OneToOne(type => Faculty)
  @JoinColumn()
  idFacultad: number;

  @Column()
  @IsInt()
  @OneToOne(type => School)
  @JoinColumn()
  idEscuela: number;

  @Column()
  @IsInt()
  credAprob: number;

  @Column()
  @IsInt()
  credInscr: number;

  @Column()
  @IsInt()
  prioridad: number;

  @Column()
  @IsNumberString()
  @Length(3, 3)
  codStatus: string;

  @Column('date')
  @IsDate()
  fechaIngreso: Date;

  @Column('date')
  @IsDate()
  fechaActualizacion: Date;
}