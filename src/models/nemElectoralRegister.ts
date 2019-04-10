import {
  Mosaic,
  UInt64,
  TransferTransaction
} from 'nem2-sdk';

import * as bcrypt from "bcryptjs";

import { getRepository, In } from 'typeorm';

// models
import { nemElection } from '../models/nemElection';
import { nemElectoralEvent } from "../models/nemElectoralEvent";
import { nemElectoralCommission } from "../models/nemElectoralCommission";

// entities
import { Persona } from "../entities/Persona";
import { Profesor } from "../entities/Profesor";
import { EgresadoPregrado } from "../entities/EgresadoPregrado";
import { ElectoralRegister } from "../entities/ElectoralRegister";
import { EstudiantePregrado } from "../entities/EstudiantePregrado";

// services
import { codeService } from '../services/code.service';
import { emailService } from '../services/email.service';
import { apostilleService } from '../services/apostille.service';
import { nemAccountService } from "../services/nem.account.service";
import { nemTransactionService } from "../services/nem.transaction.service";

// Constans
import { CodeTypes } from "../constants/codeType";
import { TypeElector } from '../constants/typeElector';
import { LevelElectionEnum } from "../constants/levelElection";

const selectElectoralRegister = async (electoralEventPublickey: any) => {

  const elections = await nemElection.getAll(electoralEventPublickey);
  if (elections.length == 0)
    return { created: false, data: [{ electoralEvent: "evento electoral no tiene elecciones asociadas" }] }

  let schoolIds = {
    student: [],
    profesor: [],
    graduated: [],
  };

  let facultyIds = {
    student: [],
    profesor: [],
    graduated: [],
  };

  let typesElectors = {
    student: {
      participate: false,
      [LevelElectionEnum.university]: false,
      [LevelElectionEnum.faculty]: false,
      [LevelElectionEnum.school]: false,
    },
    profesor: {
      participate: false,
      [LevelElectionEnum.university]: false,
      [LevelElectionEnum.faculty]: false,
      [LevelElectionEnum.school]: false,
    },
    graduated: {
      participate: false,
      [LevelElectionEnum.university]: false,
      [LevelElectionEnum.faculty]: false,
      [LevelElectionEnum.school]: false,
    }
  };

  let checkParticipate = ((typesElectors: any, typeElector: string, levelElection: string) => {
    switch (typeElector) {
      case TypeElector.all:
        typesElectors['student']['participate'] = typesElectors['profesor']['participate'] = typesElectors['graduated']['participate'] = true;
        typesElectors['student'][levelElection] = typesElectors['profesor'][levelElection] = typesElectors['graduated'][levelElection] = true;
        break;
      case TypeElector.consolidated:
        typesElectors['student']['participate'] = typesElectors['profesor']['participate'] = true;
        typesElectors['student'][levelElection] = typesElectors['profesor'][levelElection] = true;
        break;
      case TypeElector.student:
        typesElectors['student']['participate'] = true;
        typesElectors['student'][levelElection] = true;
        break;
      case TypeElector.profesor:
        typesElectors['profesor']['participate'] = true;
        typesElectors['profesor'][levelElection] = true;
        break;
      case TypeElector.graduated:
        typesElectors['graduated']['participate'] = true;
        typesElectors['graduated'][levelElection] = true;
      default:
        break;
    }
    return typesElectors;
  })

  let fillFacultyId = ((typeElector: any, id, facultyIds) => {
    switch (typeElector) {
      case TypeElector.all:
        facultyIds['student'].push(id);
        facultyIds['profesor'].push(id);
        facultyIds['graduated'].push(id);
        break;
      case TypeElector.consolidated:
        facultyIds['student'].push(id);
        facultyIds['profesor'].push(id);
        break;
      case TypeElector.student:
        facultyIds['student'].push(id);
        break;
      case TypeElector.profesor:
        facultyIds['profesor'].push(id);
        break;
      case TypeElector.graduated:
        facultyIds['graduated'].push(id);
      default:
        break;
    }
    return facultyIds;
  })

  let fillSchoolIds = ((typeElector: any, id, schoolIds) => {
    switch (typeElector) {
      case TypeElector.all:
        schoolIds['student'].push(id);
        schoolIds['profesor'].push(id);
        schoolIds['graduated'].push(id);
        break;
      case TypeElector.consolidated:
        schoolIds['student'].push(id);
        schoolIds['profesor'].push(id);
        break;
      case TypeElector.student:
        schoolIds['student'].push(id);
        break;
      case TypeElector.profesor:
        schoolIds['profesor'].push(id);
        break;
      case TypeElector.graduated:
        schoolIds['graduated'].push(id);
      default:
        break;
    }
    return facultyIds;
  })

  for (const election of elections) {
    typesElectors = checkParticipate(typesElectors, election.typeElector, election.levelElection);

    if (election.levelElection === LevelElectionEnum.faculty) {
      fillFacultyId(election.typeElector, election.facultyId, facultyIds);
    }
    else if (election.levelElection === LevelElectionEnum.school) {
      fillSchoolIds(election.typeElector, election.schoolId, schoolIds);
    }
  }

  let whereStudent = [];
  let whereProfesor = [];
  let whereGraduated = [];

  let participants: any = [];

  if (typesElectors['student']['participate']) {
    if (typesElectors['student'][LevelElectionEnum.university]) {
      whereStudent.push({ codStatus: "000" });
    }
    if (typesElectors['student'][LevelElectionEnum.faculty]) {
      whereStudent.push({ codStatus: "000", idFacultad: In(facultyIds['student']) });
    }
    if (typesElectors['student'][LevelElectionEnum.school]) {
      whereStudent.push({ codStatus: "000", idEscuela: In(schoolIds['student']) });
    }
    const students = await getRepository(EstudiantePregrado).find({
      where: whereStudent
    });
    participants = participants.concat(students);
  }

  if (typesElectors['profesor']['participate']) {
    if (typesElectors['profesor'][LevelElectionEnum.university]) {
      whereStudent.push({ codStatus: "000" });
    }
    if (typesElectors['profesor'][LevelElectionEnum.faculty]) {
      whereStudent.push({ codStatus: "000", idFacultad: In(facultyIds['profesor']) });
    }
    if (typesElectors['profesor'][LevelElectionEnum.school]) {
      whereStudent.push({ codStatus: "000", idEscuela: In(schoolIds['profesor']) });
    }

    const profesors = await getRepository(Profesor).find({
      where: whereProfesor
    });
    participants = participants.concat(profesors);
  }

  if (typesElectors['graduated']['participate']) {
    if (typesElectors['graduated'][LevelElectionEnum.university]) {
      whereStudent.push({ codStatus: "000" });
    }
    if (typesElectors['graduated'][LevelElectionEnum.faculty]) {
      whereStudent.push({ codStatus: "000", idFacultad: In(facultyIds['graduated']) });
    }
    if (typesElectors['graduated'][LevelElectionEnum.school]) {
      whereStudent.push({ codStatus: "000", idEscuela: In(schoolIds['graduated']) });
    }

    const graduateds = await getRepository(EgresadoPregrado).find({
      where: whereGraduated
    });
    participants = participants.concat(graduateds);
  }

  let personas = participants.map((elector: any) => elector.ci);
  personas = await getRepository(Persona).find({
    where: { ci: In(personas) },
    order: { ci: "ASC" },
  });

  let electoralRegister: any = {};
  for (let i = 0; i < participants.length; i++) {
    const elector = participants[i];
    for (let j = 0; j < personas.length; j++) {
      const persona = personas[j];
      if (persona.ci === elector.ci) {
        personas.splice(j, 1);
        if (electoralRegister[elector.idFacultad] === undefined) {
          electoralRegister[elector.idFacultad] = [];
        }
        electoralRegister[elector.idFacultad].push({
          ci: elector.ci,
          facultyId: elector.idFacultad,
          schoolId: elector.idEscuela,
          email: persona.email,
          electoralEventPublickey: electoralEventPublickey,
        });
        break;
      }
    }
  }
  return { created: true, data: electoralRegister }
}

const sendAuthEmail = (elector: ElectoralRegister, authCode) => {

  const tokenAuth = elector.generateToken('authCode', authCode);

  const body = {
    tokenAuth,
    electoralEventPublickey: elector.electoralEventPublickey
  }

  emailService.send(elector.email, body, 'authentication');
}

const storeSQLElectoralRegister = async (electoralRegister: any) => {
  let electorsByFaculty = [];
  for (const facultyId in electoralRegister) {
    if (electoralRegister.hasOwnProperty(facultyId)) {
      const electoralRegisterByFaculty = electoralRegister[facultyId];
      for (const electorByFaculty of electoralRegisterByFaculty) {
        const elector = new ElectoralRegister();
        elector.ci = electorByFaculty.ci;
        elector.facultyId = electorByFaculty.facultyId;
        elector.schoolId = electorByFaculty.schoolId;
        elector.email = electorByFaculty.email;
        elector.electoralEventPublickey = electorByFaculty.electoralEventPublickey;

        const authCode = codeService.generateCode();
        elector.authCode = bcrypt.hashSync(authCode);
        electorsByFaculty.push(elector);

        sendAuthEmail(elector, authCode);
      }
    }
  }
  await getRepository(ElectoralRegister).save(electorsByFaculty)
}

export const nemElectoralRegister = {

  async storeElectoralRegister(electoralEventPublickey: any) {
    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublickey);

    const transactionElectoralEvent = await nemElectoralEvent.exist(electoralEventPublicAccount);
    if (!transactionElectoralEvent)
      return { created: false, data: [{ electoralRegister: "evento electoral no existe" }] }

    const transactionElectoralRegister = await this.exist(electoralEventPublickey);
    if (transactionElectoralRegister)
      return { created: false, data: [{ electoralRegister: "evento electoral ya posee registro electoral" }] }

    const response = await selectElectoralRegister(electoralEventPublickey);
    if (!response.created)
      return response;

    const electoralRegister = response.data;

    let hashesElectoralRegisterByFaculty = [];

    for (const facultyId in electoralRegister) {
      if (electoralRegister.hasOwnProperty(facultyId)) {
        const electoralRegisterByFaculty = electoralRegister[facultyId];
        const hashElectoralRegisterByFaculty = apostilleService.createHashApostille(JSON.stringify(electoralRegisterByFaculty))
        hashesElectoralRegisterByFaculty.push({ hashElectoralRegisterByFaculty, facultyId });
      }
    }
    const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
    const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);

    const electoralEventAddress = electoralEventPublicAccount.address;

    const mosaicsToValidateTransaction = [new Mosaic(nemElectoralCommission.getOfficialMosaicId(), UInt64.fromUint(1))];

    const message = JSON.stringify({
      code: CodeTypes.RegisterElectoralRegister,
      data: {
        hashesElectoralRegisterByFaculty: hashesElectoralRegisterByFaculty
      }
    });

    const electoralRegisterTransferTransaction = nemTransactionService.transferTransaction(electoralEventAddress, mosaicsToValidateTransaction, message);
    const electoralRegisterSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, electoralRegisterTransferTransaction);
    try {
      await nemTransactionService.announceTransaction(electoralRegisterSignedTransaction);
      await nemTransactionService.awaitTransactionConfirmed(electoralEventAddress, electoralRegisterSignedTransaction)
      await storeSQLElectoralRegister(electoralRegister);

      return { created: true, data: [{ electoralRegister: "registro electoral creado exitosamente" }] }

    } catch (error) {
      throw (error);
    }
  },

  exist(electoralEventPublickey: string) {
    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublickey);
    return nemTransactionService.searchTransaction(electoralEventPublicAccount, TransferTransaction, (transactionElectoralRegister: TransferTransaction): any => {
      const payload = JSON.parse(transactionElectoralRegister.message.payload);
      if (payload.code === CodeTypes.RegisterElectoralRegister) {
        if (nemElectoralCommission.validateTransaction(transactionElectoralRegister)) {
          return transactionElectoralRegister
        }
        else
          return false;
      }
      else {
        return false;
      }
    });
  },
}