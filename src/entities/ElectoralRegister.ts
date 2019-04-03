import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from "typeorm";
import { IsNumberString, Length, IsNotEmpty, IsInt, IsEmail } from "class-validator";
import { School } from "../entities/School";
import { Persona } from "../entities/Persona";
import { Faculty } from "../entities/Faculty";

@Entity()
export class ElectoralRegister {
  @PrimaryColumn()
  @ManyToOne(type => Persona, { cascade: true })
  @JoinColumn({ name: 'ci' })
  @IsNumberString()
  @Length(7, 8)
  @IsNotEmpty()
  ci: string;

  @Column()
  @ManyToOne(type => Faculty, { cascade: true })
  @JoinColumn({ name: 'facultyId' })
  @IsInt()
  @IsNotEmpty()
  facultyId: number;

  @Column()
  @ManyToOne(type => School, { cascade: true })
  @JoinColumn({ name: 'schoolId' })
  @IsInt()
  @IsNotEmpty()
  schoolId: number;

  @Column()
  @IsEmail()
  @IsNotEmpty()
  email: string

  @Column()
  @IsNotEmpty()
  electoralEventAddress: string
}