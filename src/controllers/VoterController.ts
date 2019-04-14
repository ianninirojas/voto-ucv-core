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
import { triggerAsyncId } from "async_hooks";

// CI:      : 10509480
// authCode : 4fb12d9e9c4dcda3
// encryp   : $2a$10$YV6DMnEctbpI2B6EbLEqAerhtkLlcTuijB6sqM.l71eyDnuHLyOj6

// CI:      : 22159058
// authCode : ba57d90264f272eb
// encryp   : $2a$10$MAsvQbBlDTYKeEqMYkkLueJGc6d8fapprcs4QIIYAndLkPbjitIHK

// CI:      : 24114892
// authCode : d93becb9c6581f24
// encryp   : $2a$10$u8aMJuwkl3iHQhAOziaxPOSsoOAvrm4V8eaxHOKdzSDaf11ksDwm2

// CI:          : 44407478
// authCode     : d9ebd4395a20a49a
// EauthCode    : $2a$10$5sXSRdE8hRO5yxQFOIsAOetQ5rUpIsZUzhpBGZSYm/MUy5Zd4acCO
// tokenAuth    : iOjE1NTQ1ODA1ODR9.sE7B4EmYL0wN6SN_35G05P8jg0vfUxRF_hxpZBv-aXM
// http://localhost:3003/eventos-electorales/C07F2D2B289AA22C45D2881F0096257AE766588081EA3DE19DEDE192338AFA3E/autenticacion/iOjE1NTQ1ODA1ODR9.sE7B4EmYL0wN6SN_35G05P8jg0vfUxRF_hxpZBv-aXM
// accessCode   : f2791cbc27fed6f5
// EaccessCode  : $2a$10$1MRotHBB/Md3/NTsnAvtj.6iRuaatf/tMOXK2m/Qoae0nMH3SzY/O
// tokenAccess    : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZGVudGl0eURvY3VtZW50Ijo0NDQwNzQ3OCwiYWNjZXNzQ29kZSI6ImYyNzkxY2JjMjdmZWQ2ZjUiLCJpYXQiOjE1NTQ2NTAzNjYsImV4cCI6MTU1NDkwOTU2Nn0.t3mjpZHFRvYpEo8q5uRnyeLnIKkGsQiVr7Dertktz-I

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
      emailService.send(elector.email, body, 'authorization');
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