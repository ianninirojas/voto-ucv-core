// modules

import { Request, Response } from "express";
import { getRepository } from "typeorm";

// entities

import { School } from "../entities/School";
import { Faculty } from "../entities/Faculty";
import { validate } from "class-validator";

class SchoolController {

  static getAll = async (req: Request, res: Response) => {
    const facultyId = req.params.facultyId;
    let faculty: Faculty;
    try {
      const facultyRepository = getRepository(Faculty);
      faculty = await facultyRepository.findOneOrFail(facultyId);
    } catch (error) {
      return res.status(400).send({ data: "Faculty not found" })
    }
    try {
      const schoolRepository = getRepository(School);
      const schools = await schoolRepository.find({ where: { facultyId: faculty.id } })
      res.status(200).send(schools);
    }
    catch (error) {
      res.status(500).send({ data: "An error ocurred" });
    }

  }

  static create = async (req: Request, res: Response) => {
    const facultyId = req.params.facultyId;
    let faculty: Faculty;
    try {
      const facultyRepository = getRepository(Faculty);
      faculty = await facultyRepository.findOneOrFail(facultyId);
    } catch (error) {
      return res.status(400).send({ data: "Faculty not found" })
    }

    let { name, code } = req.body;
    let school = new School();
    school.name = name;
    school.code = code;
    school.facultyId = faculty.id;
    const errors = await validate(school);
    if (errors.length > 0) {
      return res.status(400).send({ data: errors });
    }

    try {
      const schoolRepository = getRepository(School);
      await schoolRepository.save(school);
    }
    catch (error) {
      console.log('error :', error);
      res.status(409).send({ data: "school already created" });
    }

    return res.status(200).send({ data: "Facultad creada" })
  }

  static update = async (req: Request, res: Response) => {
    const schoolId = req.params.schoolId;
    let { name, code } = req.body;


    const schoolRepository = getRepository(School);
    let school: School;
    try {
      school = await schoolRepository.findOneOrFail(schoolId);
    } catch (error) {
      return res.status(404).send("School not found");
    }

    if (name !== undefined)
      school.name = name;
    if (code !== undefined)
      school.code = code;

    const errors = await validate(school);
    if (errors.length > 0) {
      return res.status(400).send({ data: errors });
    }

    try {
      await schoolRepository.save(school);
    } catch (e) {
      return res.status(409).send("name or code already in use");
    }
    res.status(204).send();

  }

  static delete = async (req: Request, res: Response) => {
    const schoolId = req.params.schoolId;

    const schoolRepository = getRepository(School);
    try {
      await schoolRepository.findOneOrFail(schoolId);
    } catch (error) {
      return res.status(404).send("School not found");
    }
    schoolRepository.delete(schoolId);

    res.status(204).send();
  }

}

export default SchoolController;