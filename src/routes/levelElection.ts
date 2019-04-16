// modules
import { Router } from "express";

// controllers
import LevelElectionController from "../controllers/LevelElectionController";

// middlewares
import { checkJwt } from "../middlewares/checkJwt";
import { checkRole } from "../middlewares/checkRole";

const router = Router();

router.get("/level-election", LevelElectionController.getAll);

// router.post("/level-election", [checkJwt, checkRole(["ADMIN"])], LevelElectionController.create);
router.post("/level-election", LevelElectionController.create);

// router.put("/level-election/:id", [checkJwt, checkRole(["ADMIN"])], LevelElectionController.update);
router.put("/level-election/:id", LevelElectionController.update);

// router.delete("/level-election/:id, [checkJwt, checkRole(["ADMIN"])], LevelElectionController.delete);
router.delete("/level-election/:id", LevelElectionController.delete);


export default router;