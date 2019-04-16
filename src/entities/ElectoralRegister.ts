import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, Index, PrimaryGeneratedColumn } from "typeorm";

import { IsNumberString, Length, IsNotEmpty, IsInt, IsEmail } from "class-validator";

import * as jwt from "jsonwebtoken";

import * as bcrypt from "bcryptjs";

import config from "../config/config";

import { School } from "../entities/School";
import { Persona } from "../entities/Persona";
import { Faculty } from "../entities/Faculty";

@Entity()
@Index(['ci', 'electoralEventPublickey'], { unique: true })
export class ElectoralRegister {

  @PrimaryGeneratedColumn()
  id: number

  @Column()
  @ManyToOne(type => Persona, { cascade: true })
  @JoinColumn({ name: 'ci' })
  @IsNumberString()
  @Length(7, 8)
  @IsNotEmpty()
  ci: string;

  @Column()
  @IsNotEmpty()
  electoralEventPublickey: string

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
  type: string

  @Column()
  @IsNotEmpty()
  authCode: string

  @Column()
  accessCode: string

  @Column()
  password: string

  generateToken(typeCode, code) {
    return jwt.sign(
      { identityDocument: this.ci, [typeCode]: code },
      config.jwtSecret,
      { expiresIn: "24h" }
    );
  }

  checkIfUnencryptedAuthCodeIsValid(authCode) {
    return bcrypt.compareSync(authCode, this.authCode);
  }

  checkIfUnencryptedAccessCodeIsValid(accessCode) {
    return bcrypt.compareSync(accessCode, this.accessCode);
  }

  checkIfUnencryptedPasswordIsValid(unencryptedPassword: string) {
    return bcrypt.compareSync(unencryptedPassword, this.password);
  }
  
  hashPassword() {
    this.password = bcrypt.hashSync(this.password);
  }

}