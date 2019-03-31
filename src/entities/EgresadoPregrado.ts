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
  IsNumberString,
  IsBoolean,
  IsNotEmpty
} from "class-validator";

// entities
import { School } from '../entities/School';
import { Faculty } from '../entities/Faculty';
import { Persona } from '../entities/Persona';

@Entity()
export class EgresadoPregrado {
  @PrimaryColumn()
  @IsNumberString()
  @Length(7, 8)
  @IsNotEmpty()
  @OneToOne(type => Persona)
  @JoinColumn()
  ci: string;

  @Column()
  @IsInt()
  @IsNotEmpty()
  @OneToOne(type => Faculty)
  @JoinColumn()
  idFacultad: number;

  @Column()
  @IsInt()
  @IsNotEmpty()
  @OneToOne(type => School)
  @JoinColumn()
  idEscuela: number;

  @Column()
  @Length(3, 3)
  codTitulo: string

  @Column('date')
  @IsDate()
  fechaGrado: Date;

  @Column()
  @IsNumberString()
  @Length(3, 3)
  codStatus: string;

  @Column()
  @IsInt()
  prioridad: number;

  @Column('date')
  @IsDate()
  fechaIngreso: Date;

  @Column('date')
  @IsDate()
  fechaActualizacion: Date;

  @Column()
  @IsBoolean()
  votaEg: boolean;

  @Column()
  @IsBoolean()
  votaAu: boolean;

  @Column()
  @IsBoolean()
  votaDe: boolean;

}