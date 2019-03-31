import { Entity, PrimaryGeneratedColumn, Column, PrimaryColumn, OneToOne, JoinColumn } from "typeorm";
import { IsNumberString, Length, IsNotEmpty, IsInt, IsEmail } from "class-validator";
import { School } from "../entities/School";
import { Persona } from "../entities/Persona";
import { Faculty } from "../entities/Faculty";

@Entity()
export class ElectoralRegister {
  @PrimaryGeneratedColumn()
  id: number

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
  facultyId: number;

  @Column()
  @IsInt()
  @IsNotEmpty()
  @OneToOne(type => School)
  @JoinColumn()
  schoolId: number;

  @Column()
  @IsEmail()
  @IsNotEmpty()
  email: string

  @Column()
  @IsNotEmpty()
  electoralEventAddress: string
}