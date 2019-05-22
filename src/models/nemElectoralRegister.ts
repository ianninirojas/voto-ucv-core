import {
  Mosaic,
  UInt64,
  TransferTransaction,
  AggregateTransaction,
  PublicAccount,
  PlainMessage
} from 'nem2-sdk';

import * as bcrypt from "bcryptjs";
import moment from 'moment'

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
import { Candidate } from '../interfaces/Candidate';
import { create } from 'domain';

const select = async (electoralEventPublickey: any) => {

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

const storeSQL = async (electoralRegister: any, electoralEvent: any) => {
  let electors = []
  for (const x of electoralRegister) {
    const elector = new ElectoralRegister();
    elector.ci = x.ci;
    elector.electoralEventPublickey = x.electoralEventPublickey;
    electors.push(elector);
  }

  await getRepository(ElectoralRegister).save(electors)
}

const getTransactions = (electoralRegisterPublicAccount: PublicAccount) => {
  return nemTransactionService.searchTransactions(electoralRegisterPublicAccount, AggregateTransaction,
    (electoralRegisterTransaction: AggregateTransaction): any => {
      if (nemElectoralCommission.validateTransaction(electoralRegisterTransaction)) {
        const electors = [];
        for (const innerTransaction of electoralRegisterTransaction.innerTransactions) {
          if (innerTransaction instanceof TransferTransaction) {
            const payload = JSON.parse(innerTransaction.message.payload);
            if (payload.code === CodeTypes.CreateElector) {
              const elector = payload.data;
              electors.push(elector);
            }
          }
        }
        return electors;
      }
    });
}

export const nemElectoralRegister = {

  async create(electoralEventPublickey: string) {
    try {

      const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublickey);

      const transactionElectoralEvent = await nemElectoralEvent.exist(electoralEventPublicAccount);
      if (!transactionElectoralEvent)
        return { created: false, data: "evento electoral no existe" }

      const electoralEvent = JSON.parse(transactionElectoralEvent.message.payload).data;

      const dateFormat: string = "DD-MM-YYYY H:mm";
      const today = moment();

      const startDateCreateElectoralRegister = moment(electoralEvent.startDateCreateElectoralRegister, dateFormat);
      const endDateCreateElectoralRegister = moment(electoralEvent.endDateCreateElectoralRegister, dateFormat);

      // if (startDateCreateElectoralRegister.isAfter(today))
      //   return { created: false, data: "no ha iniciado el proceso de creación de registro electoral" }

      // if (endDateCreateElectoralRegister.isBefore(today))
      //   return { created: false, data: "ya finalizó el proceso de creación de registro electoral" }

      const elections = await nemElection.getAll(electoralEventPublickey);
      if (elections.length == 0)
        return { created: false, data: "evento electoral no tiene elecciones asociadas" }

      const transactionElectoralRegister = await this.exist(electoralEventPublickey);
      if (transactionElectoralRegister)
        return { created: false, data: "evento electoral ya posee registro electoral" }

      const response = await select(electoralEventPublickey);
      if (!response.created)
        return response;

      const electoralRegister = response.data;

      const electoralCommissionPrivateKey = nemElectoralCommission.getElectoralCommissionPrivateKey()
      const electoralCommissionAccount = nemAccountService.getAccountFromPrivateKey(electoralCommissionPrivateKey);

      const electoralRegisterPublicAccount = nemAccountService.getDeterministicPublicAccount(`${electoralEventPublickey} - Registro Electoral`.toLowerCase());

      const validElectorsPromise = [];
      for (const elector of electoralRegister) {
        validElectorsPromise.push(nemElectoralRegister.validateElector(electoralRegisterPublicAccount.publicKey, elector.ci));
      }

      const validElectors = await Promise.all(validElectorsPromise);
      for (let i = 0; i < validElectors.length; i++) {
        const validElector = validElectors[i];
        for (let j = 0; j < electoralRegister.length; j++) {
          const elector = electoralRegister[j];
          if (elector.ci === validElector.identityDocument) {
            electoralRegister.splice(j, 1);
          }
        }
      }

      const electorsNotIncluded = [...electoralRegister];

      const electoralRegisterCreateAggregateTransactionPromise = [];

      const registerElectorTransactions = [];

      for (let index = 0; index < electorsNotIncluded.length; index++) {
        const elector = electorsNotIncluded[index];
        const message = JSON.stringify({
          code: CodeTypes.CreateElector,
          data: {
            identityDocument: elector.ci,
            facultyId: elector.facultyId,
            schoolId: elector.schoolId,
            type: elector.type,
            electionsIds: elector.electionsIds
          }
        });
        const registerElectorTransaction = nemTransactionService.transferTransaction(electoralRegisterPublicAccount.address, [], PlainMessage.create(message)).toAggregate(electoralCommissionAccount.publicAccount);
        registerElectorTransactions.push(registerElectorTransaction);
      }

      const innerTransactions = [...registerElectorTransactions]
      const electoralRegisterCreateAggregateTransaction = nemTransactionService.aggregateTransaction(innerTransactions, []);
      const electoralRegisterCreateSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, electoralRegisterCreateAggregateTransaction);
      electoralRegisterCreateAggregateTransactionPromise.push(nemTransactionService.announceTransactionAsync(electoralRegisterPublicAccount.address, electoralRegisterCreateSignedTransaction));

      await Promise.all(electoralRegisterCreateAggregateTransactionPromise);

      let message = JSON.stringify({
        code: CodeTypes.CreateElectoralRegister,
      });

      const electionCreateTransferTransaction = nemTransactionService.transferTransaction(electoralEventPublicAccount.address, [], PlainMessage.create(message));
      const electionCreateSignedTransaction = nemTransactionService.signTransaction(electoralCommissionAccount, electionCreateTransferTransaction);
      await nemTransactionService.announceTransactionAsync(electoralEventPublicAccount.address, electionCreateSignedTransaction);

      await storeSQL(electorsNotIncluded, electoralEvent);

      return { created: true, data: "registro electoral creado exitosamente" }

    }
    catch (error) {
      throw error;
    }
  },

  async activate(electoralEventPublickey: string) {
    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublickey);

    const transactionElectoralEvent = await nemElectoralEvent.exist(electoralEventPublicAccount);
    const electoralEvent = JSON.parse(transactionElectoralEvent.message.payload).data

    electoralEvent['publickey'] = electoralEventPublickey;

    const electoralRegisterPublicAccount = nemAccountService.getDeterministicPublicAccount(`${electoralEventPublickey} - Registro Electoral`.toLowerCase());

    let electoralRegister = await getTransactions(electoralRegisterPublicAccount);

    electoralRegister = electoralRegister.reduce((acc, val) => acc.concat(val), []);
    let electors = [];
    for (let i = 0; i < electoralRegister.length; i++) {
      let elector = electoralRegister[i];
      const person = await getRepository(Persona).findOne({ where: { ci: elector.identityDocument } });
      elector = await getRepository(ElectoralRegister).findOne({ where: { electoralEventPublickey, ci: elector.identityDocument } });
      const authCode = codeService.generateCode();
      elector.authCode = bcrypt.hashSync(authCode);
      electors.push(elector);
      const tokenAuth = elector.generateToken('auth', authCode);
      this.sendAuthEmail(person.email, tokenAuth, electoralEvent);
    }
    await getRepository(ElectoralRegister).save(electors);

    return { validated: true, data: { electoralRegister: "Registro electoral válido" } }
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

  async get(electoralEventPublickey: string) {

    const electoralRegisterPublicAccount = nemAccountService.getDeterministicPublicAccount(`${electoralEventPublickey} - Registro Electoral`.toLowerCase());

    let electoralRegister = await getTransactions(electoralRegisterPublicAccount);

    electoralRegister = electoralRegister.reduce((acc, val) => acc.concat(val), []);

    for (let i = 0; i < electoralRegister.length; i++) {
      const elector = electoralRegister[i];
      const person = await getRepository(Persona).findOne({ where: { ci: elector.identityDocument } });
      electoralRegister[i]['nombre1'] = person.nombre1
      electoralRegister[i]['apellido1'] = person.apellido1
      electoralRegister[i]['inicialNombre2'] = person.inicialNombre2
      electoralRegister[i]['inicialApellido2'] = person.inicialApellido2
    }

    electoralRegister.sort((a, b) => {
      return a["apellido1"].localeCompare(b['apellido1']) || parseInt(a["ci"]) - parseInt(b["ci"]) || a["facultyId"] - b["facultyId"] || a["schoolId"] - b["schoolId"]
    });

    return { valid: true, data: electoralRegister };
  },

  validateElector(electoralRegisterPublickey: string, identityDocument: string, type?: string) {
    const electoralRegisterPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralRegisterPublickey);
    return nemTransactionService.searchTransaction(electoralRegisterPublicAccount, AggregateTransaction,
      (electoralRegisterAggregateTransaction: AggregateTransaction): any => {
        for (const electoralRegisterTransaction of electoralRegisterAggregateTransaction.innerTransactions) {
          if (electoralRegisterTransaction instanceof TransferTransaction) {
            const payload = JSON.parse(electoralRegisterTransaction.message.payload);
            const elector = payload.data
            if (payload.code === CodeTypes.CreateElector) {
              if (nemElectoralCommission.validateTransaction(electoralRegisterTransaction)) {
                if (elector.identityDocument === identityDocument) {
                  if (type === undefined) {
                    return elector
                  }
                  else if (TypeElector.all === type && (elector.type === TypeElector.student || elector.type === TypeElector.profesor || elector.type === TypeElector.graduated)) {
                    return elector
                  }
                  else if (TypeElector.consolidated === type && (elector.type === TypeElector.student || elector.type === TypeElector.profesor)) {
                    return elector
                  }
                  else if (TypeElector.student === type && elector.type === TypeElector.student) {
                    return elector
                  }
                  else if (TypeElector.profesor === type && elector.type === TypeElector.profesor) {
                    return elector
                  }
                  else if (TypeElector.graduated === type && elector.type === TypeElector.graduated) {
                    return elector
                  }
                }
              }
            }
          }
        }
      });
  },

  exist(electoralEventPublickey: string) {
    const electoralEventPublicAccount = nemAccountService.getPublicAccountFromPublicKey(electoralEventPublickey);
    return nemTransactionService.searchTransaction(electoralEventPublicAccount, TransferTransaction, (transactionElectoralRegister: TransferTransaction): any => {
      const payload = JSON.parse(transactionElectoralRegister.message.payload);
      if (payload.code === CodeTypes.CreateElectoralRegister) {
        if (nemElectoralCommission.validateTransaction(transactionElectoralRegister)) {
          return transactionElectoralRegister
        }
      }
    });
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
        'electoralEventPublickey',
      ]
    });

    let electoralRegisterToHash = electoralRegister.map(elector => (
      {
        ci: elector.ci,
        electoralEventPublickey: elector.electoralEventPublickey,
      }
    ))

    electoralRegisterToHash.sort((a, b) => {
      return parseInt(a["ci"]) - parseInt(b["ci"]) || a["facultyId"] - b["facultyId"] || a["schoolId"] - b["schoolId"];
    });

    const electoralRegisterHash = apostilleService.createHashApostille(JSON.stringify(electoralRegisterToHash));

    return nemElectoralRegisterHash === electoralRegisterHash;
  },
}