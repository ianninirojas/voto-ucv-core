import { Request, Response } from "express";
import { getRepository } from "typeorm";

import * as jwt from "jsonwebtoken";

import * as bcrypt from "bcryptjs";

import config from '../config/config';

import { ElectoralRegister } from "../entities/ElectoralRegister";
import { codeService } from "../services/code.service";
import { emailService } from "../services/email.service";
import { nemElectoralEvent } from "../models/nemElectoralEvent";
import { nemVoter } from "../models/nemVoter";

// 27562580
// e6b5fe033412c84d
// tokenAuth : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZGVudGl0eURvY3VtZW50IjoiMjc1NjI1ODAiLCJhdXRoQ29kZSI6ImU2YjVmZTAzMzQxMmM4NGQiLCJpYXQiOjE1NTUzNjgyNjUsImV4cCI6MTU1NTQ1NDY2NX0.SuPn7HczGDP37tB1FuAhHZnEtyF3LLlqvbNH_bMF3uw

// 39733171
// 03a9171dd2f38ee7
// tokenAuth : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZGVudGl0eURvY3VtZW50IjoiMzk3MzMxNzEiLCJhdXRoQ29kZSI6IjAzYTkxNzFkZDJmMzhlZTciLCJpYXQiOjE1NTUzNjgyNjUsImV4cCI6MTU1NTQ1NDY2NX0.LfPBGADdzgz2maVDH_LxZTaj0_X0gpDaIONRoS0Qhdc

// 42865291
// b0c7ac0dd7fbe5e6
// tokenAuth : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZGVudGl0eURvY3VtZW50IjoiNDI4NjUyOTEiLCJhdXRoQ29kZSI6ImIwYzdhYzBkZDdmYmU1ZTYiLCJpYXQiOjE1NTUzNjgyNjUsImV4cCI6MTU1NTQ1NDY2NX0.KmP03BN5fo5rlPpKP71Ksj6OZLdef58gJKyYORmat6k

// 22099912
// 939f6df564de3e9c
// tokenAuth : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZGVudGl0eURvY3VtZW50IjoiMjIwOTk5MTIiLCJhdXRoQ29kZSI6IjkzOWY2ZGY1NjRkZTNlOWMiLCJpYXQiOjE1NTUzNjgyNjUsImV4cCI6MTU1NTQ1NDY2NX0.ZqPwOgTJ9jLkrNIo8jxeUNSQflzXQwLlY0Hwqhk86eM

class VoterController {
  static auth = async (req: Request, res: Response) => {
    const electoralEventPublickey = req.params.electoralEventPublickey
    let { tokenAuth } = req.body;

    let jwtPayload;
    try {
      jwtPayload = <any>jwt.verify(tokenAuth, config.jwtSecret);
    }
    catch (error) {
      return res.status(404).send({ data: 'No autenticado, token no valido' });
    }

    const { identityDocument, authCode } = jwtPayload;

    if (!(electoralEventPublickey && identityDocument && authCode)) {
      return res.status(404).send({ data: 'No autenticado, faltan datos' });
    }

    const electoralRegisterRepository = getRepository(ElectoralRegister);
    let elector: ElectoralRegister;
    try {
      elector = await electoralRegisterRepository.findOneOrFail({
        where: {
          electoralEventPublickey: electoralEventPublickey,
          ci: identityDocument
        }
      });
    }
    catch (error) {
      return res.status(404).send({ data: 'No autenticado, no está seleccionado para votar en este evento electoral' });
    }

    if (!elector.checkIfUnencryptedAuthCodeIsValid(authCode)) {
      return res.status(404).send({ data: 'No autenticado' });
    }

    if (!elector.accessCode) {
      const accessCode = codeService.generateCode();
      elector.accessCode = bcrypt.hashSync(accessCode);
      const tokenAccess = elector.generateToken('accessCode', accessCode);
      const body = {
        tokenAccess,
        electoralEventPublickey: elector.electoralEventPublickey
      }
      electoralRegisterRepository.save(elector)
      const subject = 'Autorización Evento Electoral';
      emailService.send(elector.email, subject, body, 'authorization');
    }

    return res.status(200).send({ data: 'Autenticado' });
  };

  static access = async (req: Request, res: Response) => {
    const electoralEventPublickey = req.params.electoralEventPublickey
    let { tokenAccess } = req.body;
    let jwtPayload;

    try {
      jwtPayload = <any>jwt.verify(tokenAccess, config.jwtSecret);
    }
    catch (error) {
      return res.status(404).send({ data: 'No tiene acceso, token no valido' });
    }

    const { identityDocument, accessCode } = jwtPayload;

    if (!(electoralEventPublickey && identityDocument && accessCode)) {
      return res.status(404).send({ data: 'No tiene acceso, faltan datos' });
    }

    const electoralRegisterRepository = getRepository(ElectoralRegister);
    let elector: ElectoralRegister;
    try {
      elector = await electoralRegisterRepository.findOneOrFail({
        where: {
          electoralEventPublickey: electoralEventPublickey,
          ci: identityDocument
        }
      });
    }
    catch (error) {
      return res.status(404).send({ data: 'No tiene acceso, no está seleccionado para votar en este evento electoral' });
    }

    if (!elector.checkIfUnencryptedAccessCodeIsValid(accessCode)) {
      return res.status(404).send({ data: 'No tiene acceso' });
    }

    let data;
    if (!elector.password) {
      data = {
        message: 'Accesso',
        code: 1
      }
    }
    else {
      data = {
        message: 'Accesso',
        code: 0
      }
    }

    return res.status(200).send({ data });
  };

  static login = async (req: Request, res: Response) => {
    const tokenAccess = <string>req.headers["authorization"].split(' ')[1];
    let jwtPayload;
    try {
      jwtPayload = <any>jwt.verify(tokenAccess, config.jwtSecret);
    }
    catch (error) {
      return res.status(401).send();
    }

    const electoralEventPublickey = req.params.electoralEventPublickey
    const { password } = req.body;
    const { identityDocument, accessCode } = jwtPayload;

    if (!(electoralEventPublickey && identityDocument && accessCode && password)) {
      return res.status(404).send({ data: 'No tiene acceso, faltan datos' });
    }

    const electoralRegisterRepository = getRepository(ElectoralRegister);
    let elector: ElectoralRegister;

    try {
      elector = await electoralRegisterRepository.findOneOrFail({
        where: {
          electoralEventPublickey: electoralEventPublickey,
          ci: identityDocument
        }
      });
    }
    catch (error) {
      return res.status(404).send({ data: 'No está seleccionado para votar en este evento electoral' });
    }

    if (!elector.password) {
      elector.password = password;
      elector.hashPassword();
      electoralRegisterRepository.save(elector);
    }
    else {
      if (!elector.checkIfUnencryptedPasswordIsValid(password)) {
        return res.status(404).send({ data: 'Contraseña no coincide con la registrada' });
      }
    }

    const newToken = jwt.sign({ identityDocument, accessCode }, config.jwtSecret, {
      expiresIn: "4m"
    });

    res.setHeader('token', newToken)
    return res.status(200).send();
  }

  static vote = async (req: Request, res: Response) => {
    const tokenAccess = <string>req.headers["authorization"].split(' ')[1];
    let jwtPayload;
    try {
      jwtPayload = <any>jwt.verify(tokenAccess, config.jwtSecret);
    }
    catch (error) {
      return res.status(401).send();
    }

    const electoralEventPublickey = req.params.electoralEventPublickey
    const { elections, password } = req.body;
    const { identityDocument, accessCode } = jwtPayload;

    if (!(electoralEventPublickey && identityDocument && accessCode && password)) {
      return res.status(404).send({ data: 'No tiene acceso, faltan datos' });
    }

    const electoralRegisterRepository = getRepository(ElectoralRegister);
    let elector: ElectoralRegister;

    try {
      elector = await electoralRegisterRepository.findOneOrFail({
        where: {
          electoralEventPublickey: electoralEventPublickey,
          ci: identityDocument
        }
      });
    }
    catch (error) {
      return res.status(404).send({ data: 'No está seleccionado para votar en este evento electoral' });
    }

    if (!elector.checkIfUnencryptedPasswordIsValid(password)) {
      return res.status(404).send({ data: 'Contraseña no coincide con la registrada' });
    }

    const seed = { electoralEventPublickey, password, identityDocument, accessCode }

    const voterAccount = nemVoter.getAccount(seed);

    try {
      const response = await nemVoter.vote(voterAccount, electoralEventPublickey, elections);
      if (!response.voted) {
        return res.status(400).send({ data: response.data });
      }
      return res.status(200).send();
    }
    catch (error) {
      return res.status(400).send({ data: error });
    }
  }
}

export default VoterController;