// modules
import { Router } from "express";

// controllers
import SchoolController from "../controllers/SchoolController";

// middlewares
import { checkJwt } from "../middlewares/checkJwt";
import { checkRole } from "../middlewares/checkRole";

const router = Router();

router.get("/faculty/:facultyId/school", SchoolController.getAll);

router.post("/faculty/:facultyId/school", [checkJwt, checkRole(["ADMIN"])], SchoolController.create);

router.put("/faculty/:facultyId/school/:schoolId", [checkJwt, checkRole(["ADMIN"])], SchoolController.update);

router.delete("/faculty/:facultyId/school/:schoolId", [checkJwt, checkRole(["ADMIN"])], SchoolController.delete);

export default router;