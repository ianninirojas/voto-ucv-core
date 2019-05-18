import {
  Mosaic,
  UInt64,
  TransferTransaction
} from 'nem2-sdk';

import * as bcrypt from "bcryptjs";

import { getRepository, In, getConnection } from 'typeorm';

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
    participants = participants.concat(students.map(student => { student['type'] = TypeElector.student; return student }));
  }

  if (typesElectors['profesor']['participate']) {
    if (typesElectors['profesor'][LevelElectionEnum.university]) {
      whereProfesor.push({ codStatus: "000" });
    }
    if (typesElectors['profesor'][LevelElectionEnum.faculty]) {
      whereProfesor.push({ codStatus: "000", idFacultad: In(facultyIds['profesor']) });
    }
    if (typesElectors['profesor'][LevelElectionEnum.school]) {
      whereProfesor.push({ codStatus: "000", idEscuela: In(schoolIds['profesor']) });
    }
    const profesors = await getRepository(Profesor).find({
      where: whereProfesor
    });
    participants = participants.concat(profesors.map(profesor => { profesor['type'] = TypeElector.profesor; return profesor }));
  }

  if (typesElectors['graduated']['participate']) {
    if (typesElectors['graduated'][LevelElectionEnum.university]) {
      whereGraduated.push({ codStatus: "000" });
    }
    if (typesElectors['graduated'][LevelElectionEnum.faculty]) {
      whereGraduated.push({ codStatus: "000", idFacultad: In(facultyIds['graduated']) });
    }
    if (typesElectors['graduated'][LevelElectionEnum.school]) {
      whereGraduated.push({ codStatus: "000", idEscuela: In(schoolIds['graduated']) });
    }
    const graduateds = await getRepository(EgresadoPregrado).find({
      where: whereGraduated
    });
    participants = participants.concat(graduateds.map(graduated => { graduated['type'] = TypeElector.graduated; return graduated }));
  }

  let electoralRegister: any[] = [];
  for (let i = 0; i < participants.length; i++) {
    const elector = participants[i];
    let electionsIds = [];
    for (const election of elections) {
      if (election.levelElection === LevelElectionEnum.university ||
        (election.typeElector === elector.type && (parseInt(election.facultyId) === parseInt(elector.idFacultad) || parseInt(election.schoolId) === parseInt(elector.idEscuela))) ||
        (election.typeElector === TypeElector.consolidated && (parseInt(election.facultyId) === parseInt(elector.idFacultad) || parseInt(election.schoolId) === parseInt(elector.idEscuela)) && (elector.type === TypeElector.student || elector.type === TypeElector.profesor))) {
        electionsIds.push(election.id);
      }
    }
    electoralRegister.push({
      ci: elector.ci,
      facultyId: elector.idFacultad,
      schoolId: elector.idEscuela,
      type: elector.type,
      electionsIds: electionsIds.toString(),
      electoralEventPublickey: electoralEventPublickey,
    });
  }

  electoralRegister.sort((a, b) => {
    return parseInt(a["ci"]) - parseInt(b["ci"]) || a["facultyId"] - b["facultyId"] || a["schoolId"] - b["schoolId"];
  });

  return { created: true, data: electoralRegister }
}

const storeSQLElectoralRegister = async (electoralRegister: any, electoralEvent: any) => {
  let electors = []
  for (const x of electoralRegister) {
    const elector = new ElectoralRegister();
    elector.ci = x.ci;
    elector.facultyId = x.facultyId;
    elector.schoolId = x.schoolId;
    elector.type = x.type;
    elector.electionsIds = x.electionsIds;
    elector.electoralEventPublickey = x.electoralEventPublickey;
    electors.push(elector);
  }

  await getRepository(ElectoralRegister).save(electors)
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

    const electoralRegisterHash = apostilleService.createHashApostille(JSON.stringify(electoralRegister))

    const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
    const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);

    const electoralEventAddress = electoralEventPublicAccount.address;

    const message = JSON.stringify({
      code: CodeTypes.RegisterElectoralRegister,
      data: electoralRegisterHash
    });
    const electoralRegisterTransferTransaction = nemTransactionService.transferTransaction(electoralEventAddress, [], message);
    const electoralRegisterSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, electoralRegisterTransferTransaction);
    try {
      await nemTransactionService.announceTransactionAsync(electoralEventAddress, electoralRegisterSignedTransaction)
      const electoralEvent = JSON.parse(transactionElectoralEvent.message.payload).data
      await storeSQLElectoralRegister(electoralRegister, electoralEvent);

      return { created: true, data: [{ electoralRegister: "registro electoral creado exitosamente" }] }

    } catch (error) {
      console.log('error :', error);
      throw (error);
    }
  },

  async validateElectoralRegister(electoralEventPublickey: string) {
    const transactionElectoralRegister = await this.exist(electoralEventPublickey);
    if (!transactionElectoralRegister)
      return { validated: false, data: { electoralRegister: "evento electoral no posee registro electoral" } }

    const nemElectoralRegisterHash = JSON.parse(transactionElectoralRegister.message.payload).data;
    const electoralRegisterRepository = getRepository(ElectoralRegister);
    let electoralRegister = await electoralRegisterRepository.find({
      where: {
        electoralEventPublickey
      },
      select: [
        'ci',
        'facultyId',
        'schoolId',
        'type',
        'electionsIds',
        'electoralEventPublickey',
      ]
    });

    let electoralRegisterToHash = electoralRegister.map(elector => (
      {
        ci: elector.ci,
        facultyId: elector.facultyId,
        schoolId: elector.schoolId,
        type: elector.type,
        electionsIds: elector.electionsIds,
        electoralEventPublickey: elector.electoralEventPublickey,
      }
    ))

    electoralRegisterToHash.sort((a, b) => {
      return parseInt(a["ci"]) - parseInt(b["ci"]) || a["facultyId"] - b["facultyId"] || a["schoolId"] - b["schoolId"];
    });

    const electoralRegisterHash = apostilleService.createHashApostille(JSON.stringify(electoralRegisterToHash));

    return nemElectoralRegisterHash === electoralRegisterHash;
  },

  async sendAuthEmail(to: string, tokenAuth: string, electoralEvent: any) {

    const subject = `Autenticación: ${electoralEvent.name}`;

    const body = {
      tokenAuth,
      electoralEventPublickey: electoralEvent.publickey,
      electoralEventName: electoralEvent.name
    }

    emailService.send(to, subject, body, 'authentication');
  },

  async activateElectoralRegister(electoralEventPublickey: string) {
    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublickey);
    const validateElectoralRegister = await this.validateElectoralRegister(electoralEventPublickey);

    if (!validateElectoralRegister) {
      return { validated: false, data: { electoralRegister: "Registro electoral no válido" } }
    }

    const transactionElectoralEvent = await nemElectoralEvent.exist(electoralEventPublicAccount);

    const electoralEvent = JSON.parse(transactionElectoralEvent.message.payload).data
    electoralEvent['publickey'] = electoralEventPublickey;
    let electors = [];

    const electoralRegisterRepository = getRepository(ElectoralRegister);
    let electoralRegister = await electoralRegisterRepository.find({ where: { electoralEventPublickey } });
    for (const elector of electoralRegister) {
      const person = await getRepository(Persona).findOne({ where: { ci: elector.ci } });
      const authCode = codeService.generateCode();
      elector.authCode = bcrypt.hashSync(authCode);
      electors.push(elector);
      const tokenAuth = elector.generateToken('auth', authCode);
      this.sendAuthEmail(person.email, tokenAuth, electoralEvent);
    }
    await getRepository(ElectoralRegister).save(electors);

    return { validated: true, data: { electoralRegister: "Registro electoral válido" } }
  },

  async getElectoralRegister(electoralEventPublickey: string) {
    const validateElectoralRegister = await this.validateElectoralRegister(electoralEventPublickey);
    if (!validateElectoralRegister) {
      return { valid: false, data: 'Registro Electoral no es válido' };
    }

    const electoralRegister = await getConnection().query(`
      SELECT electoral_register.ci, electoral_register.facultyId, electoral_register.schoolId, electoral_register.type, persona.nombre1, persona.apellido1, persona.inicialNombre2, persona.inicialApellido2
      FROM electoral_register, persona
      WHERE electoral_register.electoralEventPublickey='${electoralEventPublickey}' AND electoral_register.ci=persona.ci;
    `)

    electoralRegister.sort((a, b) => {
      return a["apellido1"].localeCompare(b['apellido1']) || parseInt(a["ci"]) - parseInt(b["ci"]) || a["facultyId"] - b["facultyId"] || a["schoolId"] - b["schoolId"]
    });

    return { valid: true, data: electoralRegister };
  },

  exist(electoralEventPublickey: string) {
    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublickey);
    return nemTransactionService.searchTransaction(electoralEventPublicAccount, TransferTransaction, (transactionElectoralRegister: TransferTransaction): any => {
      const payload = JSON.parse(transactionElectoralRegister.message.payload);
      if (payload.code === CodeTypes.RegisterElectoralRegister) {
        if (nemElectoralCommission.validateTransaction(transactionElectoralRegister)) {
          return transactionElectoralRegister
        }
      }
    });
  },
}