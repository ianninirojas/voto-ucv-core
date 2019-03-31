import {
  Mosaic,
  UInt64,
} from 'nem2-sdk';

import { getRepository, In, Not, MoreThan } from 'typeorm';

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
import { apostilleService } from '../services/apostille.service';
import { nemAccountService } from "../services/nem.account.service";
import { nemTransactionService } from "../services/nem.transaction.service";

// Constans
import { CodeTypes } from "../constants/codeType";
import { TypeElector } from '../constants/typeElector';
import { LevelElectionEnum } from "../constants/levelElection";

export const electoralRegister = {

  async selectElectoralRegister(electoralEventData: any) {
    const electoralEventPublicAccount = nemAccountService.getDeterministicPublicAccount(electoralEventData.name.toLowerCase());
    const existElectoralEvent = await nemElectoralEvent.exist(electoralEventPublicAccount);
    if (!existElectoralEvent) {
      return { created: false, data: "electoral event not exist" }
    }
    const elections = await nemElection.getAll(electoralEventPublicAccount.publicKey);

    if (elections.length === 0) {
      return "No hay electiones creadas "
    }

    let schoolIds;
    let facultyIds;
    let typesElectors;

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
        facultyIds = fillFacultyId(election.typeElector, election.facultyId, facultyIds);
      }
      else if (election.levelElection === LevelElectionEnum.school) {
        schoolIds = fillSchoolIds(election.typeElector, election.schoolId, schoolIds);
      }
    }

    let whereStudent;
    let whereProfesor;
    let whereGraduated;

    let participants: any = [];

    if (typesElectors['student']['participate']) {
      if (typesElectors['student'][LevelElectionEnum.university]) {
        whereStudent.push({ credInscr: MoreThan(0), codStatus: "000" });
      }
      if (typesElectors['student'][LevelElectionEnum.faculty]) {
        whereStudent.push({ credInscr: MoreThan(0), codStatus: "000", idFacultad: In(facultyIds['student']) });
      }
      if (typesElectors['student'][LevelElectionEnum.school]) {
        whereStudent.push({ credInscr: MoreThan(0), codStatus: "000", idEscuela: In(schoolIds['student']) });
      }

      const students = await getRepository(EstudiantePregrado).find({
        where: whereStudent
      });
      participants.concat(students);
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
          participants.splice(i, 1);
          personas.splice(j, 1);
          if (electoralRegister[elector.facultyId] === undefined) {
            electoralRegister[elector.facultyId] = [];
          }
          electoralRegister[elector.facultyId].push({
            ci: elector.ci,
            facultyId: elector.facultyId,
            schoolId: elector.schoolId,
            email: persona.email,
            electoralEventAddress: electoralEventPublicAccount.address.plain(),
          });
        }
      }
    }
    return electoralRegister;
  },

  async storeHashNemElectoralRegister(electoralEventData: any) {
    const electoralRegister = await this.selectElectoralRegister(electoralEventData);
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

    const electoralEventPublicAccount = nemAccountService.getDeterministicPublicAccount(electoralEventData.name.toLowerCase());
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
      await this.storeSQLElectoralRegister(electoralRegister);
    } catch (error) {

    }
  },

  async storeSQLElectoralRegister(electoralRegister: any) {
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
          elector.electoralEventAddress = electorByFaculty.electoralEventAddress;
          electorsByFaculty.push(elector);
        }
      }
    }
    await getRepository(ElectoralRegister).save(electorsByFaculty)
  }
}