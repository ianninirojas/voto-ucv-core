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
  IsBoolean,
  IsNumberString,
} from "class-validator";

// entities
import { School } from '../entities/School';
import { Faculty } from '../entities/Faculty';
import { Persona } from '../entities/Persona';

@Entity()
export class Profesor {

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
  @IsNumberString()
  @Length(3, 3)
  codTipoPersonal: string

  @Column()
  @IsNumberString()
  @Length(4, 4)
  codCategoria: string

  @Column()
  @IsNumberString()
  @Length(3, 3)
  codStatus: string;

  @Column()
  @IsNumberString()
  @Length(3, 3)
  codDedicacion: string

  @Column()
  @IsNumberString()
  @Length(2, 2)
  codNomina: string

  @Column()
  @IsNumberString()
  @Length(6, 6)
  codCargo: string

  @Column()
  @IsNumberString()
  @Length(11, 11)
  codUnidad: string

  @Column('date')
  @IsDate()
  fechaIngreso: Date

  @Column('date')
  @IsDate()
  fechaAscenso: Date

  @Column()
  @IsNumberString()
  @Length(45, 45)
  nroOficio: string

  @Column('date')
  @IsDate()
  fechaInicioPermiso: Date

  @Column('date')
  @IsDate()
  fechaFinPermiso: Date

  @Column('date')
  @IsDate()
  fechaActualizacion: Date

  @Column()
  @IsBoolean()
  votaAu: boolean

  @Column()
  @IsBoolean()
  votaCU: boolean

  @Column()
  @IsBoolean()
  votaDe: boolean

  @Column()
  @IsBoolean()
  votaCF: boolean

  @Column()
  @IsBoolean()
  votaCE: boolean

  @Column()
  @IsInt()
  prioridad: number
}

















































