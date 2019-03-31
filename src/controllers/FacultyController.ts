// modules

import { Request, Response } from "express";
import { getRepository } from "typeorm";

// entities

import { Faculty } from "../entities/Faculty";
import { validate } from "class-validator";

class FacultyController {

  static getAll = async (req: Request, res: Response) => {
    try {
      const facultyRepository = getRepository(Faculty);
      const faculties = await facultyRepository.find();
      res.status(200).send(faculties);
    }
    catch (error) {
      res.status(500).send("An error ocurred");
    }

  }

  static create = async (req: Request, res: Response) => {
    let { name, code } = req.body;
    let faculty = new Faculty();
    faculty.name = name.toLowerCase();
    faculty.code = code;

    const errors = await validate(faculty);
    if (errors.length > 0) {
      return res.status(400).send({ data: errors });
    }

    try {
      const facultyRepository = getRepository(Faculty);
      await facultyRepository.save(faculty);
    }
    catch (error) {
      return res.status(409).send({ data: "Facultad ya fue creada" })
    }

    return res.status(200).send({ data: "Facultad creada" })
  }

  static update = async (req: Request, res: Response) => {
    const facultyId = req.params.id;
    let { name, code } = req.body;

    const facultyRepository = getRepository(Faculty);
    let faculty: Faculty;
    try {
      faculty = await facultyRepository.findOneOrFail(facultyId);
    } catch (error) {
      return res.status(404).send("Faculty not found");
    }

    if (name !== undefined)
      faculty.name = name;
    if (code !== undefined)
      faculty.code = code;

    const errors = await validate(faculty);
    if (errors.length > 0) {
      return res.status(400).send({ data: errors });
    }

    try {
      await facultyRepository.save(faculty);
    } catch (e) {
      return res.status(409).send("name or code already in use");
    }
    res.status(204).send();
  }

  static delete = async (req: Request, res: Response) => {
    const facultyId = req.params.id;

    const facultyRepository = getRepository(Faculty);
    try {
      await facultyRepository.findOneOrFail(facultyId);
    } catch (error) {
      return res.status(404).send("Faculty not found");
    }
    facultyRepository.delete(facultyId);

    res.status(204).send();
  }

}

export default FacultyController;