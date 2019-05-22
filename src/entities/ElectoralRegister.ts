import { Entity, Column, ManyToOne, JoinColumn, Index, PrimaryGeneratedColumn } from "typeorm";

import { IsNumberString, Length, IsNotEmpty, IsInt } from "class-validator";

import * as jwt from "jsonwebtoken";

import * as bcrypt from "bcryptjs";

import { secrets } from "../config";

import { School } from "../entities/School";
import { Persona } from "../entities/Persona";
import { Faculty } from "../entities/Faculty";

@Entity()
@Index(['ci', 'electoralEventPublickey'], { unique: true })
export class ElectoralRegister {

  @PrimaryGeneratedColumn()
  id: number

  @Column()
  @ManyToOne(type => Persona)
  @JoinColumn({ name: 'ci' })
  @IsNumberString()
  @Length(7, 8)
  @IsNotEmpty()
  ci: string;

  @Column()
  @IsNotEmpty()
  electoralEventPublickey: string

  @Column({ nullable: true })
  authCode: string

  @Column({ nullable: true })
  accessCode: string

  @Column({ nullable: true })
  password: string

  generateToken(typeCode, code, expiresIn?) {
    let options = {};
    if (expiresIn) {
      options['expiresIn'] = expiresIn;
    }
    return jwt.sign(
      { identityDocument: this.ci, typeCode, code },
      secrets.jwtSecret,
      options,
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