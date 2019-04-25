// modules

import {
  Entity,
  PrimaryColumn,
  Column,
  Unique
} from "typeorm";

import {
  IsNumberString,
  Length,
  IsString,
  IsEnum,
  IsEmail,
  IsPhoneNumber,
  IsDate
} from "class-validator";

export enum Sexo {
  MALE = "M",
  FEMALE = "F",
}

@Entity()
@Unique(['email'])
export class Persona {
  @PrimaryColumn()
  @IsNumberString()
  @Length(7, 8)
  ci: string

  @Column()
  @IsString()
  nombre1: string

  @Column()
  @IsString()
  nombre2: string

  @Column()
  @IsString()
  apellido1: string

  @Column()
  @IsString()
  apellido2: string

  @Column()
  @IsString()
  @Length(3, 3)
  inicialNombre2: string

  @Column()
  @IsString()
  @Length(3, 3)
  inicialApellido2: string

  @Column()
  @IsString()
  alias: string

  @Column()
  @IsEnum(Sexo)
  sexo: Sexo

  @Column()
  @IsEmail()
  email: string

  @Column()
  @IsPhoneNumber('VE')
  telefono: string

}