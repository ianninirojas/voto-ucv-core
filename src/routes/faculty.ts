// modules
import { Router } from "express";

// controllers
import FacultyController from "../controllers/FacultyController";

// middlewares
import { checkJwt } from "../middlewares/checkJwt";
import { checkRole } from "../middlewares/checkRole";

const router = Router();

router.get("/faculty", FacultyController.getAll);

router.post("/faculty", [checkJwt, checkRole(["ADMIN"])], FacultyController.create);

router.put("/faculty/:id", [checkJwt, checkRole(["ADMIN"])], FacultyController.update);

router.delete("/faculty/:id", [checkJwt, checkRole(["ADMIN"])], FacultyController.delete);

export default router;