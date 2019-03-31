// modules
import { Router } from "express";

// controllers
import PositionController from "../controllers/PositionController";

// middlewares
import { checkJwt } from "../middlewares/checkJwt";
import { checkRole } from "../middlewares/checkRole";

const router = Router();

router.get("/position", PositionController.getAll);

router.post("/position", [checkJwt, checkRole(["ADMIN"])], PositionController.create);

router.put("/position/:id", [checkJwt, checkRole(["ADMIN"])], PositionController.update);

router.delete("/position/:id", [checkJwt, checkRole(["ADMIN"])], PositionController.delete);

export default router;