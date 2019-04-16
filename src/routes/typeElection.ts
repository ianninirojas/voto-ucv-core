// modules
import { Router } from "express";

// controllers
import TypeElectionController from "../controllers/TypeElectionController";

// middlewares
import { checkJwt } from "../middlewares/checkJwt";
import { checkRole } from "../middlewares/checkRole";

const router = Router();

router.get("/type-election", TypeElectionController.getAll);

router.post("/type-election", [checkJwt, checkRole(["ADMIN"])], TypeElectionController.create);

router.put("/type-election/:id", [checkJwt, checkRole(["ADMIN"])], TypeElectionController.update);

router.delete("/type-election/:id", [checkJwt, checkRole(["ADMIN"])], TypeElectionController.delete);


export default router;