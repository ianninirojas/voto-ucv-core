// modules

import { Request, Response } from "express";
import { getRepository, getConnection } from "typeorm";
import * as bcrypt from "bcryptjs";

// entities

import { Persona } from "../entities/Persona";
import { ElectoralEvent } from "../entities/ElectoralEvent";
import { ElectoralRegister } from "../entities/ElectoralRegister";

// models

import { nemElectoralEvent } from "../models/nemElectoralEvent";
import { nemElectoralRegister } from "../models/nemElectoralRegister";

// services 

import { nemAccountService } from '../services/nem.account.service';
import { validate } from "class-validator";
import { codeService } from "../services/code.service";

// others

class ElectoralEventController {

  static getAll = async (req: Request, res: Response) => {
    const electoralEventRepository = getRepository(ElectoralEvent);
    // buscar registros mas recientes
    try {
      let electoralEventsHash = await electoralEventRepository.find({
        // skip: req.body.index,
        // take: 10
      });
      const electoralEvents = await nemElectoralEvent.getAll(electoralEventsHash);

      res.status(200).send(electoralEvents);

    } catch (error) {
      console.log('error :', error.response.text);
      return res.status(500).send({ data: error.response.text });
    }
  }

  static get = async (req: Request, res: Response) => {
    const electoralEventPublicKey = req.params.publickey;
    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublicKey);
    const electoralEventTransaction = await nemElectoralEvent.exist(electoralEventPublicAccount);
    if (!electoralEventTransaction) {
      return res.status(400).send({ data: "Evento Electoral no existe" });
    }
    const electoralEvent = JSON.parse(electoralEventTransaction.message.payload).data;

    const activePromise = nemElectoralEvent.getMosaicVote(electoralEventPublicAccount);
    const finishedPromise = nemElectoralEvent.finished(electoralEventPublicAccount);
    await Promise.all([activePromise, finishedPromise])
      .then(([active, finished]) => {
        electoralEvent.active = active ? true : false;
        electoralEvent.finished = finished ? true : false;
        return res.status(200).send(electoralEvent);
      });
  }

  static create = async (req: Request, res: Response) => {
    const electoralEventData = req.body;
    try {
      const response = await nemElectoralEvent.create(electoralEventData);

      if (!response.created) {
        return res.status(400).send({ data: response.data });
      }

      const hash = response.data.electoralEventHashTransaction;
      let electoralEvent = new ElectoralEvent();
      electoralEvent.hash = hash;
      const electoralEventRepository = getRepository(ElectoralEvent);
      await electoralEventRepository.save(electoralEvent);

      return res.status(200).send({ data: "Electoral event successfully created" });
    }
    catch (error) {
      console.log(error);
      return res.status(500).send({ data: error });
    }
  }

  static registerHash = async (req: Request, res: Response) => {
    const electoralEventPublicKey = req.params.publickey

    try {
      const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublicKey);
      const transactionElectoralEvent = await nemElectoralEvent.exist(electoralEventPublicAccount);

      if (!transactionElectoralEvent) {
        return res.status(400).send({ data: "evento electoral no existe" });
      }

      const hash = transactionElectoralEvent.transactionInfo.hash;
      let electoralEvent = new ElectoralEvent();
      electoralEvent.hash = hash;
      const electoralEventRepository = getRepository(ElectoralEvent);
      await electoralEventRepository.save(electoralEvent);

      return res.status(200).send({ data: "Electoral event hash successfully register" });

    } catch (error) {
      console.log('error :', error);
      return res.status(400).send({ data: error });
    }
  }

  static activate = async (req: Request, res: Response) => {
    const electoralEventPublicKey = req.params.publickey
    try {
      const response = await nemElectoralEvent.activate(electoralEventPublicKey);
      if (!response.activated) {
        return res.status(400).send({ data: response.data });
      }
      return res.status(200).send({ data: response.data });
    }
    catch (error) {
      console.log('error :', error);
      return res.status(400).send({ data: error });
    }
  }

  static finish = async (req: Request, res: Response) => {
    const electoralEventPublicKey = req.params.publickey;
    try {
      const response = await nemElectoralEvent.finish(electoralEventPublicKey);
      if (!response.finished) {
        return res.status(400).send({ data: response.data });
      }
      return res.status(200).send({ data: response.data });
    }
    catch (error) {
      console.log('error :', error);
      return res.status(400).send({ data: error });
    }
  }

  static createElectoralRegister = async (req: Request, res: Response) => {
    const electoralEventPublicKey = req.params.publickey;
    try {
      const response = await nemElectoralRegister.storeElectoralRegister(electoralEventPublicKey);
      if (!response.created) {
        return res.status(400).send({ data: response.data });
      }
      return res.status(200).send({ data: response.data });
    }
    catch (error) {
      console.log('error :', error);
      return res.status(400).send({ data: error });
    }
  }

  static getElectoralRegister = async (req: Request, res: Response) => {
    const electoralEventPublicKey = req.params.publickey;
    try {
      const response = await nemElectoralRegister.getElectoralRegister(electoralEventPublicKey);
      if (!response.valid) {
        return res.status(400).send({ data: response.data });
      }
      return res.status(200).send(response.data);
    }
    catch (error) {
      console.log('error :', error);
      return res.status(400).send({ data: error });
    }
  }

  static getElector = async (req: Request, res: Response) => {
    const electoralEventPublickey = req.params.publickey;
    const electorId = req.params.electorId;

    try {
      const elector = await getConnection().query(`
        SELECT electoral_register.ci, electoral_register.password, persona.nombre1, persona.apellido1, persona.nombre2, persona.apellido2, persona.email
        FROM electoral_register, persona
        WHERE electoral_register.electoralEventPublickey='${electoralEventPublickey}' AND electoral_register.ci=persona.ci AND persona.ci='${electorId}';
    `);
      elector[0]['password'] = elector[0]['password'] ? true : false;

      return res.status(200).send({ elector: elector[0] });
    }
    catch (error) {
      console.log('error :', error);
      return res.status(400).send({ data: error });
    }
  }

  static updateElector = async (req: Request, res: Response) => {
    const electoralEventPublickey = req.params.publickey;
    const personaId = req.params.electorId;
    const { email } = req.body;

    const personRepository = getRepository(Persona);
    let person;
    try {
      person = await personRepository.findOneOrFail(personaId);
    } catch (error) {
      return res.status(404).send({ data: "Persona no encontrada" });
    }

    if (email !== undefined)
      person.email = email;

    const errors = await validate(person);
    if (errors.length > 0) {
      return res.status(400).send({ data: errors });
    }

    try {
      await personRepository.save(person);
    } catch (e) {
      return res.status(409).send({ data: "correo ya está utilizado" });
    }
    
    const electoralRegisterRepository = getRepository(ElectoralRegister);
    let elector;
    try {
      elector = await getRepository(ElectoralRegister).findOne({ where: { ci: personaId, electoralEventPublickey } });
    } catch (error) {
      return res.status(404).send({ data: "Elector no encontrado" });
    }
    const authCode = codeService.generateCode();
    elector.authCode = bcrypt.hashSync(authCode);
    elector.accessCode = null;

    try {
      electoralRegisterRepository.save(elector);
    } catch (e) {
      return res.status(409).send({ data: "correo ya está utilizado" });
    }

    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublickey);
    const electoralEventTransaction = await nemElectoralEvent.exist(electoralEventPublicAccount);
    if (!electoralEventTransaction) {
      return res.status(400).send({ data: "Evento Electoral no existe" });
    }
    const electoralEvent = JSON.parse(electoralEventTransaction.message.payload).data;
    electoralEvent['publickey'] = electoralEventPublickey;
    const tokenAuth = elector.generateToken('auth', authCode);
    nemElectoralRegister.sendAuthEmail(email, tokenAuth, electoralEvent);
    
    res.status(204).send();
  }


}

export default ElectoralEventController;