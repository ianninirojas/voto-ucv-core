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
import { nemElection } from "../models/nemElection";
import { nemAccountService } from "../services/nem.account.service";

class VoterController {

  static prueba = async (req: Request, res: Response) => {
    const code = codeService.generateCode();
    const hash = bcrypt.hashSync(code);
    const token = jwt.sign(
      { identityDocument: '24276962', typeCode: 'auth', code },
      config.jwtSecret,
    );
  }

  static auth = async (req: Request, res: Response) => {
    const electoralEventPublickey = req.params.electoralEventPublickey
    const { identityDocument, code } = req.body.jwtPayload;
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
      console.log('error :', error);
      return res.status(404).send({ data: 'No está seleccionado para votar en este evento electoral' });
    }

    if (!elector.checkIfUnencryptedAuthCodeIsValid(code)) {
      return res.status(404).send({ data: 'No autenticado' });
    }

    if (!elector.accessCode) {
      const accessCode = codeService.generateCode();
      elector.accessCode = bcrypt.hashSync(accessCode);
      const tokenAccess = elector.generateToken('access', accessCode);
      const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublickey);
      const electoralEventTransaction = await nemElectoralEvent.exist(electoralEventPublicAccount);
      const electoralEvent = JSON.parse(electoralEventTransaction.message.payload).data
      const body = {
        tokenAccess,
        electoralEventName: electoralEvent.name,
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

    if (!(electoralEventPublickey)) {
      return res.status(404).send({ data: 'No tiene acceso, faltan datos' });
    }

    const { identityDocument, code } = req.body.jwtPayload;

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
      console.log('error :', error);
      return res.status(404).send({ data: 'No está seleccionado para votar en este evento electoral' });
    }

    if (!elector.checkIfUnencryptedAccessCodeIsValid(code)) {
      return res.status(404).send({ data: 'No tiene acceso' });
    }

    let data = {};
    if (!elector.password)
      data = { code: 1 }
    else
      data = { code: 0 }

    const token = elector.generateToken('login', code, '10m');
    res.setHeader('token', token)
    return res.status(200).send({ data });
  };

  static login = async (req: Request, res: Response) => {
    const electoralEventPublickey = req.params.electoralEventPublickey
    const { password } = req.body;

    if (!(electoralEventPublickey && password)) {
      return res.status(404).send({ data: 'No tiene acceso, faltan datos' });
    }

    const { identityDocument, code } = req.body.jwtPayload;

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
      console.log('error', error)
      return res.status(404).send({ data: 'No está seleccionado para votar en este evento electoral' });
    }

    const isItTimeToVote = await nemElectoralEvent.isItTimeToVote(electoralEventPublickey);
    if (!isItTimeToVote) {
      return res.status(404).send({ data: 'No se puede votar en el evento electoral' });
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
    const seed = { electoralEventPublickey, password, identityDocument, code }

    const voterAccount = nemVoter.getAccount(seed);

    const alreadyVoted = await nemVoter.alreadyVoted(voterAccount.publicAccount);
    if (alreadyVoted)
      return res.status(404).send({ data: 'Usted ya votó' });

    const token = elector.generateToken('vote', code, '10m');

    res.setHeader('token', token)
    const elections = await nemElection.getAll(electoralEventPublickey, elector.electionsIds.split(','))
    return res.status(200).send(elections);
  }

  static vote = async (req: Request, res: Response) => {
    req.setTimeout(0, () => { });
    console.log('Empezando controller');
    console.log(' ');
    
    const electoralEventPublickey = req.params.electoralEventPublickey
    const { candidates, password } = req.body;
    const { identityDocument, code } = req.body.jwtPayload;

    if (!(electoralEventPublickey && password)) {
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
      console.log('error :', error);
      return res.status(404).send({ data: 'No está seleccionado para votar en este evento electoral' });
    }

    if (!elector.checkIfUnencryptedPasswordIsValid(password)) {
      return res.status(404).send({ data: 'Contraseña no coincide con la registrada' });
    }

    const seed = { electoralEventPublickey, password, identityDocument, code }

    const voterAccount = nemVoter.getAccount(seed);

    try {
      const response = await nemVoter.vote(voterAccount, electoralEventPublickey, candidates);
      if (!response.voted) {
        return res.status(400).send({ data: response.data });
      }
      return res.status(200).send({ data: response.data });
    }
    catch (error) {
      console.log('error :', error);
      return res.status(400).send({ data: error });
    }
  }
}

export default VoterController;